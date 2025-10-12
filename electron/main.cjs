const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { startProxyServer } = require('./server.cjs');

const execFileAsync = promisify(execFile);

// Try to find exiftool binary
let exiftoolPath = 'exiftool'; // Default system path

function findExiftool() {
  // Try different possible locations
  const possiblePaths = [
    'exiftool',
    '/usr/local/bin/exiftool',
    '/opt/homebrew/bin/exiftool',
    path.join(process.resourcesPath, 'exiftool'),
  ];

  for (const testPath of possiblePaths) {
    try {
      require('child_process').execSync(`"${testPath}" -ver`, { stdio: 'ignore' });
      exiftoolPath = testPath;
      console.log('Found exiftool at:', exiftoolPath);
      return true;
    } catch (e) {
      continue;
    }
  }

  console.warn('exiftool not found in system');
  return false;
}

let mainWindow;
let proxyServer;

// Storage configuration
let storagePath = null;
let maxResults = 200; // Default
let lastInputPath = null; // Remember last input file selection path
let lastDownloadPath = null; // Remember last download path

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
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 40
    } : false,
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

app.on('ready', () => {
  findExiftool();
  createWindow();
});

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
    // If filename is absolute path, use it directly; otherwise use storage path
    const filePath = path.isAbsolute(filename) ? filename : path.join(getStoragePath(), filename);

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

    // Get file stats for creation time
    const stats = fs.statSync(filePath);

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

    return {
      success: true,
      data: dataUrl,
      birthtime: stats.birthtime.getTime() // File creation timestamp
    };
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

// Input file selection (for file uploads in forms)
ipcMain.handle('fs:selectInputFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select Input File',
    defaultPath: lastInputPath || app.getPath('documents'),
    filters: [
      { name: 'Images and Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const selectedPath = result.filePaths[0];
  lastInputPath = path.dirname(selectedPath); // Remember directory for next time

  // Read file and convert to base64
  try {
    const buffer = fs.readFileSync(selectedPath);
    const ext = path.extname(selectedPath).toLowerCase();
    let mimeType = 'application/octet-stream';

    if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (['.mp4', '.mov'].includes(ext)) mimeType = 'video/mp4';
    else if (ext === '.webm') mimeType = 'video/webm';

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { success: true, data: dataUrl, path: selectedPath };
  } catch (error) {
    console.error('Error reading input file:', error);
    return { success: false, error: error.message };
  }
});

// Download path selection (for saving outputs)
ipcMain.handle('fs:selectDownloadPath', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Output File',
    defaultPath: lastDownloadPath ? path.join(lastDownloadPath, `output-${Date.now()}.png`) : path.join(app.getPath('downloads'), `output-${Date.now()}.png`),
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const selectedPath = result.filePath;
  lastDownloadPath = path.dirname(selectedPath); // Remember directory for next time

  return { success: true, path: selectedPath };
});

