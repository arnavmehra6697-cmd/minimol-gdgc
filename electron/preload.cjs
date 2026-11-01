const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hiveNative', {
  isElectron: true,
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  writeChunk: (nodeId, cid, buffer) => ipcRenderer.invoke('write-chunk', { nodeId, cid, buffer }),
  readChunk: (nodeId, cid) => ipcRenderer.invoke('read-chunk', { nodeId, cid }),
  listChunks: (nodeId) => ipcRenderer.invoke('list-chunks', { nodeId }),
  getStoragePath: (nodeId) => ipcRenderer.invoke('get-storage-path', { nodeId }),
  startPeerServer: (port, nodeId) => ipcRenderer.invoke('start-peer-server', { port, nodeId }),
});
