const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  isMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  onWinState: cb => ipcRenderer.on('win-state', (_, v) => cb(v)),
  setTheme: mode => ipcRenderer.send('set-theme', mode),
  newWindow: () => ipcRenderer.send('new-window'),
  newIncognito: () => ipcRenderer.send('new-incognito'),
  printPage: () => ipcRenderer.send('do-print'),
  onTriggerPrint: cb => ipcRenderer.on('trigger-print', () => cb()),
  importBookmarks: () => ipcRenderer.invoke('import-bookmarks'),
  setDefault: () => ipcRenderer.send('set-default'),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  onSetIncognito: cb => ipcRenderer.on('set-incognito', (_, v) => cb(v)),
  // Download Handlers
  onDownloadStarted: cb => ipcRenderer.on('download-started', (_, data) => cb(data)),
  onDownloadUpdated: cb => ipcRenderer.on('download-updated', (_, data) => cb(data)),
  onDownloadDone: cb => ipcRenderer.on('download-done', (_, data) => cb(data)),
  openDownload: filePath => ipcRenderer.send('download-open', filePath),
  showDownloadInFolder: filePath => ipcRenderer.send('download-show-folder', filePath),
  // Update Handlers
  onUpdateAvailable: cb => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onUpdateProgress: cb => ipcRenderer.on('update-progress', (_, progress) => cb(progress)),
  onUpdateDownloaded: cb => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onUpdateError: cb => ipcRenderer.on('update-error', (_, err) => cb(err)),
  installUpdate: () => ipcRenderer.send('update-restart'),
  onNewTabFromMain: cb => ipcRenderer.on('new-tab-from-main', (_, url) => cb(url)),
  viewSource: url => ipcRenderer.send('view-source', url),
  onWebviewContextMenu: cb => ipcRenderer.on('ctx-webview-menu', (e, data) => cb(e, data)),
});

