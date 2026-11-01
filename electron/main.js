import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary Visible Storage Directory in User's Documents folder
function getVisibleStorageDir() {
  const docsPath = path.join(os.homedir(), 'Documents');
  const targetDir = path.join(docsPath, 'HiveNet Storage');
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (e) {
      console.warn('[HiveNet] Could not create in Documents, fallback to home:', e.message);
      return path.join(os.homedir(), 'HiveNet Storage');
    }
  }
  return targetDir;
}

const BASE_STORAGE_DIR = getVisibleStorageDir();

let mainWindow = null;
let peerServer = null;

function getStorageDirForNode(nodeId = 'primary') {
  const sanitized = nodeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nodeDir = path.join(BASE_STORAGE_DIR, sanitized);
  if (!fs.existsSync(nodeDir)) {
    fs.mkdirSync(nodeDir, { recursive: true });
  }
  return nodeDir;
}

// Start P2P Express Server for LAN Mesh storage transfer
function startPeerDaemon(port = 4001, nodeId = 'primary') {
  if (peerServer) {
    try { peerServer.close(); } catch (e) {}
  }

  const serverApp = express();
  serverApp.use(cors());
  serverApp.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
  serverApp.use(express.json());

  // Ping / Telemetry endpoint
  serverApp.get('/api/telemetry', (req, res) => {
    const nodeDir = getStorageDirForNode(nodeId);
    let totalUsedBytes = 0;
    let files = [];
    try {
      files = fs.readdirSync(nodeDir);
      files.forEach(f => {
        try {
          const stats = fs.statSync(path.join(nodeDir, f));
          totalUsedBytes += stats.size;
        } catch (err) {}
      });
    } catch (e) {}

    // Real disk telemetry via statfsSync (works on Node v18+)
    let freeDiskMB = 10000;
    let totalDiskMB = 50000;
    try {
      const drive = process.platform === 'win32' ? 'C:\\' : '/';
      const diskStats = fs.statfsSync(drive);
      freeDiskMB = Math.floor((diskStats.bfree * diskStats.bsize) / (1024 * 1024));
      totalDiskMB = Math.floor((diskStats.blocks * diskStats.bsize) / (1024 * 1024));
    } catch (diskErr) {
      freeDiskMB = Math.floor(os.freemem() / (1024 * 1024));
      totalDiskMB = Math.floor(os.totalmem() / (1024 * 1024));
    }

    res.json({
      nodeId,
      status: 'ONLINE',
      uptimeSeconds: Math.floor(process.uptime()),
      freeDiskMB,
      totalDiskMB,
      storedChunksCount: files.length,
      storageUsedMB: (totalUsedBytes / (1024 * 1024)).toFixed(2),
      hostname: os.hostname(),
      storagePath: nodeDir,
      baseStorageDir: BASE_STORAGE_DIR,
    });
  });

  // Store chunk / image endpoint (Direct disk write + checksum verification)
  serverApp.post('/api/store/:cid', (req, res) => {
    const { cid } = req.params;
    const expectedChecksum = req.headers['x-expected-checksum'] || null;
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);

    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

    if (expectedChecksum) {
      const actualChecksum = crypto.createHash('sha256').update(data).digest('hex');
      if (actualChecksum !== expectedChecksum) {
        return res.status(400).json({
          error: 'Checksum mismatch: Received file is corrupted',
          expected: expectedChecksum,
          actual: actualChecksum,
        });
      }
    }

    fs.writeFile(filePath, data, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to write chunk to disk', details: err.message });
      }
      const actualChecksum = crypto.createHash('sha256').update(data).digest('hex');
      console.log(`[Peer Daemon] Stored CID ${cid.slice(0, 16)}... on disk (${data.length} bytes, SHA-256: ${actualChecksum.slice(0, 10)})`);
      res.json({
        success: true,
        cid,
        storedAt: filePath,
        size: data.length,
        checksum: actualChecksum,
      });
    });
  });

  // Retrieve chunk / image endpoint (Direct disk read)
  serverApp.get('/api/retrieve/:cid', (req, res) => {
    const { cid } = req.params;
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Chunk not found on this node' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });

  // Verify chunk endpoint (Checks physical existence & SHA-256 integrity)
  serverApp.get('/api/verify/:cid', (req, res) => {
    const { cid } = req.params;
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);

    if (!fs.existsSync(filePath)) {
      return res.json({ exists: false, healthy: false, error: 'File physically missing' });
    }

    try {
      const stats = fs.statSync(filePath);
      const data = fs.readFileSync(filePath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');
      res.json({
        exists: true,
        healthy: true,
        size: stats.size,
        checksum,
        filePath,
      });
    } catch (e) {
      res.json({ exists: true, healthy: false, error: e.message });
    }
  });

  // Delete chunk endpoint (For intentional deletion or test replica deletion)
  serverApp.delete('/api/chunks/:cid', (req, res) => {
    const { cid } = req.params;
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return res.json({ success: true, deleted: true, cid, filePath });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to delete file', details: e.message });
      }
    }
    res.json({ success: true, deleted: false, message: 'File did not exist' });
  });

  // List all stored CIDs on this node
  serverApp.get('/api/chunks', (req, res) => {
    const nodeDir = getStorageDirForNode(nodeId);
    try {
      const files = fs.readdirSync(nodeDir)
        .filter(f => f.endsWith('.webp'))
        .map(f => f.replace('.webp', ''));
      res.json({ chunks: files });
    } catch (e) {
      res.json({ chunks: [] });
    }
  });

  peerServer = serverApp.listen(port, '0.0.0.0', () => {
    console.log(`[HiveNet P2P Daemon] Running on port ${port} for node: ${nodeId}`);
    console.log(`[HiveNet Storage Location] ${BASE_STORAGE_DIR}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'HiveNet — Decentralized Edge Cloud Drive',
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In development, attempt to load Vite dev server; otherwise load built dist/index.html
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  const devUrl = 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      console.log('[Electron] Vite server not reachable, loading dist/index.html...');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC handlers for native filesystem & telemetry operations
function setupIPC() {
  ipcMain.handle('get-disk-info', async () => {
    let freeMB = 10000;
    let totalMB = 50000;
    try {
      const drive = process.platform === 'win32' ? 'C:\\' : '/';
      const diskStats = fs.statfsSync(drive);
      freeMB = Math.floor((diskStats.bfree * diskStats.bsize) / (1024 * 1024));
      totalMB = Math.floor((diskStats.blocks * diskStats.bsize) / (1024 * 1024));
    } catch (diskErr) {
      freeMB = Math.floor(os.freemem() / (1024 * 1024));
      totalMB = Math.floor(os.totalmem() / (1024 * 1024));
    }
    return {
      freeMB,
      totalMB,
      freeBytes: freeMB * 1024 * 1024,
      totalBytes: totalMB * 1024 * 1024,
      platform: os.platform(),
      hostname: os.hostname(),
      baseStorageDir: BASE_STORAGE_DIR,
    };
  });

  ipcMain.handle('write-chunk', async (event, { nodeId, cid, buffer }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);
    // Handle Uint8Array, ArrayBuffer, or plain object from IPC serialization
    let data;
    if (Buffer.isBuffer(buffer)) {
      data = buffer;
    } else if (buffer instanceof Uint8Array || buffer instanceof ArrayBuffer) {
      data = Buffer.from(buffer);
    } else if (buffer && typeof buffer === 'object') {
      // Electron IPC sometimes deserializes Uint8Array as a plain object {0: x, 1: y, ...}
      const values = Object.values(buffer);
      data = Buffer.from(values);
    } else {
      data = Buffer.from(buffer);
    }
    await fs.promises.writeFile(filePath, data);
    console.log(`[HiveNet Disk] Wrote ${cid.slice(0,12)}... to ${filePath} (${data.length} bytes)`);
    return { success: true, filePath, size: data.length };
  });

  ipcMain.handle('read-chunk', async (event, { nodeId, cid }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Chunk ${cid} not found on node ${nodeId}`);
    }
    const data = await fs.promises.readFile(filePath);
    return data.buffer;
  });

  ipcMain.handle('list-chunks', async (event, { nodeId }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const files = await fs.promises.readdir(nodeDir);
    return files
      .filter(f => f.endsWith('.webp'))
      .map(f => {
        const stats = fs.statSync(path.join(nodeDir, f));
        return {
          cid: f.replace('.webp', ''),
          size: stats.size,
          createdAt: stats.birthtimeMs,
        };
      });
  });

  ipcMain.handle('get-storage-path', async (event, { nodeId }) => {
    return getStorageDirForNode(nodeId);
  });

  // Open directory in native Windows File Explorer
  ipcMain.handle('open-storage-folder', async (event, { nodeId } = {}) => {
    const targetDir = nodeId ? getStorageDirForNode(nodeId) : BASE_STORAGE_DIR;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    await shell.openPath(targetDir);
    return { success: true, openedPath: targetDir };
  });

  // Physically delete chunk (for manual test replica deletion or user delete)
  ipcMain.handle('delete-chunk', async (event, { nodeId, cid }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[HiveNet Disk] Physically deleted ${cid.slice(0, 12)}... from ${filePath}`);
      return { success: true, deleted: true, filePath };
    }
    return { success: true, deleted: false, message: 'File did not exist' };
  });

  // Verify chunk physical existence and integrity via IPC
  ipcMain.handle('verify-chunk', async (event, { nodeId, cid, expectedChecksum }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);
    if (!fs.existsSync(filePath)) {
      return { exists: false, healthy: false, error: 'File physically missing' };
    }
    try {
      const stats = await fs.promises.stat(filePath);
      const data = await fs.promises.readFile(filePath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');
      const healthy = expectedChecksum ? checksum === expectedChecksum : true;
      return {
        exists: true,
        healthy,
        size: stats.size,
        checksum,
        filePath,
      };
    } catch (e) {
      return { exists: true, healthy: false, error: e.message };
    }
  });

  ipcMain.handle('start-peer-server', async (event, { port, nodeId }) => {
    startPeerDaemon(port, nodeId);
    return { success: true, port, nodeId };
  });
}

app.whenReady().then(() => {
  setupIPC();
  startPeerDaemon(4001, 'primary_node');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (peerServer) {
    try { peerServer.close(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
