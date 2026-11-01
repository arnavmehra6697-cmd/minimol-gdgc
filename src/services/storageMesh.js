/**
 * HiveNet Storage Mesh Orchestrator
 * Coordinates peer nodes, direct disk I/O, LAN connections, and content retrieval with auto-failover.
 */

import { SmartStorageRouter } from './router.js';

export class StorageMeshManager {
  constructor() {
    this.router = new SmartStorageRouter();
    this.nodes = [];
    this.cidRegistry = new Map(); // Map<CID, { cid, originalName, size, mimeType, replicas: [nodeId1, nodeId2], timestamp, previewUrl }>
    this.listeners = new Set();
    this.isElectron = typeof window !== 'undefined' && window.hiveNative?.isElectron === true;

    this.initializeDefaultNodes();
    this.startTelemetryLoop();
  }

  initializeDefaultNodes() {
    // Node 1: Current physical machine (Host Node)
    const hostNode = {
      id: 'node-host-primary',
      name: "Host Device (This Machine)",
      type: 'LOCAL_HOST',
      ip: '127.0.0.1',
      port: 4001,
      status: 'ONLINE',
      isSimulatedOffline: false,
      availableDiskMB: 48500, // 48.5 GB free
      totalDiskMB: 64000,
      latencyMs: 3,           // Local loopback is ultra fast
      uptimeSeconds: 1840,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: '.hivenet_storage/node_host',
      storedCids: new Set(),
    };

    // Node 2: Secondary Peer (e.g. Teammate Laptop or Virtual Edge Node)
    const peerNodeB = {
      id: 'node-edge-beta',
      name: "Edge Node Beta (Laptop Peer)",
      type: 'EDGE_PEER',
      ip: '192.168.1.18',
      port: 4002,
      status: 'ONLINE',
      isSimulatedOffline: false,
      availableDiskMB: 36200, // 36.2 GB free
      totalDiskMB: 50000,
      latencyMs: 14,          // Local Wi-Fi ping ~14ms
      uptimeSeconds: 3200,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: '.hivenet_storage/node_beta',
      storedCids: new Set(),
    };

    // Node 3: Third Peer (e.g. Mobile Phone / Edge Node Gamma)
    const peerNodeC = {
      id: 'node-edge-gamma',
      name: "Edge Node Gamma (Mobile Node)",
      type: 'MOBILE_EDGE',
      ip: '192.168.1.42',
      port: 4003,
      status: 'ONLINE',
      isSimulatedOffline: false,
      availableDiskMB: 18400, // 18.4 GB free
      totalDiskMB: 32000,
      latencyMs: 28,          // Mobile Wi-Fi ping ~28ms
      uptimeSeconds: 940,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: '.hivenet_storage/node_gamma',
      storedCids: new Set(),
    };

    this.nodes = [hostNode, peerNodeB, peerNodeC];

    // If running inside Electron, query real OS host disk stats
    if (this.isElectron) {
      window.hiveNative.getDiskInfo().then(info => {
        if (info) {
          hostNode.availableDiskMB = info.freeMB;
          hostNode.totalDiskMB = info.totalMB;
          hostNode.name = `${info.hostname} (This Machine)`;
          this.notify();
        }
      }).catch(() => {});
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn());
  }

  startTelemetryLoop() {
    setInterval(() => {
      // Simulate minor real-time latency fluctuations and uptime ticks
      this.nodes.forEach(node => {
        if (node.status === 'ONLINE' && !node.isSimulatedOffline) {
          node.uptimeSeconds += 2;
          if (node.type !== 'LOCAL_HOST') {
            const jitter = (Math.random() * 4) - 2;
            node.latencyMs = Math.max(5, Math.round(node.latencyMs + jitter));
          }
        }
      });
      this.notify();
    }, 2000);
  }

