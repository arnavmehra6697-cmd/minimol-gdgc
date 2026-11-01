import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.jsx';
import { NodeCard } from './components/NodeCard.jsx';
import { UploadSection } from './components/UploadSection.jsx';
import { GallerySection } from './components/GallerySection.jsx';
import { BenchmarkSection } from './components/BenchmarkSection.jsx';
import { PeerConnectSection } from './components/PeerConnectSection.jsx';
import { storageMesh } from './services/storageMesh.js';
import { ShieldCheck, Plus, HardDrive, Wifi, Radio } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('nodes');
  const [meshStats, setMeshStats] = useState(storageMesh.getMeshStats());
  const [nodes, setNodes] = useState([...storageMesh.nodes]);
  const [files, setFiles] = useState(storageMesh.getAllFiles());

  useEffect(() => {
    // Subscribe to mesh updates (telemetry pings, uploads, offline toggles)
    const unsubscribe = storageMesh.subscribe(() => {
      setMeshStats(storageMesh.getMeshStats());
      setNodes([...storageMesh.nodes]);
      setFiles(storageMesh.getAllFiles());
    });
    return unsubscribe;
  }, []);

  const handleToggleOffline = (nodeId) => {
    storageMesh.toggleNodeOffline(nodeId);
  };

  const handleUploadComplete = () => {
    setFiles(storageMesh.getAllFiles());
    setActiveTab('gallery'); // Jump to gallery to showcase content-addressable result
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        meshStats={meshStats}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TAB 1: Mesh Topology & Node Fleet */}
        {activeTab === 'nodes' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                  <Radio className="h-5 w-5 text-amber-400" />
                  <span>Decentralized Device Mesh Fleet</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Multiple devices pooling physical storage into a serverless cloud drive. Test the red "Airplane Mode" button to verify resilience!
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-900 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-amber-500/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>Upload & Store</span>
                </button>
              </div>
            </div>

            {/* Node Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onToggleOffline={handleToggleOffline}
                />
              ))}
            </div>

            {/* Mesh Architecture Card */}
            <div className="p-6 rounded-2xl bg-dark-850/60 border border-dark-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>How HiveNet Dispatches Data (Replication Factor = 2):</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When an image is dropped, the client app compresses it to WebP and hashes it (SHA-256). 
                The <strong>Smart Router</strong> evaluates telemetry (disk quota, latency, and uptime) to pick the 
                <strong> two optimal peer devices</strong>. If one peer shuts off or goes into Airplane Mode, the second peer guarantees 
                instant content-addressable retrieval with <strong>0% data loss</strong>.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Upload & Smart Router */}
        {activeTab === 'upload' && (
          <div className="animate-in fade-in duration-200">
            <UploadSection
              storageMesh={storageMesh}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}

        {/* TAB 3: Content-Addressable Gallery */}
        {activeTab === 'gallery' && (
          <div className="animate-in fade-in duration-200">
            <GallerySection
              files={files}
              storageMesh={storageMesh}
            />
          </div>
        )}

        {/* TAB 4: Judge Resilience Benchmark */}
        {activeTab === 'benchmark' && (
          <div className="animate-in fade-in duration-200">
            <BenchmarkSection
              storageMesh={storageMesh}
            />
          </div>
        )}

        {/* TAB 5: LAN Peer Connect */}
        {activeTab === 'lan' && (
          <div className="animate-in fade-in duration-200">
            <PeerConnectSection
              storageMesh={storageMesh}
              onPeerAdded={() => {
                setNodes([...storageMesh.nodes]);
                setMeshStats(storageMesh.getMeshStats());
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-4 bg-dark-900/60 text-center text-xs text-slate-500">
        HiveNet Standalone Desktop Engine &bull; Decentralized P2P Cloud Storage &bull; Built for GDGC Hackathon
      </footer>
    </div>
  );
}
