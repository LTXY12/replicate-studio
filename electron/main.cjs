const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startProxyServer } = require('./server.cjs');

let mainWindow;
let proxyServer;

// Storage configuration
let storagePath = null;
let maxResults = 200; // Default

function getDefaultStoragePath() {
  const downloadPath = app.getPath('downloads');
  return path.join(downloadPath, 'RepliTemp');
}

function getSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (error) {
    console.error('Failed to read settings:', error);
  }
  return {};
}

function saveSettings(newSettings) {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const currentSettings = getSettings();
  const settings = { ...currentSettings, ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return settings;
}

function getStoragePath() {
  if (!storagePath) {
    const settings = getSettings();
    storagePath = settings.storagePath || getDefaultStoragePath();
    maxResults = settings.maxResults !== undefined ? settings.maxResults : 200;
  }

  // Ensure directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return storagePath;
}

function saveStoragePath(newPath) {
  storagePath = newPath;
  saveSettings({ storagePath: newPath });

  // Ensure new directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
}

function getMaxResults() {
  if (maxResults === undefined) {
    const settings = getSettings();
    maxResults = settings.maxResults !== undefined ? settings.maxResults : 200;
  }
  return maxResults;
}

function setMaxResults(value) {
  maxResults = value;
  saveSettings({ maxResults: value });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    icon: path.join(__dirname, '../public/icon.png')
  });

  // Start the Express proxy server
  if (!proxyServer) {
    proxyServer = startProxyServer(3001);
  }

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (proxyServer) {
    proxyServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  if (proxyServer) {
    proxyServer.close();
  }
});

// IPC Handlers for file system operations
ipcMain.handle('fs:saveFile', async (event, filename, data) => {
  try {
    const storage = getStoragePath();
    const filePath = path.join(storage, filename);

    // If data is a base64 string, save it as binary
    if (data.startsWith('data:')) {
      const base64Data = data.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
    } else {
      fs.writeFileSync(filePath, data);
    }

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (event, filename) => {
  try {
    const storage = getStoragePath();
    const filePath = path.join(storage, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // Read as base64 for images/videos
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'application/octet-stream';

    if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.webm') mimeType = 'video/webm';

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { success: true, data: dataUrl };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:deleteFile', async (event, filename) => {
  try {
    const storage = getStoragePath();
    const filePath = path.join(storage, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:listFiles', async () => {
  try {
    const storage = getStoragePath();

    if (!fs.existsSync(storage)) {
      return { success: true, files: [] };
    }

    const files = fs.readdirSync(storage).filter(f => f !== 'metadata.json');
    return { success: true, files };
  } catch (error) {
    console.error('Error listing files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readMetadata', async () => {
  try {
    const storage = getStoragePath();
    const metadataPath = path.join(storage, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return { success: true, data: { results: [] } };
    }

    const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    return { success: true, data };
  } catch (error) {
    console.error('Error reading metadata:', error);
    return { success: true, data: { results: [] } };
  }
});

ipcMain.handle('fs:writeMetadata', async (event, data) => {
  try {
    const storage = getStoragePath();
    const metadataPath = path.join(storage, 'metadata.json');

    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error writing metadata:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:getStoragePath', async () => {
  return { success: true, path: getStoragePath() };
});

ipcMain.handle('fs:setStoragePath', async (event, newPath) => {
  try {
    saveStoragePath(newPath);
    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error setting storage path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Storage Directory',
    defaultPath: getStoragePath()
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const selectedPath = result.filePaths[0];
  saveStoragePath(selectedPath);

  return { success: true, path: selectedPath };
});

ipcMain.handle('fs:getMaxResults', async () => {
  return { success: true, value: getMaxResults() };
});

ipcMain.handle('fs:setMaxResults', async (event, value) => {
  try {
    setMaxResults(value);
    return { success: true, value };
  } catch (error) {
    console.error('Error setting max results:', error);
    return { success: false, error: error.message };
  }
});
