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
});
