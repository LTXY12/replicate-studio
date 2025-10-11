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

// Generate unique filename with date prefix
const generateUniqueFilename = async (electron: any, prefix: string, ext: string): Promise<string> => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(2); // 25 for 2025
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`; // 251010

  // Get list of existing files
  const filesResult = await electron.fs.listFiles();
  const existingFiles = filesResult.success ? (filesResult.files || []) : [];

  // Find the highest number for today's date and this prefix
  const pattern = new RegExp(`^${datePrefix}_${prefix}_(\\d{3})\\.${ext}$`);
  let maxNumber = 0;

  for (const file of existingFiles) {
    const match = file.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // Use next available number
  const nextNumber = maxNumber + 1;
  const numSuffix = String(nextNumber).padStart(3, '0');

  return `${datePrefix}_${prefix}_${numSuffix}.${ext}`;
};

// Save to Electron file system
const saveResultElectron = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  const id = crypto.randomUUID();
  const electron = (window as any).electron;

  // Get filename prefix from localStorage
  const filenamePrefix = localStorage.getItem('filename_prefix') || 'output';

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

        // Generate unique filename to prevent overwriting
        const filename = await generateUniqueFilename(electron, filenamePrefix, ext);

        // Save to file system
        await electron.fs.saveFile(filename, base64);
        savedFiles.push(filename);
      } catch (error) {
        console.error('Failed to download file:', error);
      }
    } else if (typeof url === 'string' && url.startsWith('data:')) {
      // Already a data URL, save directly
      const ext = url.match(/data:image\/(\w+)/)?.[1] || 'png';

      // Generate unique filename to prevent overwriting
      const filename = await generateUniqueFilename(electron, filenamePrefix, ext);

      await electron.fs.saveFile(filename, url);
      savedFiles.push(filename);
    }
  }

  // Write metadata to files (wait for completion to ensure it's written)
  for (const filename of savedFiles) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for file to be fully written

      const metadataResult = await electron.fs.writeMetadataToFile(filename, {
        model: result.model,
        input: result.input,
        predictionId: result.predictionId,
        createdAt: result.createdAt,
        type: result.type
      });

      if (!metadataResult.success) {
        console.error(`Failed to write metadata to ${filename}:`, metadataResult.error);
      }
    } catch (error) {
      console.error(`Error writing metadata to ${filename}:`, error);
    }
  }

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

    // List all files in storage directory
    const filesResult = await electron.fs.listFiles();
    if (!filesResult.success) {
      return [];
    }

    const allFiles = filesResult.files || [];

    // Filter media files (not .json files)
    const mediaFiles = allFiles.filter((file: string) => {
      const ext = file.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i);
      return ext !== null;
    });

    const results: SavedResult[] = [];

    // Read metadata from each media file
    for (const filename of mediaFiles) {
      try {
        // Read file data
        const fileResult = await electron.fs.readFile(filename);
        if (!fileResult.success || !fileResult.data) continue;

        // Read metadata from file
        const metadataResult = await electron.fs.readMetadataFromFile(filename);

        // Determine file type
        const ext = filename.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)?.[1]?.toLowerCase() || '';
        const type = ['mp4', 'webm'].includes(ext) ? 'video' : 'image';

        // Use file birthtime (creation time) for sorting if metadata doesn't have createdAt
        const createdAt = metadataResult.data?.createdAt || fileResult.birthtime || Date.now();

        // Create result object
        const result: SavedResult = {
          id: filename, // Use filename as ID
          predictionId: metadataResult.data?.predictionId || '',
          model: metadataResult.data?.model || 'Unknown',
          input: metadataResult.data?.input || {},
          output: fileResult.data,
          createdAt: createdAt,
          type: metadataResult.data?.type || type
        };

        results.push(result);
      } catch (error) {
        console.error(`Failed to read ${filename}:`, error);
      }
    }

    // Sort by creation time (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);

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

    // id is now the filename itself
    await electron.fs.deleteFile(id);
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
    const electron = (window as any).electron;

    // Get max results setting
    const maxResultsResult = await electron.fs.getMaxResults();
    const maxResultsLimit = maxResultsResult.success ? (maxResultsResult.value || 0) : 0;

    // If 0 (unlimited), don't cleanup
    if (maxResultsLimit === 0) return;

    // Get all results
    const allResults = await getResults();

    // If exceeds limit, delete oldest files
    if (allResults.length > maxResultsLimit) {
      const toDelete = allResults.slice(maxResultsLimit);
      for (const result of toDelete) {
        await deleteResult(result.id);
      }
      console.log(`Cleaned up ${toDelete.length} old results`);
    }
  } else {
    const allResults = await db!.results.orderBy('createdAt').reverse().toArray();

    if (allResults.length > maxResults) {
      const toDelete = allResults.slice(maxResults);
      const idsToDelete = toDelete.map(r => r.id);
      await db!.results.bulkDelete(idsToDelete);
      console.log(`Cleaned up ${idsToDelete.length} old results`);
    }
  }
};
