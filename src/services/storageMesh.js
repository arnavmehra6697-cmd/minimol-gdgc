/**
 * HiveNet Storage Mesh Orchestrator
 * Coordinates peer nodes, direct disk I/O in 'Documents/HiveNet Storage',
 * client-side authenticated AES-256-GCM encryption, automatic replica monitoring,
 * checksum integrity audits, and self-healing storage repair.
 */

import { SmartStorageRouter } from './router.js';
import { encryptPayload, decryptPayload, computeSHA256 } from './crypto.js';

export class StorageMeshManager {
  constructor() {
    this.router = new SmartStorageRouter();
    this.nodes = [];
    this.cidRegistry = new Map(); // Map<CID, FileRecord>
    this.pendingReplicationQueue = new Set(); // Set<CID> awaiting restoration
    this.repairInProgress = new Set(); // Set<CID> currently repairing
    this.listeners = new Set();
    this.isElectron = typeof window !== 'undefined' && window.hiveNative?.isElectron === true;
    this.lastHealthAudit = null;
    this.auditErrors = [];

    this.initializeDefaultNodes();
    this.loadPersistedRegistry();
    this.startTelemetryLoop();
    this.startReplicaHealthAuditor();
  }

  loadPersistedRegistry() {
    try {
      const saved = localStorage.getItem('hivenet_cid_registry');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.forEach(item => {
          this.cidRegistry.set(item.cid, {
            ...item,
            health: item.health || 'Healthy',
            lastVerified: item.lastVerified || Date.now(),
          });
        });
      }
    } catch (e) {
      console.warn('[HiveNet] Could not load persisted registry:', e);
    }
  }

  persistRegistry() {
    try {
      const items = Array.from(this.cidRegistry.values()).map(r => ({
        cid: r.cid,
        originalName: r.originalName,
        originalSize: r.originalSize,
        compressedSize: r.compressedSize,
        encryptedSize: r.encryptedSize,
        compressionRatio: r.compressionRatio,
        dimensions: r.dimensions,
        isEncrypted: r.isEncrypted,
        checksum: r.checksum,
        replicas: r.replicas,
        timestamp: r.timestamp,
        health: r.health,
        lastVerified: r.lastVerified,
        // intentionally not storing passwords or plaintext keys
      }));
      localStorage.setItem('hivenet_cid_registry', JSON.stringify(items));
    } catch (e) {}
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
      availableDiskMB: 48500,
      totalDiskMB: 64000,
      latencyMs: 3,
      uptimeSeconds: 1840,
      storedChunksCount: 0,
      storedChunksBytes: 0,
      storageDir: 'HiveNet Storage/node-host-primary',
      storedCids: new Set(),
    };

    // App starts with ONLY this machine. Real peers join via "Connect a Device" tab.
    this.nodes = [hostNode];

    // If running inside Electron, query real OS host disk stats & physical storage directory
    if (this.isElectron) {
      window.hiveNative.getDiskInfo().then(info => {
        if (info) {
          hostNode.availableDiskMB = info.freeMB;
          hostNode.totalDiskMB = info.totalMB;
          hostNode.name = `${info.hostname} (This Machine)`;
          hostNode.storageDir = info.baseStorageDir || hostNode.storageDir;
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
   * Periodic Replica Health Auditor & Self-Healing Loop
   * Runs every 12 seconds:
   * 1. Physically audits expected replica files on disks.
   * 2. Checks SHA-256 checksums to detect corruption or missing files.
   * 3. Triggers self-healing repair if a copy is missing and suitable peers exist.
   */
  startReplicaHealthAuditor() {
    setInterval(async () => {
      await this.auditReplicaHealth();
    }, 12000);
  }

  async auditReplicaHealth() {
    if (this.cidRegistry.size === 0) return;
    this.lastHealthAudit = Date.now();
    this.auditErrors = [];

    for (const [cid, record] of this.cidRegistry.entries()) {
      if (record.isDeletedByUser) continue;

      let healthyReplicas = [];
      let missingReplicas = [];

      for (const nodeId of record.replicas) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) {
          missingReplicas.push(nodeId);
          continue;
        }

        // If node is currently offline, we do NOT treat it as permanently deleted
        if (node.isSimulatedOffline || node.status === 'OFFLINE') {
          // Temporarily offline: keep in replica list, don't delete
          continue;
        }

        // Physical verification on the node
        try {
          const verifyRes = await this.verifyReplicaOnNode(node, cid, record.checksum);
          if (verifyRes.exists && verifyRes.healthy) {
            healthyReplicas.push(nodeId);
          } else {
            console.warn(`[Audit] Replica for ${cid.slice(0, 12)} on node ${node.id} is unhealthy/missing:`, verifyRes.error);
            missingReplicas.push(nodeId);
          }
        } catch (err) {
          console.warn(`[Audit] Error verifying ${cid.slice(0, 12)} on ${node.id}:`, err.message);
        }
      }

      // Update replica status
      record.lastVerified = Date.now();

      if (missingReplicas.length > 0) {
        // Strip out confirmed physically deleted replicas
        record.replicas = record.replicas.filter(id => !missingReplicas.includes(id));
      }

      if (record.replicas.length >= this.router.replicationFactor) {
        record.health = 'Healthy';
      } else if (record.replicas.length > 0) {
        record.health = 'Under-replicated';
        // Add to self-healing repair queue
        this.queueRepair(cid);
      } else {
        record.health = 'Failed';
      }
    }

    this.persistRegistry();
    this.notify();

    // Process pending repairs
    await this.processPendingRepairs();
  }

  /**
   * Verify physical existence and SHA-256 checksum on a specific node
   */
  async verifyReplicaOnNode(node, cid, expectedChecksum) {
    if (node.type === 'LOCAL_HOST') {
      if (this.isElectron) {
        return await window.hiveNative.verifyChunk(node.id, cid, expectedChecksum);
      }
      return { exists: true, healthy: true };
    }

    if (node.type === 'PHYSICAL_LAN_PEER') {
      try {
        const res = await fetch(`http://${node.ip}:${node.port}/api/verify/${cid}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return { exists: false, healthy: false };
        const data = await res.json();
        const checksumMatch = expectedChecksum ? data.checksum === expectedChecksum : true;
        return {
          exists: data.exists,
          healthy: data.healthy && checksumMatch,
          size: data.size,
          checksum: data.checksum,
        };
      } catch (e) {
        return { exists: false, healthy: false, error: e.message };
      }
    }

    return { exists: true, healthy: true };
  }

  queueRepair(cid) {
    if (!this.repairInProgress.has(cid)) {
      this.pendingReplicationQueue.add(cid);
    }
  }

  /**
   * Automatic Self-Healing Engine:
   * Restores under-replicated files to Replication Factor >= 2 without needing user intervention.
   * Transfers the encrypted ciphertext directly (never decrypting on storage peers).
   */
  async processPendingRepairs() {
    if (this.pendingReplicationQueue.size === 0) return;

    for (const cid of Array.from(this.pendingReplicationQueue)) {
      if (this.repairInProgress.has(cid)) continue;

      const record = this.cidRegistry.get(cid);
      if (!record || record.isDeletedByUser) {
        this.pendingReplicationQueue.delete(cid);
        continue;
      }

      // Check if surviving replicas exist
      if (record.replicas.length === 0) {
        record.health = 'Failed';
        this.pendingReplicationQueue.delete(cid);
        continue;
      }

      // Find available candidate peers that DO NOT already hold a replica
      const availableNodes = this.nodes.filter(n =>
        n.status === 'ONLINE' &&
        !n.isSimulatedOffline &&
        !record.replicas.includes(n.id)
      );

      if (availableNodes.length === 0) {
        // No suitable candidate currently online; keep in queue and retry when peer reconnects
        continue;
      }

      this.repairInProgress.add(cid);
      record.health = 'Recovering';
      this.notify();

      try {
        // 1. Fetch encrypted ciphertext from a surviving healthy replica
        const survivingNodeId = record.replicas[0];
        const survivingNode = this.nodes.find(n => n.id === survivingNodeId);
        let encryptedBytes = null;

        if (survivingNode.type === 'LOCAL_HOST' && this.isElectron) {
          encryptedBytes = await window.hiveNative.readChunk(survivingNode.id, cid);
        } else if (survivingNode.type === 'PHYSICAL_LAN_PEER') {
          const resp = await fetch(`http://${survivingNode.ip}:${survivingNode.port}/api/retrieve/${cid}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (!resp.ok) throw new Error('Surviving node read failed');
          encryptedBytes = await resp.arrayBuffer();
        } else if (record.encryptedBuffer) {
          encryptedBytes = record.encryptedBuffer;
        }

        if (!encryptedBytes) {
          throw new Error('Unable to read surviving replica data');
        }

        // 2. Select the best peer using the existing Smart Storage Router
        const { selectedNodes } = this.router.evaluateNodes(availableNodes, record.encryptedSize || 0);
        const targetNode = selectedNodes[0];

        // 3. Transfer encrypted copy to the target node
        const uint8Data = new Uint8Array(encryptedBytes);
        let writeSuccess = false;

        if (targetNode.type === 'LOCAL_HOST' && this.isElectron) {
          await window.hiveNative.writeChunk(targetNode.id, cid, uint8Data);
          writeSuccess = true;
        } else if (targetNode.type === 'PHYSICAL_LAN_PEER') {
          const storeResp = await fetch(`http://${targetNode.ip}:${targetNode.port}/api/store/${cid}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-expected-checksum': record.checksum || '',
            },
            body: uint8Data,
            signal: AbortSignal.timeout(10000),
          });
          writeSuccess = storeResp.ok;
        } else {
          // In-memory or demo node
          writeSuccess = true;
        }

        if (writeSuccess) {
          // 4. Verify the newly written copy
          const verifyResult = await this.verifyReplicaOnNode(targetNode, cid, record.checksum);
          if (verifyResult.healthy) {
            record.replicas.push(targetNode.id);
            record.health = record.replicas.length >= this.router.replicationFactor ? 'Healthy' : 'Under-replicated';
            console.log(`[Self-Healing] ✅ Successfully recovered replica for ${cid.slice(0, 12)} onto ${targetNode.name}`);
            this.pendingReplicationQueue.delete(cid);
          } else {
            throw new Error('New replica verification failed after write');
          }
        }
      } catch (repairErr) {
        console.warn(`[Self-Healing] ⚠️ Recovery failed for ${cid.slice(0, 12)}:`, repairErr.message);
        this.auditErrors.push(`Failed to repair ${cid.slice(0, 8)}: ${repairErr.message}`);
        record.health = 'Under-replicated';
      } finally {
        this.repairInProgress.delete(cid);
        this.persistRegistry();
        this.notify();
      }
    }
  }

  /**
   * Connect a real remote peer device on local Wi-Fi
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
        storageDir: telemetry.storagePath || `HiveNet Storage on ${ip}`,
        storedCids: new Set(),
      };

      if (existingIndex >= 0) {
        this.nodes[existingIndex] = peerNode;
      } else {
        this.nodes.push(peerNode);
      }

      this.notify();

      // Whenever a peer connects, trigger the repair engine in case items are waiting
      this.processPendingRepairs();

      return { success: true, node: peerNode };
    } catch (err) {
      throw new Error(`Failed to reach peer at ${ip}:${port}: ${err.message}`);
    }
  }

  /**
   * Open the physical local storage folder in Windows File Explorer
   */
  async openLocalStorageFolder(nodeId) {
    if (this.isElectron) {
      return await window.hiveNative.openStorageFolder(nodeId);
    }
    alert('Local file explorer is available when running the HiveNet desktop application.');
    return { success: false };
  }

  /**
   * Dispatch compressed & password-encrypted image to nodes selected by Smart Router
   */
  async uploadAndRoute(compressedResult, password) {
    const { cid, compressedBlob, arrayBuffer, originalName, originalSize, compressedSize, compressionRatio, dimensions, previewUrl } = compressedResult;

    if (!password || password.trim().length === 0) {
      throw new Error('Please enter a storage password to protect your photo before upload.');
    }

    // 1. Client-side Authenticated Encryption (AES-256-GCM + PBKDF2)
    // Encrypt the compressed WebP buffer before network transmission
    const { encryptedBuffer, saltHex, ivHex } = await encryptPayload(arrayBuffer, password);
    const encryptedSize = encryptedBuffer.byteLength;
    const checksum = await computeSHA256(encryptedBuffer);

    // 2. Ask Smart Router for optimal nodes (evaluating disk, latency, uptime, load-balancing)
    const { selectedNodes, rankedNodes, decisionLog } = this.router.evaluateNodes(this.nodes, encryptedSize);

    // 3. Write encrypted data to each selected node physically
    const storePromises = selectedNodes.map(async (node) => {
      // Physical storage: If Electron is active, write encrypted chunk to local disk
      if (this.isElectron && (node.type === 'LOCAL_HOST' || node.type === 'EDGE_PEER')) {
        try {
          const uint8 = new Uint8Array(encryptedBuffer);
          await window.hiveNative.writeChunk(node.id, cid, uint8);
          console.log(`[HiveNet] ✅ Written encrypted ${cid.slice(0, 12)}... to local disk (${encryptedSize} bytes)`);
        } catch (err) {
          console.warn(`[HiveNet] ⚠️ Local disk write failed for node ${node.id}:`, err);
          throw new Error(`Failed to physically save to ${node.name}: ${err.message}`);
        }
      }

      // If it's a physical LAN peer, stream encrypted chunk via HTTP POST with checksum header
      if (node.type === 'PHYSICAL_LAN_PEER') {
        try {
          const resp = await fetch(`http://${node.ip}:${node.port}/api/store/${cid}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-expected-checksum': checksum,
            },
            body: new Uint8Array(encryptedBuffer),
            signal: AbortSignal.timeout(10000),
          });
          if (!resp.ok) throw new Error(`Peer returned status ${resp.status}`);
          console.log(`[HiveNet] ✅ Sent encrypted ${cid.slice(0, 12)}... to LAN peer ${node.ip}:${node.port}`);
        } catch (err) {
          console.warn(`[HiveNet] ⚠️ LAN peer write failed for ${node.ip}:`, err);
          throw new Error(`Failed to physically transfer to ${node.name}: ${err.message}`);
        }
      }

      // Update node telemetry
      node.storedChunksCount = (node.storedChunksCount || 0) + 1;
      node.storedChunksBytes = (node.storedChunksBytes || 0) + encryptedSize;
      node.availableDiskMB = Math.max(0, node.availableDiskMB - Math.ceil(encryptedSize / (1024 * 1024)));
      node.storedCids.add(cid);

      return node.id;
    });

    const storedReplicaIds = await Promise.all(storePromises);

    // 4. Save to Content-Addressable Registry
    const fileRecord = {
      cid,
      originalName,
      originalSize,
      compressedSize,
      encryptedSize,
      compressionRatio,
      dimensions,
      previewUrl,
      encryptedBuffer, // Cached for in-browser / test mode fallback
      isEncrypted: true,
      saltHex,
      ivHex,
      checksum,
      replicas: storedReplicaIds,
      timestamp: Date.now(),
      decisionLog,
      health: storedReplicaIds.length >= this.router.replicationFactor ? 'Healthy' : 'Under-replicated',
      lastVerified: Date.now(),
      isDeletedByUser: false,
    };

    this.cidRegistry.set(cid, fileRecord);
    this.persistRegistry();
    this.notify();

    return {
      success: true,
      cid,
      replicas: storedReplicaIds,
      checksum,
      decisionLog,
      fileRecord,
    };
  }

  /**
   * Ping a LAN peer to check if it's actually reachable.
   */
  async isPeerReachable(node) {
    if (node.type === 'LOCAL_HOST') return !node.isSimulatedOffline;
    if (node.isSimulatedOffline) return false;
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/telemetry`, {
        signal: AbortSignal.timeout(2000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Content-Addressable Retrieval with Password-Protected Decryption
   * - Downloads the encrypted file from primary or backup replica.
   * - Performs auto-failover if primary is offline.
   * - Decrypts client-side using the user-provided password.
   * - If password is wrong, throws an authentication error.
   */
  async retrieveAndDecryptImage(cid, password) {
    const record = this.cidRegistry.get(cid);
    if (!record) {
      throw new Error(`Content ID ${cid} not found in HiveNet registry`);
    }

    if (!password || password.trim().length === 0) {
      throw new Error('Storage password is required to decrypt this photo.');
    }

    const startTime = performance.now();
    let retrievedFrom = null;
    let failoverOccurred = false;
    let failedNode = null;
    let encryptedData = null;

    // Try each replica in order
    for (const nodeId of record.replicas) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const reachable = await this.isPeerReachable(node);

      if (!reachable) {
        failoverOccurred = true;
        failedNode = node;
        if (!node.isSimulatedOffline) {
          node.status = 'OFFLINE';
          this.notify();
        }
        continue;
      }

      // Fetch the encrypted chunk from this node
      try {
        if (node.type === 'LOCAL_HOST' && this.isElectron) {
          encryptedData = await window.hiveNative.readChunk(node.id, cid);
        } else if (node.type === 'PHYSICAL_LAN_PEER') {
          const resp = await fetch(`http://${node.ip}:${node.port}/api/retrieve/${cid}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (!resp.ok) throw new Error(`Peer returned status ${resp.status}`);
          encryptedData = await resp.arrayBuffer();
        } else if (record.encryptedBuffer) {
          encryptedData = record.encryptedBuffer;
        }

        if (encryptedData) {
          retrievedFrom = node;
          break;
        }
      } catch (fetchErr) {
        console.warn(`[HiveNet] Fetch failed from ${node.name}:`, fetchErr.message);
        failoverOccurred = true;
        failedNode = node;
        continue;
      }
    }

    if (!retrievedFrom || !encryptedData) {
      throw new Error(`All replica devices for photo ${record.originalName} are currently offline or unreachable!`);
    }

    // Checksum verification
    const retrievedChecksum = await computeSHA256(encryptedData);
    if (record.checksum && retrievedChecksum !== record.checksum) {
      throw new Error(`Data integrity violation! Checksum mismatch detected.`);
    }

    // Decrypt locally using the user password
    let decryptedBuffer;
    try {
      decryptedBuffer = await decryptPayload(encryptedData, password);
    } catch (decryptErr) {
      throw new Error(`Decryption failed: ${decryptErr.message}`);
    }

    const decryptedBlob = new Blob([decryptedBuffer], { type: 'image/webp' });
    const decryptedUrl = URL.createObjectURL(decryptedBlob);

    const elapsedMs = Math.round(performance.now() - startTime + retrievedFrom.latencyMs);

    return {
      cid,
      decryptedBlob,
      previewUrl: decryptedUrl,
      retrievedFrom,
      failoverOccurred,
      failedNode,
      latencyMs: elapsedMs,
      replicasCount: record.replicas.length,
      checksumVerified: true,
    };
  }

  /**
   * Delete image intentionally through HiveNet
   * Respects user request and prevents self-healing from recreating it.
   */
  async deleteImage(cid) {
    const record = this.cidRegistry.get(cid);
    if (!record) return false;

    record.isDeletedByUser = true;
    this.pendingReplicationQueue.delete(cid);

    // Physically delete from each replica device
    for (const nodeId of record.replicas) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (node.type === 'LOCAL_HOST' && this.isElectron) {
        try {
          await window.hiveNative.deleteChunk(node.id, cid);
        } catch (e) {}
      } else if (node.type === 'PHYSICAL_LAN_PEER') {
        try {
          await fetch(`http://${node.ip}:${node.port}/api/chunks/${cid}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(3000),
          });
        } catch (e) {}
      }
    }

    this.cidRegistry.delete(cid);
    this.persistRegistry();
    this.notify();
    return true;
  }

  /**
   * Simulate manual deletion of ONE replica on a specific node (for recovery testing)
   */
  async simulateDeleteReplica(cid, nodeId) {
    const record = this.cidRegistry.get(cid);
    if (!record) throw new Error('File not found');

    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error('Device not found');

    if (node.type === 'LOCAL_HOST' && this.isElectron) {
      await window.hiveNative.deleteChunk(node.id, cid);
    } else if (node.type === 'PHYSICAL_LAN_PEER') {
      await fetch(`http://${node.ip}:${node.port}/api/chunks/${cid}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(3000),
      });
    }

    // Trigger immediate health audit to detect missing copy and begin self-healing
    await this.auditReplicaHealth();
    return true;
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
      storageDir: `HiveNet Storage/edge-node-${count}`,
      storedCids: new Set(),
    };
    this.nodes.push(newNode);
    this.notify();
    this.processPendingRepairs();
    return newNode;
  }

  getAllFiles() {
    return Array.from(this.cidRegistry.values())
      .filter(f => !f.isDeletedByUser)
      .sort((a, b) => b.timestamp - a.timestamp);
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

    const healthyCount = Array.from(this.cidRegistry.values()).filter(f => f.health === 'Healthy').length;
    const underReplicatedCount = Array.from(this.cidRegistry.values()).filter(f => f.health === 'Under-replicated').length;
    const recoveringCount = Array.from(this.cidRegistry.values()).filter(f => f.health === 'Recovering').length;

    return {
      totalPooledDiskMB,
      totalPooledDiskGB: (totalPooledDiskMB / 1024).toFixed(2),
      activeNodesCount: activeNodes.length,
      totalNodesCount: this.nodes.length,
      totalFiles,
      totalReplicasStored,
      replicationFactor: this.router.replicationFactor,
      healthyCount,
      underReplicatedCount,
      recoveringCount,
      pendingRepairsCount: this.pendingReplicationQueue.size,
      lastHealthAudit: this.lastHealthAudit,
    };
  }
}

// Global singleton instance for easy React hook consumption
export const storageMesh = new StorageMeshManager();
