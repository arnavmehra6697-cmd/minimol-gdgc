const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hiveNative', {
  isElectron: true,
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  writeChunk: (nodeId, cid, buffer) => ipcRenderer.invoke('write-chunk', { nodeId, cid, buffer }),
  readChunk: (nodeId, cid) => ipcRenderer.invoke('read-chunk', { nodeId, cid }),
  deleteChunk: (nodeId, cid) => ipcRenderer.invoke('delete-chunk', { nodeId, cid }),
  verifyChunk: (nodeId, cid, expectedChecksum) => ipcRenderer.invoke('verify-chunk', { nodeId, cid, expectedChecksum }),
  listChunks: (nodeId) => ipcRenderer.invoke('list-chunks', { nodeId }),
  getStoragePath: (nodeId) => ipcRenderer.invoke('get-storage-path', { nodeId }),
  openStorageFolder: (nodeId) => ipcRenderer.invoke('open-storage-folder', { nodeId }),
  startPeerServer: (port, nodeId) => ipcRenderer.invoke('start-peer-server', { port, nodeId }),
});
