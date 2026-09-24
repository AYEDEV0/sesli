const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),
});
