import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Cpu, FileImage, Sparkles } from 'lucide-react';
import { compressImage } from '../services/compressor.js';

export function UploadSection({ storageMesh, onUploadComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [routing, setRouting] = useState(false);
  const [compressionResult, setCompressionResult] = useState(null);
  const [routingResult, setRoutingResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPEG, WebP, etc.)');
      return;
    }

    setError(null);
    setCompressionResult(null);
    setRoutingResult(null);
    setCompressing(true);

    try {
      // Step 1: Mandatory Client-Side WebP Compression
      const compRes = await compressImage(file);
      setCompressionResult(compRes);
      setCompressing(false);

      // Step 2: Query Smart Router & Store with Replication Factor = 2
      setRouting(true);
      const routeRes = await storageMesh.uploadAndRoute(compRes);
      setRoutingResult(routeRes);
      setRouting(false);

      if (onUploadComplete) onUploadComplete(routeRes);
    } catch (err) {
      setError(err.message || 'Failed to process and route image');
      setCompressing(false);
      setRouting(false);
    }
  };

  // Helper to load sample test images for quick hackathon demo
  const loadSampleImage = async (type = 'nature') => {
    // Generate a simple high-res canvas image dynamically to avoid network dependency
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');

    // Draw rich gradient and pattern
    const grad = ctx.createLinearGradient(0, 0, 1600, 1200);
    grad.addColorStop(0, type === 'nature' ? '#065f46' : '#1e3a8a');
    grad.addColorStop(0.5, type === 'nature' ? '#10b981' : '#3b82f6');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1200);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(`HiveNet Edge Test Image (${type.toUpperCase()})`, 100, 300);
    ctx.font = '36px monospace';
    ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 100, 400);
    ctx.fillText('Replication Target: RF >= 2 across decentralized peers', 100, 480);

    canvas.toBlob((blob) => {
      const file = new File([blob], `hivenet-test-${type}-${Date.now()}.png`, { type: 'image/png' });
      processFile(file);
    }, 'image/png');
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
            : 'border-dark-700 bg-dark-850/60 hover:border-amber-500/50 hover:bg-dark-800/80'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <UploadCloud className="h-8 w-8 animate-bounce" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Drop your photo here, or <span className="text-amber-400 underline">browse files</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Client-side WebP compression will downscale & optimize bytes before dispatching to the 2 highest-scoring peer nodes.
            </p>
          </div>

          {/* Demo Quick-Test Buttons */}
          <div className="pt-2 flex flex-wrap gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-slate-500 self-center mr-1">Quick Demo:</span>
            <button
              onClick={() => loadSampleImage('nature')}
              className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-xs text-amber-300 font-medium flex items-center space-x-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Generate Test Image A</span>
            </button>
            <button
              onClick={() => loadSampleImage('tech')}
              className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-xs text-blue-300 font-medium flex items-center space-x-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Generate Test Image B</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Loading States */}
      {(compressing || routing) && (
        <div className="p-6 rounded-xl bg-dark-850 border border-dark-700 space-y-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <Cpu className="h-5 w-5 text-amber-400 animate-spin" />
            <span className="text-sm font-semibold text-white">
              {compressing ? 'Executing Client-Side WebP Compression & SHA-256 Hashing...' : 'Smart Router Evaluating Peer Telemetry & Routing Chunks...'}
            </span>
          </div>
          <div className="w-full bg-dark-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-full w-2/3 animate-pulse" />
          </div>
        </div>
      )}

      {/* Results Breakdown Grid */}
      {compressionResult && routingResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Client-Side Compression Audit */}
          <div className="p-5 rounded-xl bg-dark-850 border border-dark-700 space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h4 className="font-bold text-sm text-white">1. Client-Side Compression Audit</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Rule Met: Mandatory Compression
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <img
                src={compressionResult.previewUrl}
                alt="Compressed preview"
                className="h-20 w-20 rounded-lg object-cover border border-dark-700 shrink-0"
              />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-white truncate max-w-xs">{compressionResult.originalName}</p>
                <p className="text-slate-400">Dimensions: {compressionResult.dimensions.width} × {compressionResult.dimensions.height}px</p>
                <div className="flex items-center space-x-2 pt-1 font-mono">
                  <span className="text-slate-400 line-through">{(compressionResult.originalSize / 1024).toFixed(1)} KB</span>
                  <ArrowRight className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">{(compressionResult.compressedSize / 1024).toFixed(1)} KB</span>
                  <span className="text-amber-400 font-bold">({compressionResult.compressionRatio}% saved)</span>
                </div>
              </div>
            </div>

            {/* Content Addressable CID */}
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cryptographic Content ID (SHA-256 CID):
              </span>
              <p className="font-mono text-xs text-amber-300 break-all select-all">
                {compressionResult.cid}
              </p>
            </div>
          </div>

          {/* Card 2: Smart Router Decision Breakdown */}
          <div className="p-5 rounded-xl bg-dark-850 border border-dark-700 space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
                <h4 className="font-bold text-sm text-white">2. Smart Router Decision Engine</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Replication Factor = 2
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-dark-900/60 p-2.5 rounded-lg border border-dark-800">
              💡 {routingResult.decisionLog.reasoning}
            </p>

            {/* Ranked Nodes Table */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400">Node Evaluation Scores:</span>
              <div className="space-y-1.5">
                {routingResult.decisionLog.rankings.map((rn, idx) => {
                  const isChosen = routingResult.replicas.includes(rn.id);
                  return (
                    <div
                      key={rn.id}
                      className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                        isChosen
                          ? 'bg-amber-500/10 border-amber-500/30 text-white font-medium'
                          : 'bg-dark-900 border-dark-800 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`h-2 w-2 rounded-full ${isChosen ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
                        <span className="font-semibold">{rn.name}</span>
                        {isChosen && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400 text-dark-900 font-bold">
                            REPLICA {idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 font-mono text-[11px]">
                        <span>Disk: {(rn.diskMB / 1024).toFixed(1)}GB</span>
                        <span>Ping: {rn.latencyMs}ms</span>
                        <span className="font-bold text-amber-400">Score: {rn.score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
