import Dexie, { type Table } from 'dexie';
import type { SavedResult } from '../types';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electron;

export class ResultDatabase extends Dexie {
  results!: Table<SavedResult, string>;

  constructor() {
    super('ReplicateResults');
    this.version(1).stores({
      results: 'id, predictionId, model, createdAt, type'
    });
  }
}

export const db = isElectron ? null : new ResultDatabase();

// Download image/video and convert to blob for local storage
const downloadAsBlob = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to download');

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to download media:', error);
    return url; // Fallback to original URL
  }
};

// Save to Electron file system
const saveResultElectron = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  const id = crypto.randomUUID();
  const electron = (window as any).electron;

  // Download and save files
  const savedFiles: string[] = [];
  const outputs = Array.isArray(result.output) ? result.output : [result.output];

  for (let i = 0; i < outputs.length; i++) {
    const url = outputs[i] as string;
    if (typeof url === 'string' && url.startsWith('http')) {
      try {
        // Download the file
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Get file extension from URL or content type
        const ext = url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)?.[1] ||
                   (blob.type.includes('video') ? 'mp4' : 'png');
        const filename = `${id}_${i}.${ext}`;

        // Save to file system
        await electron.fs.saveFile(filename, base64);
        savedFiles.push(filename);
      } catch (error) {
        console.error('Failed to download file:', error);
      }
    } else if (typeof url === 'string' && url.startsWith('data:')) {
      // Already a data URL, save directly
      const ext = url.match(/data:image\/(\w+)/)?.[1] || 'png';
      const filename = `${id}_${i}.${ext}`;
      await electron.fs.saveFile(filename, url);
      savedFiles.push(filename);
    }
  }

  // Read existing metadata
  const metadataResult = await electron.fs.readMetadata();
  const metadata = metadataResult.data || { results: [] };

  // Add new result
  const savedResult: SavedResult = {
    ...result,
    id,
    output: savedFiles.length === 1 ? savedFiles[0] : savedFiles
  };

  metadata.results.unshift(savedResult);

  // Get max results setting (0 = unlimited)
  const maxResultsResult = await electron.fs.getMaxResults();
  const maxResultsLimit = maxResultsResult.success ? (maxResultsResult.value || 200) : 200;

  // Clean up old results if limit is set (0 means unlimited)
  if (maxResultsLimit > 0 && metadata.results.length > maxResultsLimit) {
    const toDelete = metadata.results.slice(maxResultsLimit);
    for (const old of toDelete) {
      const files = Array.isArray(old.output) ? old.output : [old.output];
      for (const file of files) {
        if (typeof file === 'string' && !file.startsWith('http') && !file.startsWith('data:')) {
          await electron.fs.deleteFile(file);
        }
      }
    }
    metadata.results = metadata.results.slice(0, maxResultsLimit);
  }

  // Save metadata
  await electron.fs.writeMetadata(metadata);

  return id;
};

// Save to IndexedDB (web version)
const saveResultWeb = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  const id = crypto.randomUUID();

  // Download and convert output URLs to local blobs
  let processedOutput = result.output;

  if (Array.isArray(result.output)) {
    // Multiple outputs
    processedOutput = await Promise.all(
      result.output.map(async (url) => {
        if (typeof url === 'string' && url.startsWith('http')) {
          return await downloadAsBlob(url);
        }
        return url;
      })
    );
  } else if (typeof result.output === 'string' && result.output.startsWith('http')) {
    // Single output URL
    processedOutput = await downloadAsBlob(result.output);
  }

  await db!.results.add({
    ...result,
    output: processedOutput,
    id
  });
  return id;
};

export const saveResult = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  if (isElectron) {
    return saveResultElectron(result);
  } else {
    return saveResultWeb(result);
  }
};

export const getResults = async (
  filter?: { type?: 'image' | 'video'; model?: string }
): Promise<SavedResult[]> => {
  if (isElectron) {
    const electron = (window as any).electron;
    const metadataResult = await electron.fs.readMetadata();
    const metadata = metadataResult.data || { results: [] };
    let results = metadata.results || [];

    // Load file data for each result
    results = await Promise.all(
      results.map(async (r: SavedResult) => {
        const files = Array.isArray(r.output) ? r.output : [r.output];
        const loadedFiles = await Promise.all(
          files.map(async (file: string) => {
            if (typeof file === 'string' && !file.startsWith('http') && !file.startsWith('data:')) {
              const fileResult = await electron.fs.readFile(file);
              return fileResult.success ? fileResult.data : file;
            }
            return file;
          })
        );

        return {
          ...r,
          output: Array.isArray(r.output) ? loadedFiles : loadedFiles[0]
        };
      })
    );

    if (filter) {
      return results.filter((r: SavedResult) => {
        if (filter.type && r.type !== filter.type) return false;
        if (filter.model && r.model !== filter.model) return false;
        return true;
      });
    }

    return results;
  } else {
    let query = db!.results.orderBy('createdAt').reverse();
    const results = await query.toArray();

    if (filter) {
      return results.filter((r: SavedResult) => {
        if (filter.type && r.type !== filter.type) return false;
        if (filter.model && r.model !== filter.model) return false;
        return true;
      });
    }

    return results;
  }
};

export const deleteResult = async (id: string): Promise<void> => {
  if (isElectron) {
    const electron = (window as any).electron;
    const metadataResult = await electron.fs.readMetadata();
    const metadata = metadataResult.data || { results: [] };

    const resultIndex = metadata.results.findIndex((r: SavedResult) => r.id === id);
    if (resultIndex >= 0) {
      const result = metadata.results[resultIndex];
      const files = Array.isArray(result.output) ? result.output : [result.output];

      // Delete files
      for (const file of files) {
        if (typeof file === 'string' && !file.startsWith('http') && !file.startsWith('data:')) {
          await electron.fs.deleteFile(file);
        }
      }

      // Remove from metadata
      metadata.results.splice(resultIndex, 1);
      await electron.fs.writeMetadata(metadata);
    }
  } else {
    await db!.results.delete(id);
  }
};

export const getResult = async (id: string): Promise<SavedResult | undefined> => {
  if (isElectron) {
    const results = await getResults();
    return results.find(r => r.id === id);
  } else {
    return db!.results.get(id);
  }
};

// Clean up old results to prevent storage overflow
export const cleanupOldResults = async (maxResults: number = 50): Promise<void> => {
  if (isElectron) {
    // Already handled in saveResultElectron (max 200)
    return;
  }

  const allResults = await db!.results.orderBy('createdAt').reverse().toArray();

  if (allResults.length > maxResults) {
    const toDelete = allResults.slice(maxResults);
    const idsToDelete = toDelete.map(r => r.id);
    await db!.results.bulkDelete(idsToDelete);
    console.log(`Cleaned up ${idsToDelete.length} old results`);
  }
};
