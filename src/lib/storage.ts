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
  const outputs = Array.isArray(result.output) ? result.output : [result.output];
  const savedIds: string[] = [];

  // Save each output as a separate record (like Electron does)
  for (let i = 0; i < outputs.length; i++) {
    const id = crypto.randomUUID();
    let processedOutput = outputs[i];

    // Download and convert URL to local blob
    if (typeof processedOutput === 'string' && processedOutput.startsWith('http')) {
      processedOutput = await downloadAsBlob(processedOutput);
    }

    await db!.results.add({
      ...result,
      output: processedOutput, // Single output per record
      id
    });
    savedIds.push(id);
  }

  // Return first ID (for backward compatibility)
  return savedIds[0] || crypto.randomUUID();
};

export const saveResult = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  if (isElectron) {
    return saveResultElectron(result);
  } else {
    return saveResultWeb(result);
  }
};

// Get file list only (without metadata) - very fast (Electron only)
export const getFileList = async (
  filter?: { type?: 'image' | 'video' }
): Promise<string[]> => {
  if (isElectron) {
    const electron = (window as any).electron;

    const filesResult = await electron.fs.listFiles();
    if (!filesResult.success) {
      return [];
    }

    const allFiles = filesResult.files || [];

    // Filter media files
    let mediaFiles = allFiles.filter((file: string) => {
      const ext = file.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i);
      return ext !== null;
    });

    // Apply type filter if specified
    if (filter?.type) {
      mediaFiles = mediaFiles.filter((file: string) => {
        const ext = file.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)?.[1]?.toLowerCase() || '';
        const fileType = ['mp4', 'webm'].includes(ext) ? 'video' : 'image';
        return fileType === filter.type;
      });
    }

    return mediaFiles;
  }

  // For web version, get IDs from IndexedDB
  const results = await db!.results.orderBy('createdAt').reverse().toArray();

  let filteredResults = results;
  if (filter?.type) {
    filteredResults = results.filter(r => r.type === filter.type);
  }

  return filteredResults.map(r => r.id);
};

// Get results with metadata for specific files (paginated)
export const getResultsForFiles = async (filenames: string[]): Promise<SavedResult[]> => {
  if (isElectron) {
    const electron = (window as any).electron;

    if (filenames.length === 0) {
      return [];
    }

    // Read metadata from specified files (batch operation)
    const metadataBatchResult = await electron.fs.readMetadataFromFiles(filenames);
    if (!metadataBatchResult.success) {
      return [];
    }

    const allMetadata = metadataBatchResult.data || {};
    const results: SavedResult[] = [];

    // Process each file
    for (const filename of filenames) {
      try {
        const metadata = allMetadata[filename];

        // Determine file type
        const ext = filename.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)?.[1]?.toLowerCase() || '';
        const type = ['mp4', 'webm'].includes(ext) ? 'video' : 'image';

        // Use metadata createdAt
        const createdAt = metadata?.createdAt || Date.now();

        // Create result object WITHOUT file data (will be loaded on demand)
        const result: SavedResult = {
          id: filename,
          predictionId: metadata?.predictionId || '',
          model: metadata?.model || 'Unknown',
          input: metadata?.input || {},
          output: '', // Empty string, will be loaded when needed
          createdAt: createdAt,
          type: metadata?.type || type
        };

        results.push(result);
      } catch (error) {
        console.error(`Failed to process metadata for ${filename}:`, error);
      }
    }

    // Sort by creation time (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);

    return results;
  }

  // For web version, get from IndexedDB
  if (filenames.length === 0) {
    return [];
  }

  const results = await db!.results.bulkGet(filenames);
  const validResults = results.filter((r): r is SavedResult => r !== undefined);

  // Sort by creation time (newest first)
  validResults.sort((a, b) => b.createdAt - a.createdAt);

  return validResults;
};

// Get all results (legacy - for backward compatibility)
export const getResults = async (
  filter?: { type?: 'image' | 'video'; model?: string }
): Promise<SavedResult[]> => {
  if (isElectron) {
    // Get all file names first (fast)
    const fileList = await getFileList(filter);

    // Load metadata for all files
    const results = await getResultsForFiles(fileList);

    // Apply model filter if specified
    if (filter?.model) {
      return results.filter(r => r.model === filter.model);
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

// Load file data for a specific result (lazy loading)
export const loadResultFile = async (filename: string): Promise<string | null> => {
  if (isElectron) {
    const electron = (window as any).electron;
    const fileResult = await electron.fs.readFile(filename);
    if (fileResult.success && fileResult.data) {
      return fileResult.data;
    }
    return null;
  }

  // For web version, get from IndexedDB (output is already stored as single item)
  const result = await db!.results.get(filename);
  if (result && result.output) {
    return typeof result.output === 'string' ? result.output : null;
  }
  return null;
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