// Write metadata to image/video file using exiftool command line
ipcMain.handle('fs:writeMetadataToFile', async (event, filename, metadata) => {
  try {
    const storage = getStoragePath();
    const filePath = path.join(storage, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // Prepare clean metadata (remove base64 images, limit string length)
    const cleanInput = {};
    if (metadata.input) {
      for (const [key, value] of Object.entries(metadata.input)) {
        if (key === 'image_input' || key === 'image' || key === 'mask') {
          cleanInput[key] = Array.isArray(value) ? `[${value.length} images]` : '[image data]';
        } else if (typeof value === 'string' && value.length > 400) {
          cleanInput[key] = value.substring(0, 400) + '...';
        } else {
          cleanInput[key] = value;
        }
      }
    }

    const metadataObj = {
      model: metadata.model,
      input: cleanInput,
      predictionId: metadata.predictionId,
      createdAt: metadata.createdAt,
      type: metadata.type
    };

    const metadataJson = JSON.stringify(metadataObj);
    const prompt = (metadata.input?.prompt || '').substring(0, 400);
    const model = (metadata.model || 'Unknown').substring(0, 80);
    const ext = path.extname(filePath).toLowerCase();

    // Build exiftool command arguments
    const args = ['-overwrite_original', '-charset', 'UTF8'];

    if (ext === '.png') {
      args.push(`-PNG:Description=${prompt}`);
      args.push(`-PNG:Author=${model}`);
      args.push(`-PNG:Comment=${metadataJson}`);
      args.push(`-PNG:Software=Replicate Studio v1.2.0`);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      args.push(`-EXIF:ImageDescription=${prompt}`);
      args.push(`-EXIF:Artist=${model}`);
      args.push(`-EXIF:UserComment=${metadataJson}`);
      args.push(`-EXIF:Software=Replicate Studio v1.2.0`);
    } else if (ext === '.mp4' || ext === '.mov') {
      args.push(`-QuickTime:Description=${prompt}`);
      args.push(`-QuickTime:Artist=${model}`);
      args.push(`-QuickTime:Comment=${metadataJson}`);
    }

    args.push(filePath);

    // Execute exiftool command
    try {
      const { stdout, stderr } = await execFileAsync(exiftoolPath, args);
      if (stderr && !stderr.includes('1 image files updated')) {
        return { success: false, error: stderr };
      }
      return { success: true, output: stdout };
    } catch (execError) {
      return { success: false, error: `exiftool execution failed: ${execError.message}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Read metadata from multiple files at once (batch operation)
ipcMain.handle('fs:readMetadataFromFiles', async (event, filenames) => {
  try {
    const storage = getStoragePath();
    const results = {};

    if (!filenames || filenames.length === 0) {
      return { success: true, data: results };
    }

    // Build file paths
    const filePaths = filenames.map(filename => path.join(storage, filename));

    // Get file stats for creation times
    const fileStats = {};
    for (const filename of filenames) {
      const filePath = path.join(storage, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        fileStats[filename] = stats.birthtime.getTime();
      }
    }

    // Execute exiftool on all files at once
    const args = ['-json', '-charset', 'UTF8', '-Comment', '-Description', '-Artist', '-Author', '-UserComment'];
    args.push(...filePaths);

    try {
      const { stdout } = await execFileAsync(exiftoolPath, args);
      const exifResults = JSON.parse(stdout);

      // Process each file's metadata
      for (let i = 0; i < filenames.length; i++) {
        const filename = filenames[i];
        const exifData = exifResults[i];
        const fileCreationTime = fileStats[filename] || Date.now();
        const ext = path.extname(filename).toLowerCase();

        if (!exifData) {
          // No EXIF data
          results[filename] = {
            model: 'Unknown',
            input: {},
            predictionId: '',
            createdAt: fileCreationTime,
            type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
          };
          continue;
        }

        // Try to parse full metadata from Comment field
        let fullMetadata = null;
        const commentFields = [
          exifData['UserComment'],
          exifData['Comment'],
          exifData['Description']
        ];

        for (const field of commentFields) {
          if (field && typeof field === 'string' && field.startsWith('{')) {
            try {
              fullMetadata = JSON.parse(field);
              break;
            } catch (e) {
              // Not JSON
            }
          }
        }

        if (fullMetadata) {
          if (!fullMetadata.createdAt) {
            fullMetadata.createdAt = fileCreationTime;
          }
          results[filename] = fullMetadata;
        } else {
          // Construct from individual fields
          results[filename] = {
            model: exifData['Artist'] || exifData['Author'] || 'Unknown',
            input: {
              prompt: exifData['Description'] || exifData['Comment'] || ''
            },
            predictionId: '',
            createdAt: fileCreationTime,
            type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
          };
        }
      }

      return { success: true, data: results };
    } catch (execError) {
      // If exiftool fails, return basic metadata with file creation times
      for (const filename of filenames) {
        const fileCreationTime = fileStats[filename] || Date.now();
        const ext = path.extname(filename).toLowerCase();
        results[filename] = {
          model: 'Unknown',
          input: {},
          predictionId: '',
          createdAt: fileCreationTime,
          type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
        };
      }
      return { success: true, data: results };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Read metadata from image/video file using exiftool command line (single file - for backward compatibility)
ipcMain.handle('fs:readMetadataFromFile', async (event, filename) => {
  try {
    const storage = getStoragePath();
    const filePath = path.join(storage, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // Get file stats for creation time
    const stats = fs.statSync(filePath);
    const fileCreationTime = stats.birthtime.getTime();

    const ext = path.extname(filePath).toLowerCase();
    const args = ['-json', '-charset', 'UTF8'];

    // Request specific tags based on file type
    if (ext === '.png') {
      args.push('-PNG:Description', '-PNG:Author', '-PNG:Comment', '-PNG:Software');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      args.push('-EXIF:ImageDescription', '-EXIF:Artist', '-EXIF:UserComment', '-EXIF:Software');
    } else if (ext === '.mp4' || ext === '.mov') {
      args.push('-QuickTime:Description', '-QuickTime:Artist', '-QuickTime:Comment');
    }

    args.push(filePath);

    try {
      const { stdout } = await execFileAsync(exiftoolPath, args);
      const result = JSON.parse(stdout);

      if (result && result.length > 0) {
        const tags = result[0];

        // Try to parse full metadata from Comment field
        let fullMetadata = null;
        const commentFields = [
          tags['UserComment'],
          tags['Comment'],
          tags['Description']
        ];

        for (const field of commentFields) {
          if (field && typeof field === 'string' && field.startsWith('{')) {
            try {
              fullMetadata = JSON.parse(field);
              break;
            } catch (e) {
              // Not JSON
            }
          }
        }

        if (fullMetadata) {
          // Use metadata createdAt if available, otherwise use file creation time
          if (!fullMetadata.createdAt) {
            fullMetadata.createdAt = fileCreationTime;
          }
          return { success: true, data: fullMetadata };
        }

        // Otherwise, construct from individual fields using file creation time
        const metadata = {
          model: tags['Artist'] || tags['Author'] || 'Unknown',
          input: {
            prompt: tags['ImageDescription'] || tags['Description'] || tags['Comment'] || ''
          },
          predictionId: '',
          createdAt: fileCreationTime, // Use actual file creation time
          type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
        };

        return { success: true, data: metadata };
      }

      // No EXIF data found, return minimal metadata with file creation time
      return {
        success: true,
        data: {
          model: 'Unknown',
          input: {},
          predictionId: '',
          createdAt: fileCreationTime,
          type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
        }
      };
    } catch (execError) {
      // exiftool failed, return minimal metadata with file creation time
      return {
        success: true,
        data: {
          model: 'Unknown',
          input: {},
          predictionId: '',
          createdAt: fileCreationTime,
          type: ext === '.mp4' || ext === '.webm' ? 'video' : 'image'
        }
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