  /**
   * Add a real remote peer device on local Wi-Fi
   */
  async connectRemotePeer(ip, port = 4001, customName) {
    try {
      const response = await fetch(`http://${ip}:${port}/api/telemetry`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('Peer responded with error');
      const telemetry = await response.json();

      const existingIndex = this.nodes.findIndex(n => n.ip === ip && n.port === port);
      const peerNode = {
        id: `peer-${ip.replace(/\./g, '-')}-${port}`,
        name: customName || telemetry.hostname || `LAN Peer (${ip})`,
        type: 'PHYSICAL_LAN_PEER',
        ip,
        port,
        status: 'ONLINE',
        isSimulatedOffline: false,
        availableDiskMB: telemetry.freeDiskMB || 25000,
        totalDiskMB: telemetry.totalDiskMB || 50000,
        latencyMs: 12,
        uptimeSeconds: telemetry.uptimeSeconds || 100,
        storedChunksCount: telemetry.storedChunksCount || 0,
        storedChunksBytes: 0,
        storageDir: `remote://${ip}:${port}`,
        storedCids: new Set(),
      };

      if (existingIndex >= 0) {
        this.nodes[existingIndex] = peerNode;
      } else {
        this.nodes.push(peerNode);
      }
      this.notify();
      return { success: true, node: peerNode };
    } catch (err) {
      // Fallback: add as pending or throw
      throw new Error(`Failed to reach peer at ${ip}:${port}: ${err.message}`);
    }
  }

  /**
   * Dispatch compressed image to nodes selected by Smart Router
   */
  async uploadAndRoute(compressedResult) {
    const { cid, compressedBlob, arrayBuffer, originalName, originalSize, compressedSize, compressionRatio, dimensions, previewUrl } = compressedResult;

    // 1. Ask Smart Router for top 2 optimal nodes
    const { selectedNodes, rankedNodes, decisionLog } = this.router.evaluateNodes(this.nodes, compressedSize);

    const storePromises = selectedNodes.map(async (node) => {
      // Physical storage: If Electron is active, write to disk
      if (this.isElectron) {
        try {
          await window.hiveNative.writeChunk(node.id, cid, arrayBuffer);
        } catch (err) {
          console.warn(`Local disk write fallback for node ${node.id}:`, err);
        }
      }

      // If it's a physical LAN peer, stream via HTTP POST
      if (node.type === 'PHYSICAL_LAN_PEER') {
        try {
          await fetch(`http://${node.ip}:${node.port}/api/store/${cid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: arrayBuffer,
          });
        } catch (err) {
          console.warn(`LAN peer write failed for ${node.ip}:`, err);
        }
      }

      // Update node telemetry
      node.storedChunksCount = (node.storedChunksCount || 0) + 1;
      node.storedChunksBytes = (node.storedChunksBytes || 0) + compressedSize;
      node.availableDiskMB = Math.max(0, node.availableDiskMB - Math.ceil(compressedSize / (1024 * 1024)));
      node.storedCids.add(cid);

      return node.id;
    });

    const storedReplicaIds = await Promise.all(storePromises);

    // Save to global Content-Addressable Registry
    const fileRecord = {
      cid,
      originalName,
      originalSize,
      compressedSize,
      compressionRatio,
      dimensions,
      previewUrl,
      blob: compressedBlob,
      replicas: storedReplicaIds,
      timestamp: Date.now(),
      decisionLog,
    };

    this.cidRegistry.set(cid, fileRecord);
    this.notify();

    return {
      success: true,
      cid,
      replicas: storedReplicaIds,
      decisionLog,
      fileRecord,
    };
  }

  /**
   * Content-Addressable Retrieval with Node Disconnect Resilience
   * Retrieves image from primary replica. If primary is offline, auto-fails over to secondary!
   */
  async retrieveImage(cid) {
    const record = this.cidRegistry.get(cid);
    if (!record) {
      throw new Error(`Content ID ${cid} not found in HiveNet registry`);
    }

    const startTime = performance.now();
    let retrievedFrom = null;
    let failoverOccurred = false;
    let failedNode = null;
    let blobData = record.blob;

    // Check replicas in order
    for (const nodeId of record.replicas) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (node.status === 'ONLINE' && !node.isSimulatedOffline) {
        // Node is active!
        retrievedFrom = node;
        break;
      } else {
        // Node is offline! Trigger failover
        failoverOccurred = true;
        failedNode = node;
      }
    }

    if (!retrievedFrom) {
      throw new Error(`All replica nodes for CID ${cid} are currently offline!`);
    }

    const elapsedMs = Math.round(performance.now() - startTime + retrievedFrom.latencyMs);

    return {
      cid,
      blob: blobData,
      previewUrl: record.previewUrl,
      retrievedFrom,
      failoverOccurred,
      failedNode,
      latencyMs: elapsedMs,
      replicasCount: record.replicas.length,
    };
  }

  /**
   * Simulate Airplane Mode / Node Disconnect
   */
  toggleNodeOffline(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.isSimulatedOffline = !node.isSimulatedOffline;
      node.status = node.isSimulatedOffline ? 'OFFLINE' : 'ONLINE';
      this.notify();
      return node.isSimulatedOffline;
    }
    return false;
  }

  clearAllDemoNodes() {
    this.nodes = this.nodes.filter(n => n.type === 'LOCAL_HOST');
    this.notify();
  }

  addDemoNode() {
    const count = this.nodes.length;
    const newNode = {
      id: `edge-node-${Date.now()}`,
      name: `Peer Device ${count}`,
      type: 'EDGE_PEER',
      ip: `192.168.1.${20 + count}`,
      port: 4000 + count,
      status: 'ONLINE',
      isSimulatedOffline: false,
      availableDiskMB: 35000,
      totalDiskMB: 50000,
      latencyMs: 14 + count,
      uptimeSeconds: 600,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: `.hivenet_storage/node_${count}`,
      storedCids: new Set(),
    };
    this.nodes.push(newNode);
    this.notify();
    return newNode;
  }

  getAllFiles() {
    return Array.from(this.cidRegistry.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  removeNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (node.type === 'LOCAL_HOST') {
      throw new Error('Cannot unpair this machine (Host Device)');
    }
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.notify();
    return true;
  }

  addCustomNode({ name, ip = '192.168.1.50', port = 4001, freeDiskGB = 40, latencyMs = 15 }) {
    const id = `custom-node-${Date.now()}`;
    const newNode = {
      id,
      name,
      type: 'PHYSICAL_LAN_PEER',
      ip,
      port,
      status: 'ONLINE',
      isSimulatedOffline: false,
      availableDiskMB: freeDiskGB * 1024,
      totalDiskMB: (freeDiskGB + 10) * 1024,
      latencyMs,
      uptimeSeconds: 60,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: `.hivenet_storage/${id}`,
      storedCids: new Set(),
    };
    this.nodes.push(newNode);
    this.notify();
    return newNode;
  }

  getTestHistory() {
    try {
      const stored = localStorage.getItem('hivenet_test_history');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return this.testHistory || [];
  }

  addTestRecord(record) {
    const history = this.getTestHistory();
    history.unshift(record);
    if (history.length > 25) history.pop();
    this.testHistory = history;
    try {
      localStorage.setItem('hivenet_test_history', JSON.stringify(history));
    } catch (e) {}
    this.notify();
    return record;
  }

  clearTestHistory() {
    this.testHistory = [];
    try {
      localStorage.removeItem('hivenet_test_history');
    } catch (e) {}
    this.notify();
  }

  getMeshStats() {
    const totalPooledDiskMB = this.nodes.reduce((acc, n) => acc + (n.availableDiskMB || 0), 0);
    const activeNodes = this.nodes.filter(n => n.status === 'ONLINE' && !n.isSimulatedOffline);
    const totalFiles = this.cidRegistry.size;
    const totalReplicasStored = Array.from(this.cidRegistry.values()).reduce((acc, f) => acc + f.replicas.length, 0);

    return {
      totalPooledDiskMB,
      totalPooledDiskGB: (totalPooledDiskMB / 1024).toFixed(2),
      activeNodesCount: activeNodes.length,
      totalNodesCount: this.nodes.length,
      totalFiles,
      totalReplicasStored,
      replicationFactor: this.router.replicationFactor,
    };
  }
}

// Global singleton instance for easy React hook consumption
export const storageMesh = new StorageMeshManager();
