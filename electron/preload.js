const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});
