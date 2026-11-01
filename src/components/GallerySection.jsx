import React, { useState } from 'react';
import { 
  Database, ShieldCheck, AlertOctagon, CheckCircle2, Clock, 
  HardDrive, Download, X, Lock, KeyRound, Eye, EyeOff, Trash2, 
  Activity, RefreshCw 
} from 'lucide-react';

export function GallerySection({ files, storageMesh }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [retrievalState, setRetrievalState] = useState(null);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedImageSrc, setDecryptedImageSrc] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const handleOpenModal = (file) => {
    setSelectedFile(file);
    setRetrievalState(null);
    setPasswordError(null);
    setDecryptedImageSrc(null);
    setPassword('');
  };

  const handleRetrieveAndDecrypt = async () => {
    if (!password || password.trim().length === 0) {
      setPasswordError('Please enter your storage password to decrypt this photo.');
      return;
    }

    setIsRetrieving(true);
    setPasswordError(null);
    setRetrievalState(null);

    try {
      const result = await storageMesh.retrieveAndDecryptImage(selectedFile.cid, password);
      setRetrievalState(result);
      setDecryptedImageSrc(result.previewUrl);
    } catch (err) {
      setPasswordError(err.message || 'Decryption failed: Incorrect password or corrupted payload');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleDeleteFile = async (cid) => {
    if (confirm('Are you sure you want to delete this photo from all devices? HiveNet self-healing will respect this deletion and will NOT restore it.')) {
      await storageMesh.deleteImage(cid);
      setSelectedFile(null);
    }
  };

  const getHealthBadge = (health) => {
    switch (health) {
      case 'Healthy':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ● Healthy (RF=2)
          </span>
        );
      case 'Under-replicated':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            ▲ Under-replicated
          </span>
        );
      case 'Recovering':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" />
            <span>Recovering</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            ✕ Failed
          </span>
        );
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
            Drop photos in the "Upload Photos" tab. They are compressed, encrypted with AES-256-GCM and stored across 2 connected devices in "Documents/HiveNet Storage".
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
            Encrypted photos saved across your hardware fleet. Click any photo to enter your password, test live decryption and verify replica health.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            {files.length} Saved Photos
          </span>
        </div>
      </div>

      {/* Grid of Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {files.map((file) => {
          return (
            <div
              key={file.cid}
              onClick={() => handleOpenModal(file)}
              className="group cursor-pointer rounded-2xl glass-panel glass-panel-hover overflow-hidden transition-all duration-200 border border-white/90"
            >
              {/* Image Preview / Lock Overlay */}
              <div className="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt={file.originalName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                  />
                ) : (
                  <div className="text-slate-500 flex flex-col items-center space-y-1">
                    <Lock className="h-8 w-8 text-sky-400" />
                    <span className="text-[11px] font-mono">Encrypted Payload</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  {getHealthBadge(file.health || 'Healthy')}
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-[10px] font-bold text-sky-300 flex items-center space-x-1">
                  <Lock className="h-2.5 w-2.5" />
                  <span>AES-256</span>
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="max-w-[80%]">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{file.originalName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      CID: {file.cid.substring(0, 16)}...
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {((file.compressedSize || file.originalSize) / 1024).toFixed(0)} KB
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span>Replicas ({file.replicas.length}/2):</span>
                    <span className="text-slate-500 lowercase">
                      {file.lastVerified ? `verified ${new Date(file.lastVerified).toLocaleTimeString()}` : ''}
                    </span>
                  </div>
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

      {/* Retrieval & Decryption Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{selectedFile.originalName}</h3>
                  <p className="text-xs text-slate-500">Encrypted P2P Retrieval & Local Decryption</p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteFile(selectedFile.cid)}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 flex items-center space-x-1 transition-colors"
                title="Delete this photo from all devices"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Photo</span>
              </button>
            </div>

            {/* Password Entry Box if not yet decrypted */}
            {!decryptedImageSrc && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                    <span>Enter Storage Password to Decrypt:</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Storage peers hold only AES-256 ciphertext. Your password is used client-side to decrypt the original photo.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Enter decryption password..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRetrieveAndDecrypt();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={handleRetrieveAndDecrypt}
                    disabled={isRetrieving}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 shrink-0"
                  >
                    {isRetrieving ? (
                      <>
                        <Clock className="h-3.5 w-3.5 animate-spin" />
                        <span>Decrypting...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Decrypt Photo</span>
                      </>
                    )}
                  </button>
                </div>

                {passwordError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 animate-in fade-in">
                    <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                    <div>{passwordError}</div>
                  </div>
                )}
              </div>
            )}

            {/* Retrieval Result Alert */}
            {retrievalState?.failoverOccurred ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>OFFLINE PROTECTION SUCCESS: AUTO-FAILOVER TRIGGERED!</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Primary device <span className="font-semibold text-red-700">[{retrievalState.failedNode?.name}]</span> was unreachable.
                  The router automatically fetched the ciphertext from backup device <span className="font-semibold text-emerald-800">[{retrievalState.retrievedFrom?.name}]</span> in{' '}
                  <span className="font-bold">{retrievalState.latencyMs}ms</span> and decrypted with <strong>0% data loss</strong>!
                </p>
              </div>
            ) : retrievalState ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Ciphertext fetched from <span className="font-bold">{retrievalState.retrievedFrom?.name}</span> in{' '}
                    <span className="font-bold">{retrievalState.latencyMs}ms</span> & verified via SHA-256.
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Decrypted ✓
                </span>
              </div>
            ) : null}

            {/* Decrypted Photo Preview */}
            <div className="rounded-2xl overflow-hidden bg-slate-900 min-h-[200px] max-h-72 flex items-center justify-center border border-slate-200">
              {decryptedImageSrc ? (
                <img
                  src={decryptedImageSrc}
                  alt={selectedFile.originalName}
                  className="max-h-72 w-auto object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-400">
                  <Lock className="h-10 w-10 mx-auto text-sky-400/80" />
                  <p className="text-xs font-medium">This photo is locked with AES-256-GCM encryption.</p>
                  <p className="text-[11px] text-slate-500">Enter the storage password above to view the decrypted image.</p>
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">
                CID: {selectedFile.cid.substring(0, 20)}...
              </span>
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>SHA-256 Checksum Verified</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
