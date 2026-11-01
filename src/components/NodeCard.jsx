import React from 'react';
import { Laptop, Smartphone, Server, HardDrive, Wifi, Clock, Power, ShieldAlert } from 'lucide-react';

export function NodeCard({ node, onToggleOffline }) {
  const isOnline = node.status === 'ONLINE' && !node.isSimulatedOffline;
  const usedMB = (node.storedChunksBytes / (1024 * 1024)).toFixed(1);
  const totalMB = node.totalDiskMB || 50000;
  const freeMB = node.availableDiskMB || 0;
  const usedPercent = Math.min(100, Math.round(((totalMB - freeMB) / totalMB) * 100));

  const getNodeIcon = () => {
    if (node.type === 'LOCAL_HOST') return Laptop;
    if (node.type === 'MOBILE_EDGE') return Smartphone;
    return Server;
  };

  const Icon = getNodeIcon();

  const formatUptime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
      isOnline
        ? 'bg-dark-850/90 border-dark-700 hover:border-amber-500/40 shadow-lg shadow-black/40'
        : 'bg-red-950/20 border-red-800/50 shadow-lg shadow-red-950/30'
    }`}>
      {/* Top Banner Status */}
      <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
        isOnline
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-red-500/15 text-red-400 border-red-500/20'
      }`}>
        <div className="flex items-center space-x-2">
          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
          <span>{isOnline ? 'ONLINE & POOLED' : 'DISCONNECTED / AIRPLANE MODE'}</span>
        </div>
        <span className="font-mono text-[11px] opacity-80">{node.ip}:{node.port}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Node Identity */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-lg border ${
              isOnline
                ? 'bg-dark-800 border-dark-700 text-amber-400'
                : 'bg-red-900/30 border-red-700/50 text-red-400'
            }`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white tracking-tight">{node.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{node.id}</p>
            </div>
          </div>
        </div>

        {/* Storage Bar Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 flex items-center space-x-1">
              <HardDrive className="h-3.5 w-3.5 text-amber-400" />
              <span>Available Disk Quota:</span>
            </span>
            <span className="font-mono font-bold text-slate-200">
              {(freeMB / 1024).toFixed(1)} GB Free
            </span>
          </div>
          <div className="w-full bg-dark-750 rounded-full h-2 overflow-hidden border border-dark-700">
            <div
              className={`h-full transition-all duration-500 ${
                isOnline ? 'bg-gradient-to-r from-amber-500 to-emerald-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(5, usedPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Replicas stored: {node.storedChunksCount || 0}</span>
            <span>Allocated: {usedMB} MB</span>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-dark-800/80 border border-dark-700/60">
            <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
              <Wifi className="h-3.5 w-3.5 text-blue-400" />
              <span>Network Latency</span>
            </div>
            <div className={`font-mono font-bold text-sm ${
              !isOnline ? 'text-red-400 line-through' : node.latencyMs < 20 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {isOnline ? `${node.latencyMs} ms` : 'Unreachable'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-dark-800/80 border border-dark-700/60">
            <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
              <Clock className="h-3.5 w-3.5 text-purple-400" />
              <span>Uptime Stability</span>
            </div>
            <div className="font-mono font-bold text-sm text-slate-200">
              {isOnline ? formatUptime(node.uptimeSeconds) : '0s (Terminated)'}
            </div>
          </div>
        </div>

        {/* Disk Path Info */}
        <div className="text-[11px] font-mono text-slate-500 bg-dark-900/50 p-2 rounded border border-dark-800 truncate">
          <span className="text-slate-400">Disk I/O: </span>
          {node.storageDir}
        </div>

        {/* Kill Switch Button */}
        <button
          onClick={() => onToggleOffline(node.id)}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            isOnline
              ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
              : 'bg-emerald-500 hover:bg-emerald-600 text-dark-900 font-bold shadow-lg shadow-emerald-500/20'
          }`}
        >
          <Power className="h-4 w-4" />
          <span>
            {isOnline ? 'Simulate Airplane Mode (Disconnect)' : 'Reconnect Node to Hive'}
          </span>
        </button>
      </div>
    </div>
  );
}
