import React from 'react';
import { Database, ShieldCheck, Activity, HardDrive, Wifi, Radio } from 'lucide-react';

export function Header({ activeTab, setActiveTab, meshStats }) {
  const tabs = [
    { id: 'nodes', label: 'Mesh Topology & Nodes', icon: Radio },
    { id: 'upload', label: 'Upload & Smart Router', icon: HardDrive },
    { id: 'gallery', label: 'Content Gallery', icon: Database },
    { id: 'benchmark', label: 'Judge Resilience Test', icon: ShieldCheck },
    { id: 'lan', label: 'LAN Peer Connect', icon: Wifi },
  ];

  return (
    <header className="border-b border-dark-750 bg-dark-850/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              <span className="text-xl font-black text-dark-900 tracking-tighter">HN</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg text-white tracking-tight">HiveNet</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Standalone v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Decentralized Edge Cloud Drive & Smart Router</p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center space-x-6 text-xs">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">Mesh Status:</span>
              <span className="font-semibold text-emerald-400">
                {meshStats.activeNodesCount} / {meshStats.totalNodesCount} Nodes Online
              </span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
              <HardDrive className="h-4 w-4 text-amber-400" />
              <span className="text-slate-400">Pooled Disk:</span>
              <span className="font-semibold text-slate-100">{meshStats.totalPooledDiskGB} GB</span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400">Replication:</span>
              <span className="font-semibold text-blue-400">Factor = 2 (Enforced)</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-4 border-t border-dark-750/50 py-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-dark-900 font-semibold shadow-md shadow-amber-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-dark-900' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.id === 'gallery' && meshStats.totalFiles > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-dark-900 text-amber-300' : 'bg-dark-700 text-slate-300'
                  }`}>
                    {meshStats.totalFiles}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
