const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  // File system operations
  fs: {
    saveFile: (filename, data) => ipcRenderer.invoke('fs:saveFile', filename, data),
    readFile: (filename) => ipcRenderer.invoke('fs:readFile', filename),
    deleteFile: (filename) => ipcRenderer.invoke('fs:deleteFile', filename),
    listFiles: () => ipcRenderer.invoke('fs:listFiles'),
    readMetadata: () => ipcRenderer.invoke('fs:readMetadata'),
    writeMetadata: (data) => ipcRenderer.invoke('fs:writeMetadata', data),
    writeMetadataToFile: (filename, metadata) => ipcRenderer.invoke('fs:writeMetadataToFile', filename, metadata),
    readMetadataFromFile: (filename) => ipcRenderer.invoke('fs:readMetadataFromFile', filename),
    readMetadataFromFiles: (filenames) => ipcRenderer.invoke('fs:readMetadataFromFiles', filenames),
    getStoragePath: () => ipcRenderer.invoke('fs:getStoragePath'),
    setStoragePath: (path) => ipcRenderer.invoke('fs:setStoragePath', path),
    selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
    selectInputFile: () => ipcRenderer.invoke('fs:selectInputFile'),
    selectDownloadPath: () => ipcRenderer.invoke('fs:selectDownloadPath'),
    getMaxResults: () => ipcRenderer.invoke('fs:getMaxResults'),
    setMaxResults: (value) => ipcRenderer.invoke('fs:setMaxResults', value),
    exportTemplates: (templatesData) => ipcRenderer.invoke('fs:exportTemplates', templatesData),
    importTemplates: () => ipcRenderer.invoke('fs:importTemplates')
  }
});
