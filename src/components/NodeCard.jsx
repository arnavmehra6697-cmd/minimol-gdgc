import React from 'react';
import { Laptop, Smartphone, Server, HardDrive, Wifi, Clock, Power, ShieldAlert, CheckCircle2, Trash2, FolderOpen } from 'lucide-react';

export function NodeCard({ node, onToggleOffline, onRemoveNode, onOpenStorageFolder }) {
  const isOnline = node.status === 'ONLINE' && !node.isSimulatedOffline;
  const isHost = node.type === 'LOCAL_HOST';
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
    <div className={`glass-panel glass-panel-hover rounded-2xl overflow-hidden transition-all duration-200 ${
      isOnline ? 'border-white/90' : 'border-red-200 bg-red-50/40'
    }`}>
      {/* Top Banner Status */}
      <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
        isOnline
          ? 'bg-emerald-50/80 text-emerald-800 border-emerald-100'
          : 'bg-red-100 text-red-800 border-red-200'
      }`}>
        <div className="flex items-center space-x-2">
          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{isOnline ? 'Active & Sharing Storage' : 'Device Turned Off (Simulated)'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[11px] text-slate-500">{node.ip}:{node.port}</span>
          {!isHost && onRemoveNode && (
            <button
              onClick={() => onRemoveNode(node.id)}
              className="text-[10px] text-red-600 hover:text-red-800 font-bold px-1.5 py-0.2 rounded bg-red-100 hover:bg-red-200 border border-red-300 transition-colors"
              title="Remove Device from Display"
            >
              ✕ Remove
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Device Name & Unpair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${
              isOnline
                ? 'bg-sky-50 text-sky-600 border-sky-100'
                : 'bg-red-100 text-red-600 border-red-200'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-bold text-sm text-slate-900">{node.name}</h3>
                {isHost && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-semibold">
                    Host
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">{node.id}</p>
            </div>
          </div>

          {!isHost && onRemoveNode && (
            <button
              onClick={() => onRemoveNode(node.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Unpair / Remove Device"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Visible Physical Storage Location Banner */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Physical Storage Path:</span>
            {isHost && onOpenStorageFolder && (
              <button
                onClick={() => onOpenStorageFolder(node.id)}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold transition-colors"
                title="Open this physical folder in Windows Explorer"
              >
                <FolderOpen className="h-3 w-3 text-sky-600" />
                <span>Open Storage Folder</span>
              </button>
            )}
          </div>
          <p className="font-mono text-[11px] text-slate-700 break-all bg-white px-2 py-1 rounded border border-slate-100 select-all">
            {node.storageDir || `HiveNet Storage/${node.id}`}
          </p>
        </div>

        {/* Free Storage Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Free Hard Drive Space:</span>
            <span className="font-bold text-slate-900">{(freeMB / 1024).toFixed(1)} GB Free</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                isOnline ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-red-400'
              }`}
              style={{ width: `${Math.max(8, usedPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{node.storedChunksCount || 0} copies saved</span>
            <span>Used: {usedMB} MB</span>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center space-x-1 text-slate-500 mb-0.5">
              <Wifi className="h-3.5 w-3.5 text-sky-600" />
              <span>Connection Speed</span>
            </div>
            <div className={`font-bold text-sm ${
              !isOnline ? 'text-red-500 line-through' : node.latencyMs < 20 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {isOnline ? `Fast (${node.latencyMs}ms lag)` : 'Unreachable'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center space-x-1 text-slate-500 mb-0.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Reliability</span>
            </div>
            <div className="font-bold text-sm text-slate-800">
              {isOnline ? formatUptime(node.uptimeSeconds) : '0s'}
            </div>
          </div>
        </div>

        {/* Actions Button Row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onToggleOffline(node.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              isOnline
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{isOnline ? 'Turn Off (Test)' : 'Turn On'}</span>
          </button>

          {!isHost && onRemoveNode && (
            <button
              onClick={() => onRemoveNode(node.id)}
              className="py-2 px-3 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center space-x-1"
              title="Unpair and remove this device from HiveNet"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Unpair</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
