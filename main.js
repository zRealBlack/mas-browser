const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

function createWindow(incognito = false) {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 800, minHeight: 500,
    title: 'MAS Browser', autoHideMenuBar: true,
    frame: false, backgroundColor: incognito ? '#0e0e0e' : '#f0f0f2',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true,
    },
  });

  // Handle links that request a new window by opening them in a new tab instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    win.webContents.send('new-tab-from-main', url);
    return { action: 'deny' };
  });

  win.loadFile('index.html');
  if (incognito) {
    win.webContents.on('did-finish-load', () => win.webContents.send('set-incognito', true));
  }
  win.on('maximize', () => win.webContents.send('win-state', true));
  win.on('unmaximize', () => win.webContents.send('win-state', false));
  return win;
}

app.whenReady().then(() => {
  createWindow();

  // Auto-updater check
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  ipcMain.on('win-minimize', e => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('win-maximize', e => {
    const w = BrowserWindow.fromWebContents(e.sender);
    w?.isMaximized() ? w.unmaximize() : w.maximize();
  });
  ipcMain.on('win-close', e => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.handle('win-is-maximized', e => BrowserWindow.fromWebContents(e.sender)?.isMaximized() || false);

  ipcMain.on('new-window', () => createWindow());
  ipcMain.on('new-incognito', () => createWindow(true));
  ipcMain.on('do-print', e => e.sender.send('trigger-print'));
  ipcMain.on('set-default', () => {
    app.setAsDefaultProtocolClient('http');
    app.setAsDefaultProtocolClient('https');
  });
  ipcMain.on('check-updates', e => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    } else {
      dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender), {
        type: 'info', title: 'Updates', message: 'Update check disabled in dev mode.',
        detail: 'Packaged app will check GitHub for updates.', buttons: ['OK']
      });
    }
  });

  // --- AUTO UPDATER EVENTS ---
  autoUpdater.on('update-available', (info) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(win => win.webContents.send('update-available', info));
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(win => win.webContents.send('update-progress', progressObj));
  });

  autoUpdater.on('update-downloaded', (info) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(win => win.webContents.send('update-downloaded', info));
  });

  autoUpdater.on('error', (err) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(win => win.webContents.send('update-error', err.message));
  });

  ipcMain.on('update-restart', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('import-bookmarks', async () => {
    const result = { bookmarks: [], source: null };
    const tryPaths = [
      { name: 'Chrome', p: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks') },
      { name: 'Edge', p: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks') },
    ];
    for (const { name, p } of tryPaths) {
      try {
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
          result.source = name;
          const extract = n => {
            if (n.type === 'url') result.bookmarks.push({ title: n.name, url: n.url });
            if (n.children) n.children.forEach(extract);
          };
          if (data.roots) Object.values(data.roots).forEach(r => { if (typeof r === 'object') extract(r); });
          if (result.bookmarks.length > 0) break;
        }
      } catch { }
    }
    return result;
  });

  ipcMain.on('set-theme', (e, theme) => {
    const { nativeTheme } = require('electron');
    nativeTheme.themeSource = theme;
  });

  session.defaultSession.setPermissionRequestHandler((_, __, cb) => cb(true));

  // --- DOWNLOAD MANAGEMENT ---
  const activeDownloads = new Map();

  session.defaultSession.on('will-download', (event, item, webContents) => {
    const id = Date.now().toString();
    const fileName = item.getFilename();
    const totalBytes = item.getTotalBytes();

    activeDownloads.set(id, item);

    // Initial notification
    webContents.send('download-started', {
      id,
      fileName,
      totalBytes,
      savePath: item.getSavePath()
    });

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        webContents.send('download-updated', { id, state: 'interrupted' });
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          webContents.send('download-updated', { id, state: 'paused' });
        } else {
          webContents.send('download-updated', {
            id,
            state: 'progressing',
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes()
          });
        }
      }
    });

    item.once('done', (event, state) => {
      activeDownloads.delete(id);
      webContents.send('download-done', {
        id,
        state,
        savePath: item.getSavePath()
      });
    });
  });

  ipcMain.on('download-open', (e, filePath) => {
    const { shell } = require('electron');
    shell.openPath(filePath);
  });

  ipcMain.on('download-show-folder', (e, filePath) => {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
  });
});

app.on('window-all-closed', () => app.quit());
