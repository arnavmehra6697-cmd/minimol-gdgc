import React, { useState } from 'react';
import { Database, ShieldCheck, AlertOctagon, CheckCircle2, Clock, HardDrive, Download, ExternalLink, X } from 'lucide-react';

export function GallerySection({ files, storageMesh }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [retrievalState, setRetrievalState] = useState(null);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const handleOpenImage = async (file) => {
    setSelectedFile(file);
    setIsRetrieving(true);
    setRetrievalState(null);

    try {
      // Content-addressable retrieval with auto-failover
      const result = await storageMesh.retrieveImage(file.cid);
      setRetrievalState(result);
    } catch (err) {
      setRetrievalState({ error: err.message });
    } finally {
      setIsRetrieving(false);
    }
  };

  if (!files || files.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-dark-850/60 border border-dark-700/80 space-y-4">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500">
          <Database className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No images stored on the HiveNet mesh yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload photos in the "Upload & Smart Router" tab. They will be compressed, indexed by SHA-256 hash, and mirrored across at least 2 peer nodes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Decentralized Content Gallery</h2>
          <p className="text-xs text-slate-400">
            Content-addressable retrieval across peer devices. Click any image to test live P2P retrieval and disconnect failover.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Stored Images: <span className="font-bold text-amber-400">{files.length}</span>
        </div>
      </div>

      {/* Grid of Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {files.map((file) => {
          return (
            <div
              key={file.cid}
              onClick={() => handleOpenImage(file)}
              className="group cursor-pointer rounded-xl bg-dark-850 border border-dark-700 hover:border-amber-500/50 overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black/50"
            >
              {/* Image Preview */}
              <div className="relative h-44 bg-dark-900 overflow-hidden">
                <img
                  src={file.previewUrl}
                  alt={file.originalName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-dark-900/80 backdrop-blur border border-dark-700 text-[10px] font-mono text-emerald-400 font-bold">
                  {(file.compressedSize / 1024).toFixed(1)} KB (WebP)
                </div>
              </div>

              {/* Meta & Replicas Info */}
              <div className="p-4 space-y-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs text-white truncate">{file.originalName}</h4>
                  <p className="text-[10px] font-mono text-slate-500 truncate">
                    CID: {file.cid.substring(0, 16)}...{file.cid.substring(file.cid.length - 8)}
                  </p>
                </div>

                {/* Replicas Badges */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Stored on Replicas (RF = {file.replicas.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {file.replicas.map((nodeId, idx) => {
                      const node = storageMesh.nodes.find(n => n.id === nodeId);
                      const isOffline = node?.status === 'OFFLINE' || node?.isSimulatedOffline;
                      return (
                        <span
                          key={nodeId}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                            isOffline
                              ? 'bg-red-500/10 text-red-400 border-red-500/30 line-through'
                              : 'bg-dark-800 text-slate-300 border-dark-700'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-400'}`} />
                          <span>{node?.name || nodeId}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Retrieval Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-dark-850 border border-dark-700 overflow-hidden shadow-2xl space-y-4 p-6">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-amber-400" />
              <div>
                <h3 className="font-bold text-base text-white">{selectedFile.originalName}</h3>
                <p className="text-xs font-mono text-slate-400">Content-Addressable Verification</p>
              </div>
            </div>

            {/* Retrieval Status Banner */}
            {isRetrieving ? (
              <div className="p-4 rounded-xl bg-dark-800 border border-dark-700 text-xs text-amber-300 flex items-center space-x-3">
                <Clock className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
                <span>Querying peer mesh nodes for cryptographic hash...</span>
              </div>
            ) : retrievalState?.error ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-3">
                <AlertOctagon className="h-5 w-5 text-red-400 shrink-0" />
                <div>{retrievalState.error}</div>
              </div>
            ) : retrievalState?.failoverOccurred ? (
              /* THE KILLER DEMO BANNER: AUTO-FAILOVER TRIGGERED */
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 space-y-1">
                <div className="flex items-center space-x-2 font-bold text-amber-400">
                  <ShieldCheck className="h-5 w-5 text-amber-400 animate-bounce" />
                  <span>NODE DISCONNECT RESILIENCE: AUTO-FAILOVER TRIGGERED!</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Primary Node <span className="text-red-400 font-semibold">[{retrievalState.failedNode?.name}]</span> was unreachable (Airplane Mode / Terminated).
                  The router automatically routed request to <span className="text-emerald-400 font-semibold">[{retrievalState.retrievedFrom?.name}]</span> in{' '}
                  <span className="font-mono font-bold text-amber-300">{retrievalState.latencyMs} ms</span> with <span className="text-emerald-400 font-bold">0% data loss</span>!
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  Retrieved successfully from <span className="font-bold text-white">{retrievalState?.retrievedFrom?.name}</span> in{' '}
                  <span className="font-mono font-bold text-emerald-400">{retrievalState?.latencyMs} ms</span>.
                </div>
              </div>
            )}

            {/* Image Full View */}
            <div className="rounded-xl overflow-hidden bg-dark-900 border border-dark-800 max-h-80 flex items-center justify-center">
              <img
                src={selectedFile.previewUrl}
                alt={selectedFile.originalName}
                className="max-h-80 w-auto object-contain"
              />
            </div>

            {/* Cryptographic Details */}
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-800 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Content ID (SHA-256):</span>
                <span>Size: {(selectedFile.compressedSize / 1024).toFixed(1)} KB (WebP)</span>
              </div>
              <p className="font-mono text-[11px] text-amber-300 break-all select-all">
                {selectedFile.cid}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
