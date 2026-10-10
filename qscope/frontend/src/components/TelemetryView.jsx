import React, { useState, useRef } from 'react';
import { Upload, Play, Pause, ChevronRight, ChevronLeft, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import TelemetryChart from './TelemetryChart';
import { uploadCsv, analyzeWindow } from '../services/api';

export default function TelemetryView({
  windowData,
  setWindowData,
  analysisResult,
  setAnalysisResult,
  isAnalyzing,
  setIsAnalyzing,
  onAnalyze,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per window
  const [uploadStatus, setUploadStatus] = useState(null);
  const [currentWindowIdx, setCurrentWindowIdx] = useState(0);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // If no custom windowData, generate a realistic default 60-sample window
  const activeWindow = windowData || {
    window_id: currentWindowIdx,
    run_id: 'mission_run_01',
    timestamps: Array.from({ length: 60 }, (_, i) => i * 0.05),
    population: Array.from({ length: 60 }, (_, i) => 0.5 + 0.35 * Math.sin(i * 0.15) + (Math.random() - 0.5) * 0.02),
    phase_signal: Array.from({ length: 60 }, (_, i) => 0.45 * Math.sin(i * 0.15) + (Math.random() - 0.5) * 0.01),
    accel_x: Array.from({ length: 60 }, () => 0.002 + (Math.random() - 0.5) * 0.001),
    accel_y: Array.from({ length: 60 }, () => -0.001 + (Math.random() - 0.5) * 0.001),
    accel_z: Array.from({ length: 60 }, () => 9.80665 + (Math.random() - 0.5) * 0.005),
    contrast: Array.from({ length: 60 }, () => 0.88),
    atom_count: Array.from({ length: 60 }, () => 2000),
  };

  // Playback timer
  const togglePlay = () => {
    if (isPlaying) {
      clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      timerRef.current = setInterval(() => {
        setCurrentWindowIdx((prev) => {
          const nextIdx = prev + 1;
          const nextPop = Array.from({ length: 60 }, (_, i) => 0.5 + 0.35 * Math.sin((i + nextIdx * 10) * 0.15) + (Math.random() - 0.5) * 0.02);
          const nextPhase = Array.from({ length: 60 }, (_, i) => 0.45 * Math.sin((i + nextIdx * 10) * 0.15) + (Math.random() - 0.5) * 0.01);
          const updated = {
            window_id: nextIdx,
            run_id: 'live_stream',
            timestamps: Array.from({ length: 60 }, (_, i) => (nextIdx * 60 + i) * 0.05),
            population: nextPop,
            phase_signal: nextPhase,
            accel_x: Array.from({ length: 60 }, () => 0.002 + (Math.random() - 0.5) * 0.001),
            accel_y: Array.from({ length: 60 }, () => -0.001 + (Math.random() - 0.5) * 0.001),
            accel_z: Array.from({ length: 60 }, () => 9.80665 + (Math.random() - 0.5) * 0.005),
            contrast: Array.from({ length: 60 }, () => 0.88),
            atom_count: Array.from({ length: 60 }, () => 2000),
          };
          setWindowData(updated);
          onAnalyze(updated);
          return nextIdx;
        });
      }, playbackSpeed);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadStatus({ loading: true, msg: 'Uploading & segmenting CSV...' });
      const res = await uploadCsv(file);
      setUploadStatus({ success: true, msg: `Loaded ${res.total_records} records (${res.windows_created} windows)` });
      // Trigger analysis on window 0
      onAnalyze({ window_id: 0 });
    } catch (err) {
      setUploadStatus({ error: true, msg: err.message });
    }
  };

  const meanPop = activeWindow.population?.length
    ? (activeWindow.population.reduce((a, b) => a + b, 0) / activeWindow.population.length).toFixed(4)
    : '0.5000';

  const meanPhase = activeWindow.phase_signal?.length
    ? (activeWindow.phase_signal.reduce((a, b) => a + b, 0) / activeWindow.phase_signal.length).toFixed(4)
    : '0.0000';

  return (
    <div className="space-y-6">
      {/* Top Controls & Stream Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlay}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition shadow-xs active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-sky-600 hover:bg-sky-700 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE STREAM' : 'START LIVE STREAM'}</span>
          </button>

          <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => {
                const nextIdx = Math.max(0, currentWindowIdx - 1);
                setCurrentWindowIdx(nextIdx);
                onAnalyze({ window_id: nextIdx });
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition"
              title="Previous Window"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-2 font-medium text-slate-700">
              Window #{currentWindowIdx}
            </span>
            <button
              onClick={() => {
                const nextIdx = currentWindowIdx + 1;
                setCurrentWindowIdx(nextIdx);
                onAnalyze({ window_id: nextIdx });
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition"
              title="Next Window"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onAnalyze(activeWindow)}
            disabled={isAnalyzing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono rounded-lg transition border border-slate-300 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>Analyze Now</span>
          </button>
        </div>

        {/* Upload CSV */}
        <div className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono transition shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload Mission CSV</span>
          </button>

          {uploadStatus && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                uploadStatus.success
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : uploadStatus.error
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {uploadStatus.msg}
            </span>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">Active Window Size</span>
          <div className="text-xl font-bold font-mono text-slate-800 mt-1">
            {activeWindow.population?.length || 60} <span className="text-xs font-normal text-slate-500">samples</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">Mean Population p(t)</span>
          <div className="text-xl font-bold font-mono text-sky-700 mt-1">{meanPop}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">Phase Mean phi(t)</span>
          <div className="text-xl font-bold font-mono text-indigo-700 mt-1">{meanPhase} <span className="text-xs font-normal text-slate-500">rad</span></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">Atom Count Default</span>
          <div className="text-xl font-bold font-mono text-slate-800 mt-1">2000 <span className="text-xs font-normal text-slate-500">atoms</span></div>
        </div>
      </div>

      {/* Primary Telemetry Charts (Grid 2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atomic Population p(t) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <TelemetryChart
            data={activeWindow.population || []}
            label="Normalized Atomic Population P(t) ∈ [0, 1]"
            color="#0284c7"
            threshold={0.5}
            thresholdLabel="Offset p0"
            height={200}
            unit=""
          />
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Interferometer interference fringe: P(phi) = p0 + A * C * cos(phi + phi0)
          </p>
        </div>

        {/* Phase Reconstruction phi(t) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <TelemetryChart
            data={activeWindow.phase_signal || []}
            label="Reconstructed Phase phi(t) (rad)"
            color="#6366f1"
            threshold={0.0}
            thresholdLabel="Center"
            height={200}
            unit="rad"
          />
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Residual atomic phase after linear phase tracking extraction
          </p>
        </div>

        {/* Acceleration Tri-Axial Z (Gravity Axis) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <TelemetryChart
            data={activeWindow.accel_z || []}
            label="Inertial Acceleration Az (m/s²)"
            color="#0d9488"
            threshold={9.80665}
            thresholdLabel="1g Baseline"
            height={200}
            unit="m/s²"
          />
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Tri-axial accelerometer vibration telemetry along sensitive gravity axis
          </p>
        </div>

        {/* Fringe Contrast C(t) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <TelemetryChart
            data={activeWindow.contrast || []}
            label="Interference Fringe Contrast C(t)"
            color="#d97706"
            threshold={0.88}
            thresholdLabel="Nominal Contrast"
            height={200}
            unit=""
          />
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Fringe visibility envelope: nominal 0.88 contrast under laser cooling
          </p>
        </div>
      </div>
    </div>
  );
}
