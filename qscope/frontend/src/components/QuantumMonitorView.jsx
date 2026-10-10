import React, { useState } from 'react';
import { Cpu, Zap, Activity, AlertTriangle, CheckCircle2, RotateCcw, Wrench, ShieldAlert } from 'lucide-react';
import TelemetryChart from './TelemetryChart';
import { calibrateQuantum, resetQuantum, monitorQuantumWindow } from '../services/api';

export default function QuantumMonitorView({
  quantumStatus,
  analysisResult,
  onRefreshStatus,
}) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrateMsg, setCalibrateMsg] = useState(null);
  const [streamTrajectory, setStreamTrajectory] = useState([]);

  const health = analysisResult?.health_record;
  const features = health?.features || {
    mean: 0.5012,
    std: 0.0841,
    slope: 0.0003,
    abs_diff_mean: 0.0421,
  };

  const fidelity = health?.fidelity !== undefined ? health.fidelity : 0.9984;
  const fidelityLoss = health?.fidelity_loss !== undefined ? health.fidelity_loss : (1.0 - fidelity);
  const cusumScore = health?.cusum_score !== undefined ? health.cusum_score : 0.0;
  const cusumThreshold = health?.cusum_threshold !== undefined ? health.cusum_threshold : (quantumStatus?.h_default || 0.05);
  const hasAlert = health?.alert || (quantumStatus?.latched_alerts && Object.values(quantumStatus.latched_alerts).some(Boolean));

  // Compute angles roughly in [0, pi]
  const angles = [
    (Math.PI * Math.min(1, Math.max(0, (features.mean - 0.4) / 0.2))).toFixed(3),
    (Math.PI * Math.min(1, Math.max(0, features.std / 0.15))).toFixed(3),
    (Math.PI * Math.min(1, Math.max(0, (features.slope + 0.01) / 0.02))).toFixed(3),
    (Math.PI * Math.min(1, Math.max(0, features.abs_diff_mean / 0.1))).toFixed(3),
  ];

  const handleCalibrate = async () => {
    setIsCalibrating(true);
    setCalibrateMsg(null);
    try {
      const res = await calibrateQuantum(8, 'stream_telemetry');
      setCalibrateMsg({ success: true, text: `Calibrated with ${res.windows_used} windows. k=${res.k?.toFixed(4)}, h=${res.h?.toFixed(4)}` });
      if (onRefreshStatus) onRefreshStatus();
    } catch (err) {
      setCalibrateMsg({ error: true, text: err.message });
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetQuantum();
      if (onRefreshStatus) onRefreshStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Engine Status Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">4-Qubit Statevector Quantum Monitor</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Software statevector simulation | Overlap Fidelity F = |⟨ψ_ref|ψ_t⟩|² | Adaptive CUSUM S_t
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCalibrate}
            disabled={isCalibrating}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-mono font-semibold transition shadow-xs disabled:opacity-50"
          >
            <Wrench className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>{isCalibrating ? 'Calibrating...' : 'Calibrate Baseline'}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono transition shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset CUSUM</span>
          </button>
        </div>
      </div>

      {calibrateMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-mono border ${
            calibrateMsg.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {calibrateMsg.text}
        </div>
      )}

      {/* KPI Cards (Fidelity, Loss, CUSUM, Alert) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">State Overlap Fidelity (F)</span>
          <div className="text-2xl font-bold font-mono text-sky-700 mt-1">{(fidelity * 100).toFixed(2)}%</div>
          <span className="text-[11px] font-mono text-slate-400">Target: ~100% nominal</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">Fidelity Loss L = 1 - F</span>
          <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{fidelityLoss.toFixed(5)}</div>
          <span className="text-[11px] font-mono text-slate-400">Drift allowance k: {(quantumStatus?.k_default || 0.002).toFixed(4)}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500">CUSUM Statistic (S_t)</span>
          <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">{cusumScore.toFixed(5)}</div>
          <span className="text-[11px] font-mono text-slate-400">Threshold h: {cusumThreshold.toFixed(4)}</span>
        </div>

        <div className={`border rounded-xl p-4 shadow-xs transition ${
          hasAlert ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <span className="text-[11px] font-mono uppercase text-slate-500">Latch Status</span>
          <div className="flex items-center space-x-1.5 mt-1">
            {hasAlert ? (
              <>
                <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                <span className="text-base font-bold font-mono text-rose-700">LATCHED ALERT</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-bold font-mono text-emerald-700">NORMAL / CLEAR</span>
              </>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500">S_t {hasAlert ? '>' : '≤'} threshold</span>
        </div>
      </div>

      {/* 4-Wire Circuit Diagram Visualization */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">4-Wire Quantum Circuit Architecture</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            N_WIRES = 4 | RY(θ) Data Uploading → Fixed RY → CNOT Entanglement
          </span>
        </div>

        <div className="mt-4 p-4 bg-slate-900 rounded-lg overflow-x-auto text-white font-mono text-xs shadow-inner">
          <div className="space-y-4 min-w-[500px]">
            {[
              { wire: 0, feat: 'mean', val: features.mean, angle: angles[0], fixed: '0.15' },
              { wire: 1, feat: 'std', val: features.std, angle: angles[1], fixed: '0.30' },
              { wire: 2, feat: 'slope', val: features.slope, angle: angles[2], fixed: '0.45' },
              { wire: 3, feat: 'abs_diff', val: features.abs_diff_mean, angle: angles[3], fixed: '0.60' },
            ].map((q) => (
              <div key={q.wire} className="flex items-center space-x-3">
                <span className="w-8 text-sky-400 font-bold">|q{q.wire}⟩</span>
                <span className="text-slate-600">—</span>

                {/* RY Data Encoding Gate */}
                <div className="bg-sky-950 border border-sky-500/50 text-sky-300 px-2.5 py-1 rounded shadow-xs text-center min-w-[130px]">
                  <span className="block text-[10px] text-sky-400/80">RY({q.feat})</span>
                  <span className="font-bold text-sky-200">θ = {q.angle} rad</span>
                </div>

                <span className="text-slate-600">——</span>

                {/* Fixed Variational Gate */}
                <div className="bg-indigo-950 border border-indigo-500/50 text-indigo-300 px-2 py-1 rounded text-center min-w-[90px]">
                  <span className="block text-[10px] text-indigo-400/80">Fixed RY</span>
                  <span className="font-semibold text-indigo-200">{q.fixed} rad</span>
                </div>

                <span className="text-slate-600">——</span>

                {/* CNOT Entanglement */}
                <div className="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                  <span className="text-emerald-400 font-bold">CNOT</span>
                  <span className="text-slate-400 text-[10px]">
                    {q.wire < 3 ? `${q.wire} → ${q.wire + 1}` : 'Target'}
                  </span>
                </div>

                <span className="text-slate-600 flex-1 border-b border-dashed border-slate-700 mx-2" />

                {/* Output measurement */}
                <span className="text-slate-400 text-[11px]">|ψ_t({q.wire})⟩</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 font-mono mt-3">
          Statevector simulator prepares |ψ_t⟩ via NumPy tensor contractions. Overlap fidelity F = |⟨ψ_ref|ψ_t⟩|² evaluates deviation against healthy reference state.
        </p>
      </div>

      {/* Feature Normalization Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <h4 className="font-bold text-slate-900 text-sm mb-3">Extracted Vibration Features & Normalizer Mapping</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs">
            <span className="text-slate-500 block">1. Window Mean</span>
            <span className="text-sm font-bold text-slate-800">{features.mean.toFixed(5)}</span>
            <span className="text-[10px] text-sky-600 block mt-1">θ₀ = {angles[0]} rad</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs">
            <span className="text-slate-500 block">2. Standard Deviation</span>
            <span className="text-sm font-bold text-slate-800">{features.std.toFixed(5)}</span>
            <span className="text-[10px] text-sky-600 block mt-1">θ₁ = {angles[1]} rad</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs">
            <span className="text-slate-500 block">3. Least-Squares Slope</span>
            <span className="text-sm font-bold text-slate-800">{features.slope.toFixed(5)}</span>
            <span className="text-[10px] text-sky-600 block mt-1">θ₂ = {angles[2]} rad</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs">
            <span className="text-slate-500 block">4. Mean Absolute Diff</span>
            <span className="text-sm font-bold text-slate-800">{features.abs_diff_mean.toFixed(5)}</span>
            <span className="text-[10px] text-sky-600 block mt-1">θ₃ = {angles[3]} rad</span>
          </div>
        </div>
      </div>
    </div>
  );
}
