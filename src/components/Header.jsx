import React from 'react';
import { Cloud, HardDrive, ShieldCheck, Database, Laptop, Radio, ArrowLeft } from 'lucide-react';

export function Header({ currentView, setCurrentView, activeTab, setActiveTab, meshStats }) {
  const isDashboard = currentView === 'dashboard';

  const navItems = [
    { id: 'drive', label: 'My Cloud Drive', icon: Database },
    { id: 'devices', label: 'Connected Devices', icon: Laptop },
    { id: 'upload', label: 'Upload Photos', icon: HardDrive },
    { id: 'safety', label: 'Safety & Disconnect Test', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentView('landing')}
              className="flex items-center space-x-2.5 text-left group"
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base text-slate-900 tracking-tight">HiveNet</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                    Edge Drive
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">Decentralized P2P Storage</p>
              </div>
            </button>
          </div>

          {/* Center Cluster Status Pill */}
          <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 border border-slate-200 text-xs text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-900">{meshStats.activeNodesCount} Devices Online</span>
            <span className="text-slate-300">&bull;</span>
            <span>{meshStats.totalPooledDiskGB} GB Pooled</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-sky-700 font-medium">2 Copies Kept Safe</span>
          </div>

          {/* Right Navigation Controls */}
          <div className="flex items-center space-x-2">
            {!isDashboard ? (
              <button
                onClick={() => {
                  setCurrentView('dashboard');
                  setActiveTab('drive');
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5"
              >
                <span>Open Dashboard</span>
                <Database className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentView('landing')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors flex items-center space-x-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Overview</span>
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Tabs (When inside dashboard) */}
        {isDashboard && (
          <div className="flex space-x-2 border-t border-slate-200/60 py-2 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-sm shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
