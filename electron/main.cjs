const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startProxyServer } = require('./server.cjs');

let mainWindow;
let proxyServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
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
