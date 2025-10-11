export interface ElectronAPI {
  platform: string;
  fs: {
    saveFile: (filename: string, data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    readFile: (filename: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    deleteFile: (filename: string) => Promise<{ success: boolean; error?: string }>;
    listFiles: () => Promise<{ success: boolean; files?: string[]; error?: string }>;
    readMetadata: () => Promise<{ success: boolean; data?: any; error?: string }>;
    writeMetadata: (data: any) => Promise<{ success: boolean; error?: string }>;
    writeMetadataToFile: (filename: string, metadata: any) => Promise<{ success: boolean; error?: string }>;
    readMetadataFromFile: (filename: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getStoragePath: () => Promise<{ success: boolean; path?: string; error?: string }>;
    setStoragePath: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    selectInputFile: () => Promise<{ success: boolean; data?: string; path?: string; canceled?: boolean; error?: string }>;
    selectDownloadPath: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    getMaxResults: () => Promise<{ success: boolean; value?: number; error?: string }>;
    setMaxResults: (value: number) => Promise<{ success: boolean; value?: number; error?: string }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
