import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for native storage on local disk
const BASE_STORAGE_DIR = path.join(os.homedir(), '.hivenet_storage');
if (!fs.existsSync(BASE_STORAGE_DIR)) {
  fs.mkdirSync(BASE_STORAGE_DIR, { recursive: true });
}

let mainWindow = null;
let peerServer = null;

function getStorageDirForNode(nodeId = 'primary') {
  const nodeDir = path.join(BASE_STORAGE_DIR, nodeId.replace(/[^a-zA-Z0-9_-]/g, '_'));
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
    const files = fs.readdirSync(nodeDir);
    let totalUsedBytes = 0;
    files.forEach(f => {
      try {
        const stats = fs.statSync(path.join(nodeDir, f));
        totalUsedBytes += stats.size;
      } catch (err) {}
    });

    res.json({
      nodeId,
      status: 'ONLINE',
      uptimeSeconds: Math.floor(process.uptime()),
      freeDiskMB: Math.floor(os.freemem() / (1024 * 1024)),
      totalDiskMB: Math.floor(os.totalmem() / (1024 * 1024)),
      storedChunksCount: files.length,
      storageUsedMB: (totalUsedBytes / (1024 * 1024)).toFixed(2),
      hostname: os.hostname(),
    });
  });

  // Store chunk / image endpoint (Direct disk write)
  serverApp.post('/api/store/:cid', (req, res) => {
    const { cid } = req.params;
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);

    fs.writeFile(filePath, req.body, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to write chunk to disk', details: err.message });
      }
      res.json({ success: true, cid, storedAt: filePath, size: req.body.length });
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

    res.setHeader('Content-Type', 'image/webp');
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });

  // List all stored CIDs on this node
  serverApp.get('/api/chunks', (req, res) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const files = fs.readdirSync(nodeDir)
      .filter(f => f.endsWith('.webp'))
      .map(f => f.replace('.webp', ''));
    res.json({ chunks: files });
  });

  peerServer = serverApp.listen(port, '0.0.0.0', () => {
    console.log(`[HiveNet P2P Daemon] Running on port ${port} for node: ${nodeId}`);
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
    return {
      freeBytes: os.freemem(),
      totalBytes: os.totalmem(),
      freeMB: Math.floor(os.freemem() / (1024 * 1024)),
      totalMB: Math.floor(os.totalmem() / (1024 * 1024)),
      platform: os.platform(),
      hostname: os.hostname(),
      baseStorageDir: BASE_STORAGE_DIR,
    };
  });

  ipcMain.handle('write-chunk', async (event, { nodeId, cid, buffer }) => {
    const nodeDir = getStorageDirForNode(nodeId);
    const filePath = path.join(nodeDir, `${cid}.webp`);
    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath, size: buffer.byteLength || buffer.length };
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
