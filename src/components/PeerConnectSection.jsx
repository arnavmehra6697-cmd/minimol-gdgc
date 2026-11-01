import React, { useState } from 'react';
import { Wifi, Plus, Server, Laptop, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function PeerConnectSection({ storageMesh, onPeerAdded }) {
  const [peerIp, setPeerIp] = useState('');
  const [peerPort, setPeerPort] = useState('4001');
  const [peerName, setPeerName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!peerIp.trim()) return;

    setConnecting(true);
    setStatusMsg(null);

    try {
      const res = await storageMesh.connectRemotePeer(peerIp.trim(), parseInt(peerPort) || 4001, peerName.trim() || undefined);
      setStatusMsg({ type: 'success', text: `Successfully connected to peer [${res.node.name}] at ${peerIp}:${peerPort}!` });
      setPeerIp('');
      setPeerName('');
      if (onPeerAdded) onPeerAdded(res.node);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to reach peer node over network.' });
    } finally {
      setConnecting(false);
    }
  };

  const localHostNode = storageMesh.nodes.find(n => n.type === 'LOCAL_HOST') || storageMesh.nodes[0];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-dark-850 border border-dark-700 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Wifi className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">LAN Peer-to-Peer Mesh Connect</h2>
            <p className="text-xs text-slate-400">
              Connect multiple physical laptops/phones on the same Wi-Fi to pool storage across devices.
            </p>
          </div>
        </div>

        {/* Local Node Daemon Info */}
        <div className="p-4 rounded-xl bg-dark-900 border border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400">Your Local Storage Daemon Endpoint:</span>
            <div className="font-mono font-bold text-sm text-emerald-400 pt-0.5">
              http://{localHostNode.ip}:{localHostNode.port}
            </div>
            <p className="text-[11px] text-slate-500">Share your IP with your teammate so their app can join this mesh.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 self-start sm:self-center">
            ● DAEMON LISTENING
          </span>
        </div>

        {/* Peer Connect Form */}
        <form onSubmit={handleConnect} className="space-y-4 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Connect to Teammate's Laptop / Device:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Teammate IP Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.25"
                value={peerIp}
                onChange={(e) => setPeerIp(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Port</label>
              <input
                type="text"
                placeholder="4001"
                value={peerPort}
                onChange={(e) => setPeerPort(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Friendly Device Label (Optional)</label>
              <input
                type="text"
                placeholder="Teammate's Mac / Phone"
                value={peerName}
                onChange={(e) => setPeerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={connecting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-900 font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            {connecting ? <RefreshCw className="h-4 w-4 animate-spin text-dark-900" /> : <Plus className="h-4 w-4" />}
            <span>{connecting ? 'Pinging Peer...' : 'Join Peer into HiveNet'}</span>
          </button>
        </form>

        {statusMsg && (
          <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border border-red-500/30 text-red-300'
          }`}>
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Connected Physical Nodes List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Connected Mesh Network Topology ({storageMesh.nodes.length} Nodes):
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {storageMesh.nodes.map((node) => (
            <div key={node.id} className="p-3.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-dark-800 text-amber-400">
                  {node.type === 'LOCAL_HOST' ? <Laptop className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{node.name}</h4>
                  <p className="text-[10px] font-mono text-slate-400">{node.ip}:{node.port}</p>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                node.status === 'ONLINE' && !node.isSimulatedOffline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {node.status === 'ONLINE' && !node.isSimulatedOffline ? `${node.latencyMs}ms` : 'OFFLINE'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
