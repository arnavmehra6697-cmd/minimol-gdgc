import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.jsx';
import { LandingHero } from './components/LandingHero.jsx';
import { NodeCard } from './components/NodeCard.jsx';
import { UploadSection } from './components/UploadSection.jsx';
import { GallerySection } from './components/GallerySection.jsx';
import { BenchmarkSection } from './components/BenchmarkSection.jsx';
import { PeerConnectSection } from './components/PeerConnectSection.jsx';
import { storageMesh } from './services/storageMesh.js';
import { Laptop, HardDrive, ShieldCheck, Database, Plus, Wifi } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'dashboard'
  const [activeTab, setActiveTab] = useState('drive');       // 'drive' | 'devices' | 'upload' | 'safety'
  const [meshStats, setMeshStats] = useState(storageMesh.getMeshStats());
  const [nodes, setNodes] = useState([...storageMesh.nodes]);
  const [files, setFiles] = useState(storageMesh.getAllFiles());

  useEffect(() => {
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

  const handleRemoveNode = (nodeId) => {
    try {
      storageMesh.removeNode(nodeId);
      setNodes([...storageMesh.nodes]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearDemoNodes = () => {
    storageMesh.clearAllDemoNodes();
    setNodes([...storageMesh.nodes]);
  };

  const handleAddDemoNode = () => {
    storageMesh.addDemoNode();
    setNodes([...storageMesh.nodes]);
  };

  const handleUploadComplete = () => {
    setFiles(storageMesh.getAllFiles());
    setCurrentView('dashboard');
    setActiveTab('drive'); // Jump to drive to showcase the saved photo
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        meshStats={meshStats}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW 1: Meaningful, Live Interactive Landing Hero */}
        {currentView === 'landing' && (
          <LandingHero
            meshStats={meshStats}
            nodes={nodes}
            onOpenDrive={() => {
              setCurrentView('dashboard');
              setActiveTab('drive');
            }}
            onOpenDevices={() => {
              setCurrentView('dashboard');
              setActiveTab('devices');
            }}
            onOpenSafety={() => {
              setCurrentView('dashboard');
              setActiveTab('safety');
            }}
            storageMesh={storageMesh}
          />
        )}

        {/* VIEW 2: Inner Clean Dashboard */}
        {currentView === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* TAB 1: My Cloud Drive */}
            {activeTab === 'drive' && (
              <GallerySection
                files={files}
                storageMesh={storageMesh}
              />
            )}

            {/* TAB 2: Connected Devices Fleet & Auto-Connect */}
            {activeTab === 'devices' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Connected Hardware Fleet</h2>
                    <p className="text-xs text-slate-500">
                      Devices sharing local hard drive space. Test the "Turn Off" button on any device to test backup resilience.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {nodes.length > 1 && (
                      <button
                        onClick={handleClearDemoNodes}
                        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors"
                        title="Remove all demo devices and keep only this machine"
                      >
                        Remove Demo Devices
                      </button>
                    )}
                    <button
                      onClick={handleAddDemoNode}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      + Add Test Device
                    </button>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Upload Photo</span>
                    </button>
                  </div>
                </div>

                {/* Device Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      onToggleOffline={handleToggleOffline}
                      onRemoveNode={handleRemoveNode}
                      onOpenStorageFolder={(nodeId) => storageMesh.openLocalStorageFolder(nodeId)}
                    />
                  ))}
                </div>

                {/* AirDrop 1-Click Connection Section */}
                <PeerConnectSection
                  storageMesh={storageMesh}
                  onPeerAdded={() => {
                    setNodes([...storageMesh.nodes]);
                    setMeshStats(storageMesh.getMeshStats());
                  }}
                />
              </div>
            )}

            {/* TAB 3: Upload Photos & Smart Router */}
            {activeTab === 'upload' && (
              <UploadSection
                storageMesh={storageMesh}
                onUploadComplete={handleUploadComplete}
              />
            )}

            {/* TAB 4: Safety & Disconnect Test */}
            {activeTab === 'safety' && (
              <BenchmarkSection
                storageMesh={storageMesh}
              />
            )}
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 py-4 bg-white/60 text-center text-xs text-slate-500">
        HiveNet Edge Drive &bull; Decentralized Storage Pooled Across Everyday Devices &bull; Built for GDGC Hackathon
      </footer>
    </div>
  );
}
