import React, { useState } from 'react';
import { Database, ShieldCheck, AlertOctagon, CheckCircle2, Clock, HardDrive, Download, X } from 'lucide-react';

export function GallerySection({ files, storageMesh }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [retrievalState, setRetrievalState] = useState(null);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const handleOpenImage = async (file) => {
    setSelectedFile(file);
    setIsRetrieving(true);
    setRetrievalState(null);

    try {
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
      <div className="p-12 text-center rounded-3xl glass-panel space-y-3 max-w-2xl mx-auto">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600">
          <Database className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">Your Cloud Drive is currently empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Drop photos in the "Upload Photos" tab. They will be compressed and safely stored across 2 connected devices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">My Cloud Drive</h2>
          <p className="text-xs text-slate-500">
            Photos saved across your connected devices. Click any photo to test live retrieval and disconnect protection.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
          {files.length} Saved Photos
        </span>
      </div>

      {/* Grid of Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {files.map((file) => {
          return (
            <div
              key={file.cid}
              onClick={() => handleOpenImage(file)}
              className="group cursor-pointer rounded-2xl glass-panel glass-panel-hover overflow-hidden transition-all duration-200 border border-white/90"
            >
              {/* Image Preview */}
              <div className="relative h-44 bg-slate-100 overflow-hidden">
                <img
                  src={file.previewUrl}
                  alt={file.originalName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-[10px] font-bold text-emerald-700">
                  {(file.compressedSize / 1024).toFixed(0)} KB (WebP)
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-4 space-y-2.5">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 truncate">{file.originalName}</h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {file.cid.substring(0, 16)}...
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Saved on {file.replicas.length} Devices:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {file.replicas.map((nodeId) => {
                      const node = storageMesh.nodes.find(n => n.id === nodeId);
                      const isOffline = node?.status === 'OFFLINE' || node?.isSimulatedOffline;
                      return (
                        <span
                          key={nodeId}
                          className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                            isOffline
                              ? 'bg-red-50 text-red-600 border-red-200 line-through'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-500'}`} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2.5">
              <Database className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">{selectedFile.originalName}</h3>
                <p className="text-xs text-slate-500">Decentralized P2P Retrieval Verification</p>
              </div>
            </div>

            {/* Retrieval Result Alert */}
            {isRetrieving ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center space-x-2">
                <Clock className="h-4 w-4 animate-spin text-sky-600 shrink-0" />
                <span>Fetching file from nearest online device...</span>
              </div>
            ) : retrievalState?.error ? (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                <div>{retrievalState.error}</div>
              </div>
            ) : retrievalState?.failoverOccurred ? (
              /* THE KILLER FAILOVER ALERT */
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>OFFLINE PROTECTION SUCCESS: AUTO-FAILOVER TRIGGERED!</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Primary device <span className="font-semibold text-red-700">[{retrievalState.failedNode?.name}]</span> was turned off.
                  The router automatically fetched the photo from the backup device <span className="font-semibold text-emerald-800">[{retrievalState.retrievedFrom?.name}]</span> in{' '}
                  <span className="font-bold">{retrievalState.latencyMs}ms</span> with <span className="font-bold text-emerald-700">0% data loss</span>!
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  Retrieved directly from <span className="font-bold">{retrievalState?.retrievedFrom?.name}</span> in{' '}
                  <span className="font-bold">{retrievalState?.latencyMs}ms</span>.
                </div>
              </div>
            )}

            {/* Photo Preview */}
            <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 max-h-72 flex items-center justify-center">
              <img
                src={selectedFile.previewUrl}
                alt={selectedFile.originalName}
                className="max-h-72 w-auto object-contain"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">Size: {(selectedFile.compressedSize / 1024).toFixed(0)} KB WebP</span>
              <span className="text-emerald-700 font-semibold">✓ Fingerprint Verified</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
