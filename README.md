# 🐝 HiveNet — Decentralized Edge Cloud Storage & Smart Router

> **Built for GDGC Hackathon**  
> *A serverless, peer-to-peer cloud storage standalone desktop application where connected devices (smartphones, laptops, edge nodes) pool their local filesystem storage into a unified, decentralized cloud drive.*

---

## 📌 Problem Overview & Core Mandates

Centralized cloud storage (Google Drive, AWS S3) suffers from single points of failure, expensive recurring costs, and vulnerability to network partitions. Meanwhile, everyday consumer laptops and phones sit with gigabytes of unused hard drive storage.

**HiveNet solves this by pooling local filesystem storage across devices with an intelligent, telemetry-aware storage router.**

### 🎯 Hard Requirements Satisfied:
1. **Standalone App Execution:** Runs as an installable/runnable native desktop application (Electron) with direct native disk I/O (`.hivenet_storage/`). Strictly NO browser tabs.
2. **Decentralized Storage:** Files physically reside on the local hard drives of peer devices. No AWS S3, Firebase, or central cloud databases.
3. **Mandatory Client-Side Compression:** Images are compressed client-side to modern WebP with aspect-ratio downscaling before network dispatch (>85% bandwidth reduction).
4. **Smart Telemetry Router:** Evaluates peer telemetry (Available Disk Quota, Latency/Ping, Uptime Stability, and Anti-Monopoly Load Balancing) using a composite fitness score equation.
5. **Replication Factor $\ge$ 2:** Every file is mirrored across at least 2 distinct peer nodes.
6. **Content-Addressable Retrieval:** Files are addressed and retrieved by their cryptographic **SHA-256 Content ID (CID)**.
7. **Node Disconnect Resilience:** If a primary node disconnects (Airplane Mode / battery dead), the router automatically fails over to the replica node with **0% data loss**.

---

## 🏛️ System Architecture

```
[ User Selects Photo (e.g. 5.2 MB PNG) ]
              │
              ▼
   STEP 1: Client-Side WebP Compression (Canvas/Offscreen)
   └─ Result: 340 KB WebP (93.4% bandwidth saved!)
              │
              ▼
   STEP 2: Cryptographic Content-Addressing
   └─ Hash: SHA-256 CID = "a8f3b92c4...e71"
              │
              ▼
   STEP 3: Smart Router Telemetry & Fitness Scoring
   └─ Evaluates active nodes across the mesh:
      Score_i = (0.45 * Disk_i) - (0.35 * Latency_i) + (0.20 * Uptime_i) - LoadPenalty_i
      ┌─ Node Host (This PC): 48.5 GB Free | 3ms Ping   ──► Score: 96.2 🏆 (Replica 1)
      ├─ Node Beta (Laptop):  36.2 GB Free | 14ms Ping  ──► Score: 89.4 🥈 (Replica 2)
      └─ Node Gamma (Mobile): 18.4 GB Free | 28ms Ping  ──► Score: 78.1 🥉
              │
              ▼
   STEP 4: Dispatch & Native Physical Disk Persistence (RF = 2)
      ├─ Replica 1 ──► [ Node Host: ~/.hivenet_storage/node_host/<CID>.webp ]
      └─ Replica 2 ──► [ Node Beta: ~/.hivenet_storage/node_beta/<CID>.webp ]
              │
              ▼
   STEP 5: Content-Addressable Gallery & Failover Demo
      └─ User clicks photo in Gallery → Queries CID across mesh
      └─ Kill-Switch Test: Disconnect Node Host → Instant Auto-Failover to Node Beta!
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js:** v18+ or v20+ (Tested on Node.js v26)
- **npm:** Included with Node.js

### 1. Clone & Install
```bash
git clone https://github.com/arnavmehra6697-cmd/minimol-gdgc.git
cd minimol-gdgc
npm install
```

### 2. Launch HiveNet Standalone Desktop App
```bash
npm start
```
*This starts the background P2P storage daemon, the Vite frontend, and launches the native Electron desktop window.*

*(Optional) To preview in browser mode only:*
```bash
npm run dev:ui
```

---

## 🌐 Connecting Multiple Laptops on Local Wi-Fi

1. Run HiveNet on **Laptop 1** (`npm start`). It shows: `Listening on http://192.168.1.X:4001`.
2. Run HiveNet on **Laptop 2** (`npm start`).
3. In Laptop 2's app, open the **"LAN Peer Connect"** tab:
   - Enter Laptop 1's IP address and Port (`4001`).
   - Click **"Join Peer into HiveNet"**.
4. Both laptops are now paired in a real physical mesh! Uploading a photo on Laptop 1 streams a replica straight to Laptop 2's hard drive.

---


## 👥 Team
- **Arnav Mehra** & Team
