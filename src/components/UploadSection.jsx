import React, { useState, useRef } from 'react';
import { 
  UploadCloud, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, 
  Cpu, Sparkles, Sliders, Lock, Eye, EyeOff, ShieldAlert, KeyRound 
} from 'lucide-react';
import { compressImage } from '../services/compressor.js';

export function UploadSection({ storageMesh, onUploadComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [routing, setRouting] = useState(false);
  const [compressionResult, setCompressionResult] = useState(null);
  const [routingResult, setRoutingResult] = useState(null);
  const [error, setError] = useState(null);
  const [routerPriority, setRouterPriority] = useState('balanced'); // 'balanced' | 'speed' | 'storage'
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    if (!password || password.trim().length === 0) {
      setError('Privacy Requirement: Please enter a storage password below before uploading. Your photo is encrypted with AES-256 before leaving your laptop.');
      return;
    }

    setError(null);
    setCompressionResult(null);
    setRoutingResult(null);
    setCompressing(true);

    try {
      // 1. Client-Side WebP Compression
      const compRes = await compressImage(file);
      setCompressionResult(compRes);
      setCompressing(false);

      // 2. Adjust Router Weights based on User Policy Preference
      if (routerPriority === 'speed') {
        storageMesh.router.weights = { disk: 0.20, latency: 0.60, uptime: 0.20 };
      } else if (routerPriority === 'storage') {
        storageMesh.router.weights = { disk: 0.70, latency: 0.15, uptime: 0.15 };
      } else {
        storageMesh.router.weights = { disk: 0.45, latency: 0.35, uptime: 0.20 };
      }

      // 3. Smart Route, Client-Side AES-256-GCM Encryption & Physical Storage
      setRouting(true);
      const routeRes = await storageMesh.uploadAndRoute(compRes, password);
      setRoutingResult(routeRes);
      setRouting(false);

      if (onUploadComplete) onUploadComplete(routeRes);
    } catch (err) {
      setError(err.message || 'Failed to process, encrypt and route image');
      setCompressing(false);
      setRouting(false);
    }
  };

  // Helper to load sample test images for quick demo
  const loadSampleImage = async (type = 'nature') => {
    if (!password || password.trim().length === 0) {
      setPassword('HiveNetSecure2026!');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1600, 1200);
    grad.addColorStop(0, type === 'nature' ? '#38bdf8' : '#818cf8');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1200);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(`HiveNet Protected Photo (${type.toUpperCase()})`, 100, 300);
    ctx.font = '28px sans-serif';
    ctx.fillText(`Timestamp: ${new Date().toLocaleTimeString()}`, 100, 400);
    ctx.fillText('Encrypted with AES-256-GCM Before P2P Transfer', 100, 460);
    ctx.fillText('Automatic 2-Device Physical Backup Enabled', 100, 520);

    canvas.toBlob((blob) => {
      const file = new File([blob], `sample-${type}-${Date.now()}.png`, { type: 'image/png' });
      processFile(file);
    }, 'image/png');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Privacy & Password Protection Card */}
      <div className="glass-panel p-5 rounded-3xl bg-gradient-to-r from-sky-50/90 via-white to-blue-50/80 border border-sky-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900">
            <div className="p-2 rounded-xl bg-sky-600 text-white shadow-sm">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Client-Side Authenticated Encryption (AES-256-GCM)</h3>
              <p className="text-[11px] text-slate-500">
                Your photo is encrypted on your machine using PBKDF2 + AES-256 before network dispatch. Peer laptops only store ciphertext and cannot view the image.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            🔒 Zero-Knowledge Privacy
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter storage password to encrypt this photo..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPassword('HiveNetSecure2026!')}
            className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Use Demo Password
          </button>
        </div>

        <div className="flex items-start space-x-1.5 text-[10px] text-amber-700 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200/80">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Important Privacy Rule:</strong> We never log or store your password on any server or peer device. Remember this password; without it, your photo cannot be decrypted.
          </span>
        </div>
      </div>

      {/* Policy Selector Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Sliders className="h-4 w-4 text-sky-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-900">Smart Router Priority:</h4>
            <p className="text-[11px] text-slate-500">Choose what the router prioritizes when selecting backup devices.</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setRouterPriority('balanced')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              routerPriority === 'balanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚖️ Balanced (Auto)
          </button>
          <button
            onClick={() => setRouterPriority('speed')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              routerPriority === 'speed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚡ Fastest Speed
          </button>
          <button
            onClick={() => setRouterPriority('storage')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              routerPriority === 'storage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            💾 Most Free Space
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-sky-500 bg-sky-50 scale-[1.01]'
            : 'border-slate-300 bg-white/70 hover:border-sky-400 hover:bg-white shadow-sm'
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
          <div className="h-16 w-16 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-inner">
            <UploadCloud className="h-8 w-8 text-sky-600" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Drop your photo here, or <span className="text-sky-600 underline">browse files</span>
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Photos are compressed to WebP, encrypted client-side with AES-256, and physically written to "Documents/HiveNet Storage" on 2 devices.
            </p>
          </div>

          {/* Quick Demo Buttons */}
          <div className="pt-2 flex flex-wrap gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-slate-400 self-center mr-1">Quick Demo:</span>
            <button
              onClick={() => loadSampleImage('nature')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-medium flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>Sample Photo A</span>
            </button>
            <button
              onClick={() => loadSampleImage('tech')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-medium flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Sample Photo B</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Loading Bar */}
      {(compressing || routing) && (
        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex items-center space-x-2.5 text-xs font-semibold text-slate-800">
            <Cpu className="h-4 w-4 text-sky-600 animate-spin" />
            <span>
              {compressing
                ? 'Compressing photo to WebP format...'
                : 'Encrypting with AES-256 & smart routing to 2 storage devices...'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-sky-500 h-full w-2/3 animate-pulse" />
          </div>
        </div>
      )}

      {/* Results Breakdown */}
      {compressionResult && routingResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Compression & Encryption Audit */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-slate-900">Compression & Encryption Audit</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                AES-256-GCM Active
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <img
                src={compressionResult.previewUrl}
                alt="Preview"
                className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-slate-900 truncate max-w-xs">{compressionResult.originalName}</p>
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="text-slate-400 line-through">{(compressionResult.originalSize / 1024).toFixed(0)} KB</span>
                  <ArrowRight className="h-3 w-3 text-emerald-600" />
                  <span className="font-bold text-emerald-700">{(compressionResult.compressedSize / 1024).toFixed(0)} KB</span>
                  <span className="text-sky-700 font-bold">({compressionResult.compressionRatio}% saved)</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  Ciphertext: {((routingResult.fileRecord?.encryptedSize || 0) / 1024).toFixed(1)} KB (Encrypted)
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold uppercase">
                <span>Cryptographic SHA-256 Checksum:</span>
                <span className="text-emerald-700 font-bold">100% Exact</span>
              </div>
              <p className="font-mono text-[10px] text-slate-700 break-all select-all">
                {routingResult.checksum}
              </p>
            </div>
          </div>

          {/* Card 2: Router Decision */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h4 className="font-bold text-xs text-slate-900">Smart Router Choice</h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                routingResult.decisionLog.isUnderReplicated
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {routingResult.replicas.length} {routingResult.replicas.length === 1 ? 'Copy' : 'Copies'} Physically Stored
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/60">
              💡 {routingResult.decisionLog.reasoning}
            </p>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500">Physical Storage Targets:</span>
              {routingResult.decisionLog.rankings.map((rn, idx) => {
                const isChosen = routingResult.replicas.includes(rn.id);
                return (
                  <div
                    key={rn.id}
                    className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                      isChosen ? 'bg-sky-50 border-sky-200 text-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className={`h-2 w-2 rounded-full ${isChosen ? 'bg-sky-500' : 'bg-slate-300'}`} />
                      <span className="font-semibold">{rn.name}</span>
                      {isChosen && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-600 text-white font-bold">
                          PHYSICAL COPY {idx + 1}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-700">Score: {rn.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
