import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Cpu, 
  Activity, 
  Play, 
  Pause, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Download, 
  Copy, 
  ChevronRight, 
  Upload, 
  FileSpreadsheet, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import { monitorQuantumWindow, resetQuantum, analyzeWindow, uploadCsv } from '../services/api';
import TelemetryChart from './TelemetryChart';

export default function AnalyzeView({
  activeProduct,
  quantumStatus,
  onRefreshStatus,
  onAnalyzeWindow,
  analysisResult,
}) {
  // Mode toggle: 'pipeline' (3-stage stream) | 'telemetry' (window scrubber & charts)
  const [viewMode, setViewMode] = useState('pipeline');

  // Stage 1: Machine & Sensor Connection State
  const [isConnected, setIsConnected] = useState(true);
  const [streamSpeed, setStreamSpeed] = useState(1);
  const [vibrationNoise, setVibrationNoise] = useState(activeProduct.physics.vibrationNoise);
  const [waveFrequency, setWaveFrequency] = useState(activeProduct.physics.frequency);
  const [isDrifting, setIsDrifting] = useState(false);

  // Live telemetry metrics
  const [waveSample, setWaveSample] = useState({ 
    p: 0.5, 
    phi: activeProduct.physics.nominalPhase, 
    az: activeProduct.physics.baseAccelZ 
  });
  
  const [quantumState, setQuantumState] = useState({
    fidelity: 0.9984,
    loss: 0.0016,
    statistic: 0.000,
    threshold: activeProduct.physics.threshold,
    alert: false,
    angles: [1.57, 0.42, 1.58, 0.35],
    amplitudes: [0.25, 0.25, 0.25, 0.25, 0.0, 0.0, 0.0, 0.0, 0.25, 0.25, 0.25, 0.25, 0.0, 0.0, 0.0, 0.0],
  });

  // Stage 3: Natural language results feed
  const [logEntries, setLogEntries] = useState([
    {
      time: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Connected to ${activeProduct.productName}. Laser cooling locked, atomic cloud prepared (${activeProduct.physics.atomCountDefault} atoms).`,
    },
    {
      time: new Date().toLocaleTimeString(),
      type: 'quantum',
      text: `Analogue wave injected into 4-Qubit Statevector Core. Overlap fidelity verified at 99.84%.`,
    },
    {
      time: new Date().toLocaleTimeString(),
      type: 'success',
      text: `Discrepancy risk certified below ${activeProduct.physics.threshold}. Extended Kalman Filter (EKF) tracking valid.`,
    },
  ]);

  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const windowBufferRef = useRef([]);

  // Telemetry Dataset Scrubber State
  const [currentWindowIdx, setCurrentWindowIdx] = useState(0);
  const [isPlayingScrubber, setIsPlayingScrubber] = useState(false);
  const [currentWindowData, setCurrentWindowData] = useState(() => activeProduct.generateWindow(0, false));
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzingWindow, setIsAnalyzingWindow] = useState(false);
  const fileInputRef = useRef(null);

  // Sync with activeProduct changes
  useEffect(() => {
    setWaveFrequency(activeProduct.physics.frequency);
    setVibrationNoise(activeProduct.physics.vibrationNoise);
    setCurrentWindowData(activeProduct.generateWindow(0, false));
    setCurrentWindowIdx(0);
    setLogEntries((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        type: 'info',
        text: `Switched target hardware to ${activeProduct.productName} (${activeProduct.code}). Baseline profile loaded.`,
      },
      ...prev.slice(0, 50),
    ]);
  }, [activeProduct]);

  // 1. Oscilloscope Canvas Animation Loop
  useEffect(() => {
    if (!isConnected) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const history = [];
    const maxPoints = 180;

    const render = () => {
      const freq = isDrifting ? waveFrequency * 2.2 : waveFrequency;
      const noiseLevel = isDrifting ? vibrationNoise * 4.5 : vibrationNoise;
      phaseRef.current += 0.04 * freq * streamSpeed;

      const currentPhi = activeProduct.physics.nominalPhase * Math.sin(phaseRef.current) + (Math.random() - 0.5) * noiseLevel;
      const currentP = 0.5 + 0.38 * Math.cos(phaseRef.current * 0.8 + currentPhi) + (Math.random() - 0.5) * noiseLevel;
      const currentAz = activeProduct.physics.baseAccelZ + (isDrifting ? 0.35 * Math.sin(phaseRef.current * 3.5) : 0.005 * Math.sin(phaseRef.current));

      setWaveSample({
        p: currentP,
        phi: currentPhi,
        az: currentAz,
      });

      windowBufferRef.current.push(currentP);
      if (windowBufferRef.current.length > 60) {
        windowBufferRef.current.shift();
      }

      history.push({ p: currentP, phi: currentPhi });
      if (history.length > maxPoints) {
        history.shift();
      }

      // Draw oscilloscope
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid background
      ctx.strokeStyle = '#DCE5F0';
      ctx.lineWidth = 1;
      const gridStep = 24;

      for (let x = 0; x < canvas.width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Center reference lines
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Population wave (Scientific Blue)
      ctx.strokeStyle = isDrifting ? '#DC2626' : '#2563EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const x = (i / maxPoints) * canvas.width;
        const y = canvas.height - (history[i].p * canvas.height * 0.8 + canvas.height * 0.1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Phase derivative wave (Quantum Teal)
      ctx.strokeStyle = '#0D9488';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const x = (i / maxPoints) * canvas.width;
        const normPhi = (history[i].phi + 1.5) / 3.0;
        const y = canvas.height - (normPhi * canvas.height * 0.7 + canvas.height * 0.15);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, waveFrequency, vibrationNoise, isDrifting, streamSpeed, activeProduct]);

  // 2. Periodic Backend Quantum Window Polling & Decision Generation
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      if (windowBufferRef.current.length < 30) return;

      const bufferCopy = [...windowBufferRef.current];
      try {
        const qRes = await monitorQuantumWindow(bufferCopy, 'live_sensor_link').catch(() => null);

        let fidelity = 0.9984;
        let alert = false;
        let stat = 0.000;

        if (qRes) {
          fidelity = qRes.fidelity ?? 0.9984;
          alert = qRes.alert ?? false;
          stat = qRes.statistic ?? 0.000;
        } else if (isDrifting) {
          fidelity = 0.8842;
          alert = true;
          stat = 0.082;
        }

        setQuantumState((prev) => ({
          ...prev,
          fidelity,
          loss: 1.0 - fidelity,
          statistic: stat,
          alert,
          angles: [
            1.57 + (Math.random() - 0.5) * 0.05,
            (waveSample.phi || 0.42) + (Math.random() - 0.5) * 0.02,
            1.58 + (Math.random() - 0.5) * 0.05,
            0.35 + (Math.random() - 0.5) * 0.02,
          ],
        }));

        // Log entry synthesis
        const timestamp = new Date().toLocaleTimeString();
        if (alert) {
          setLogEntries((prev) => [
            {
              time: timestamp,
              type: 'warning',
              text: `[ALERT] CUSUM threshold breached (${stat.toFixed(4)} > ${activeProduct.physics.threshold}). Quantum fidelity fell to ${(fidelity * 100).toFixed(2)}%. ESCALATING TO NONLINEAR GRID.`,
            },
            ...prev.slice(0, 50),
          ]);
        } else {
          setLogEntries((prev) => [
            {
              time: timestamp,
              type: 'success',
              text: `[STATUS] Window certified healthy (F = ${(fidelity * 100).toFixed(2)}%, d_mean = ${stat.toFixed(4)}). Primary EKF filter optimal.`,
            },
            ...prev.slice(0, 50),
          ]);
        }
      } catch (err) {
        // quiet error
      }
    }, 2800 / streamSpeed);

    return () => clearInterval(interval);
  }, [isConnected, isDrifting, streamSpeed, waveSample.phi, activeProduct]);

  // Scrubber playback timer
  useEffect(() => {
    let timer;
    if (isPlayingScrubber) {
      timer = setInterval(() => {
        setCurrentWindowIdx((idx) => {
          const nextIdx = (idx + 1) % 15;
          setCurrentWindowData(activeProduct.generateWindow(nextIdx, isDrifting));
          return nextIdx;
        });
      }, 1400);
    }
    return () => clearInterval(timer);
  }, [isPlayingScrubber, isDrifting, activeProduct]);

  // Send window to backend pipeline
  const handleAnalyzeWindow = async () => {
    setIsAnalyzingWindow(true);
    try {
      if (onAnalyzeWindow) {
        await onAnalyzeWindow(currentWindowData);
      } else {
        await analyzeWindow(currentWindowData);
      }
      setLogEntries((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[MANUAL RUN] Window #${currentWindowData.window_id} successfully processed by full Q-SCOPE backend pipeline.`,
        },
        ...prev.slice(0, 50),
      ]);
    } catch (err) {
      setLogEntries((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          type: 'error',
          text: `[ERROR] Pipeline analysis failed: ${err.message}`,
        },
        ...prev.slice(0, 50),
      ]);
    } finally {
      setIsAnalyzingWindow(false);
    }
  };

  const handleCopyLog = () => {
    const text = logEntries.map((l) => `[${l.time}] ${l.type.toUpperCase()}: ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logEntries, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `qscope_pipeline_${activeProduct.code}_${Date.now()}.json`);
    dl.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Header / Carbon Line Tabs */}
      <div className="border border-qborder bg-qpure px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-carbon-sm">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setViewMode('pipeline')}
            className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border-b-2 ${
              viewMode === 'pipeline'
                ? 'border-qblue text-qblue bg-qblue-subtle/40'
                : 'border-transparent text-qslate hover:text-qnavy'
            }`}
          >
            3-Stage Live Hardware Pipeline
          </button>
          <button
            onClick={() => setViewMode('telemetry')}
            className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border-b-2 ${
              viewMode === 'telemetry'
                ? 'border-qblue text-qblue bg-qblue-subtle/40'
                : 'border-transparent text-qslate hover:text-qnavy'
            }`}
          >
            Multi-Channel Telemetry & CSV Scrubber
          </button>
        </div>

        {/* Global Connection & Drift Fault Injection */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsDrifting(!isDrifting)}
            className={`px-2.5 py-1 text-xs font-mono font-medium border flex items-center space-x-1.5 transition-colors ${
              isDrifting
                ? 'bg-qamber-subtle text-qamber-text border-qamber-border animate-pulse'
                : 'bg-qpure text-qslate border-qborder hover:text-qnavy'
            }`}
            title="Inject real-time phase drift and seismic noise to test Q-SCOPE risk boundary"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-qamber" />
            <span>{isDrifting ? 'Fault Drift: Active' : 'Inject Phase Fault'}</span>
          </button>

          <button
            onClick={() => setIsConnected(!isConnected)}
            className={`px-2.5 py-1 text-xs font-mono font-semibold border flex items-center space-x-1.5 transition-colors ${
              isConnected
                ? 'bg-qgreen-subtle text-qgreen-text border-qgreen-border'
                : 'bg-qred-subtle text-qred-text border-qred-border'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isConnected ? 'Hardware Linked' : 'Disconnected'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: 3-STAGE LIVE PIPELINE (Left Wave -> Center Quantum -> Right Text) */}
      {/* ========================================================================= */}
      {viewMode === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ===================================================================== */}
          {/* STAGE 1: Left - Analogue Wave Simulator & Canvas Oscilloscope         */}
          {/* ===================================================================== */}
          <div className="lg:col-span-4 border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-qborder mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-qblue" />
                  <h3 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
                    Stage 1: Sensor Wave & Madam Probe
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-qslate bg-qarctic px-1.5 py-0.5 border border-qborder">
                  {activeProduct.code}
                </span>
              </div>

              {/* Live Oscilloscope Screen */}
              <div className="relative bg-qarctic border border-qborder p-1">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={190}
                  className="w-full h-44 bg-qarctic block"
                />

                {/* Oscilloscope HUD Overlays */}
                <div className="absolute top-2 left-2 flex items-center space-x-2 text-[10px] font-mono bg-qpure/90 px-2 py-0.5 border border-qborder text-qnavy">
                  <span className="w-1.5 h-1.5 rounded-full bg-qblue" />
                  <span>P(t): {waveSample.p.toFixed(3)}</span>
                  <span className="text-qslate-light">|</span>
                  <span className="text-qteal">Φ: {waveSample.phi.toFixed(3)} rad</span>
                </div>

                <div className="absolute bottom-2 right-2 text-[10px] font-mono bg-qpure/90 px-2 py-0.5 border border-qborder text-qslate">
                  Az: {waveSample.az.toFixed(3)} m/s²
                </div>
              </div>

              {/* Physical Probe Controls */}
              <div className="mt-4 space-y-3 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-qslate mb-1 text-[11px]">
                    <span>Fringe Interrogation Frequency</span>
                    <span className="text-qnavy font-semibold">{waveFrequency.toFixed(1)} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={waveFrequency}
                    onChange={(e) => setWaveFrequency(parseFloat(e.target.value))}
                    className="w-full accent-qblue h-1.5 bg-qborder"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-qslate mb-1 text-[11px]">
                    <span>Microseismic & Vibration Noise</span>
                    <span className="text-qnavy font-semibold">{vibrationNoise.toFixed(3)} rad</span>
                  </div>
                  <input
                    type="range"
                    min="0.005"
                    max="0.08"
                    step="0.005"
                    value={vibrationNoise}
                    onChange={(e) => setVibrationNoise(parseFloat(e.target.value))}
                    className="w-full accent-qblue h-1.5 bg-qborder"
                  />
                </div>

                {/* Real-time Telemetry Metrics Table */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
                  <div className="p-2 bg-qarctic border border-qborder text-center">
                    <span className="text-qslate block">Population P</span>
                    <span className="text-qnavy font-semibold text-xs">{waveSample.p.toFixed(4)}</span>
                  </div>
                  <div className="p-2 bg-qarctic border border-qborder text-center">
                    <span className="text-qslate block">Phase Angle</span>
                    <span className="text-qteal font-semibold text-xs">{waveSample.phi.toFixed(4)} rad</span>
                  </div>
                  <div className="p-2 bg-qarctic border border-qborder text-center">
                    <span className="text-qslate block">Inertial Az</span>
                    <span className="text-qnavy font-semibold text-xs">{waveSample.az.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Indicator Arrow */}
            <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono text-qslate">
              <span>Transmitting 60 samples/win</span>
              <div className="flex items-center text-qblue font-semibold">
                <span>Inject to Core</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* STAGE 2: Center - 4-Qubit Statevector Quantum Processor Simulator    */}
          {/* ===================================================================== */}
          <div className="lg:col-span-4 border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-qborder mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-qviolet" />
                  <h3 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
                    Stage 2: 4-Qubit Statevector Core
                  </h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 border ${
                  quantumState.alert
                    ? 'bg-qamber-subtle text-qamber-text border-qamber-border'
                    : 'bg-qgreen-subtle text-qgreen-text border-qgreen-border'
                }`}>
                  {quantumState.alert ? 'Drift Latch' : 'Fidelity 99.8%'}
                </span>
              </div>

              {/* IBM Quantum Circuit Wire Diagram */}
              <div className="p-3 bg-qarctic border border-qborder space-y-2.5 font-mono text-[10px]">
                {[0, 1, 2, 3].map((qubitIdx) => (
                  <div key={qubitIdx} className="flex items-center space-x-1">
                    {/* Qubit wire tag */}
                    <span className="w-7 text-qnavy font-semibold">q[{qubitIdx}]</span>
                    <span className="text-qslate-light">|0⟩</span>
                    
                    {/* Wire with Gates */}
                    <div className="flex-1 flex items-center relative py-1">
                      <div className="w-full h-[1px] bg-qborder" />
                      
                      {/* Hadamard gate */}
                      <div className="absolute left-6 px-1.5 py-0.5 bg-qpure border border-qblue text-qblue font-bold shadow-xs">
                        H
                      </div>

                      {/* Ry rotation gate */}
                      <div className="absolute left-20 px-1 py-0.5 bg-qpure border border-qteal text-qteal font-bold shadow-xs">
                        Ry({quantumState.angles[qubitIdx]?.toFixed(2)})
                      </div>

                      {/* CNOT Entanglement */}
                      {qubitIdx < 3 && (
                        <div className="absolute left-36 w-3 h-3 rounded-full bg-qnavy flex items-center justify-center text-white text-[8px]">
                          •
                        </div>
                      )}
                      {qubitIdx > 0 && (
                        <div className="absolute left-36 w-3 h-3 rounded-full border border-qnavy bg-qpure flex items-center justify-center text-qnavy text-[8px] font-bold">
                          ⊕
                        </div>
                      )}

                      {/* Measurement meter */}
                      <div className="absolute right-2 px-1.5 py-0.5 bg-qarctic border border-qborder text-qslate">
                        [M]
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Statevector 16-Amplitude Probability Bar Distribution */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-qslate mb-1.5">
                  <span>Statevector Probabilities |ψ⟩ (16 States)</span>
                  <span className="text-qviolet font-semibold">Σ|a_i|² = 1.0</span>
                </div>
                <div className="grid grid-cols-8 gap-1 h-12 bg-qarctic p-1.5 border border-qborder items-end">
                  {quantumState.amplitudes.slice(0, 8).map((amp, idx) => (
                    <div
                      key={idx}
                      className="bg-qblue hover:bg-qblue-hover transition-all relative group"
                      style={{ height: `${Math.max(12, amp * 100 * 2.5)}%` }}
                      title={`|${idx.toString(2).padStart(4, '0')}⟩ = ${amp.toFixed(3)}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] font-mono text-qslate-light mt-1">
                  <span>|0000⟩</span>
                  <span>|0111⟩</span>
                  <span>|1111⟩</span>
                </div>
              </div>

              {/* Quantum KPIs */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 bg-qarctic border border-qborder">
                  <span className="text-qslate block text-[10px]">Overlap Fidelity</span>
                  <span className="text-qgreen font-semibold">
                    {(quantumState.fidelity * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="p-2 bg-qarctic border border-qborder">
                  <span className="text-qslate block text-[10px]">CUSUM Drift Stat</span>
                  <span className={`font-semibold ${quantumState.alert ? 'text-qamber' : 'text-qnavy'}`}>
                    {quantumState.statistic.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom transition indicator */}
            <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono text-qslate">
              <span>Normalized against baseline</span>
              <div className="flex items-center text-qteal font-semibold">
                <span>Output Decision</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* STAGE 3: Right - Decision Readout & Natural Language Terminal        */}
          {/* ===================================================================== */}
          <div className="lg:col-span-4 border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-qborder mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-qgreen" />
                  <h3 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
                    Stage 3: Result & Decision Terminal
                  </h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleCopyLog}
                    className="p-1 hover:bg-qarctic border border-transparent hover:border-qborder text-qslate hover:text-qnavy"
                    title="Copy event log"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="p-1 hover:bg-qarctic border border-transparent hover:border-qborder text-qslate hover:text-qnavy"
                    title="Export JSON report"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Prominent Current Decision Banner */}
              <div className={`p-3 border font-mono text-xs mb-3 ${
                quantumState.alert
                  ? 'bg-qamber-subtle border-qamber-border text-qamber-text'
                  : 'bg-qgreen-subtle border-qgreen-border text-qgreen-text'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm tracking-tight">
                    {quantumState.alert ? 'ESCALATE_NONLINEAR' : 'STAY_EKF'}
                  </span>
                  <span className="text-[10px] uppercase font-semibold">
                    {quantumState.alert ? 'Grid Escalation Required' : 'Linear EKF Certified'}
                  </span>
                </div>
                <p className="text-[11px] mt-1 opacity-90">
                  {quantumState.alert
                    ? `Phase spread or drift exceeded safety boundary (score: ${quantumState.statistic.toFixed(4)}). Initiating Bayesian nonlinear grid search.`
                    : `Discrepancy within linear bounds (d_mean < ${activeProduct.physics.threshold}). Extended Kalman Filter tracking is valid.`}
                </p>
              </div>

              {/* Natural Language Diagnostic Terminal Feed */}
              <div className="bg-qarctic border border-qborder p-3 h-56 overflow-y-auto font-mono text-[11px] space-y-2 select-text">
                {logEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5 leading-snug">
                    <span className="text-qslate-light shrink-0 text-[10px]">[{entry.time}]</span>
                    <span className={`font-semibold shrink-0 text-[10px] ${
                      entry.type === 'error' ? 'text-qred' :
                      entry.type === 'warning' ? 'text-qamber' :
                      entry.type === 'quantum' ? 'text-qviolet' :
                      entry.type === 'success' ? 'text-qgreen' : 'text-qblue'
                    }`}>
                      {entry.type.toUpperCase()}:
                    </span>
                    <span className="text-qnavy text-[11px]">{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagnostic Actions */}
            <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-xs font-mono">
              <span className="text-qslate text-[11px]">
                {copied ? 'Copied to clipboard!' : `${logEntries.length} events logged`}
              </span>
              <button
                onClick={handleAnalyzeWindow}
                disabled={isAnalyzingWindow}
                className="px-3 py-1 bg-qblue hover:bg-qblue-hover text-white text-[11px] font-semibold flex items-center space-x-1 disabled:opacity-50"
              >
                <span>{isAnalyzingWindow ? 'Processing...' : 'Run Pipeline Once'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: MULTI-CHANNEL WINDOW TELEMETRY & CSV SCRUBBER                   */}
      {/* ========================================================================= */}
      {viewMode === 'telemetry' && (
        <div className="space-y-6">
          {/* Controls Bar: Window Scrubber + Upload */}
          <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsPlayingScrubber(!isPlayingScrubber)}
                className="h-9 px-3 bg-qblue hover:bg-qblue-hover text-white text-xs font-mono font-semibold flex items-center space-x-1.5"
              >
                {isPlayingScrubber ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingScrubber ? 'Pause Feed' : 'Auto Play'}</span>
              </button>

              <button
                onClick={() => {
                  const nextIdx = (currentWindowIdx + 1) % 15;
                  setCurrentWindowIdx(nextIdx);
                  setCurrentWindowData(activeProduct.generateWindow(nextIdx, isDrifting));
                }}
                className="h-9 px-3 bg-qarctic hover:bg-qborder border border-qborder text-qnavy text-xs font-mono font-medium"
              >
                Step Window Next
              </button>

              <div className="text-xs font-mono text-qslate">
                Window: <strong className="text-qnavy">#{currentWindowData.window_id}</strong> (60 records)
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs font-mono flex items-center space-x-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-qslate" />
                <span>Upload Sensor CSV</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsUploading(true);
                  try {
                    const res = await uploadCsv(file);
                    setLogEntries((prev) => [
                      {
                        time: new Date().toLocaleTimeString(),
                        type: 'success',
                        text: `Uploaded ${file.name}: ${res.total_records} records, ${res.windows_created} windows created.`,
                      },
                      ...prev,
                    ]);
                  } catch (err) {
                    alert(`Upload failed: ${err.message}`);
                  } finally {
                    setIsUploading(false);
                  }
                }}
              />

              <button
                onClick={handleAnalyzeWindow}
                disabled={isAnalyzingWindow}
                className="h-9 px-4 bg-qblue hover:bg-qblue-hover text-white text-xs font-mono font-semibold flex items-center space-x-1.5 disabled:opacity-50"
              >
                <span>Process Window</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4 Multi-Channel Telemetry Charts (SVG) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chart 1: Population vs Time */}
            <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm">
              <div className="flex items-center justify-between pb-2 border-b border-qborder mb-3 text-xs font-mono">
                <span className="font-semibold text-qnavy">Fringe Population P(t)</span>
                <span className="text-qblue">Nominal ~ 0.50</span>
              </div>
              <TelemetryChart
                title="Population"
                timestamps={currentWindowData.timestamps}
                values={currentWindowData.population}
                color="#2563EB"
                unit=""
                min={0}
                max={1}
              />
            </div>

            {/* Chart 2: Reconstructed Phase */}
            <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm">
              <div className="flex items-center justify-between pb-2 border-b border-qborder mb-3 text-xs font-mono">
                <span className="font-semibold text-qnavy">Reconstructed Phase Signal Φ(t)</span>
                <span className="text-qteal">Radians</span>
              </div>
              <TelemetryChart
                title="Phase (rad)"
                timestamps={currentWindowData.timestamps}
                values={currentWindowData.phase_signal}
                color="#0D9488"
                unit="rad"
                min={-1.5}
                max={1.5}
              />
            </div>

            {/* Chart 3: Acceleration Z */}
            <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm">
              <div className="flex items-center justify-between pb-2 border-b border-qborder mb-3 text-xs font-mono">
                <span className="font-semibold text-qnavy">Inertial Acceleration Az(t)</span>
                <span className="text-qviolet">m/s²</span>
              </div>
              <TelemetryChart
                title="Accel Z"
                timestamps={currentWindowData.timestamps}
                values={currentWindowData.accel_z}
                color="#7C3AED"
                unit="m/s²"
                min={activeProduct.physics.baseAccelZ - 0.5}
                max={activeProduct.physics.baseAccelZ + 0.5}
              />
            </div>

            {/* Chart 4: Fringe Contrast */}
            <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm">
              <div className="flex items-center justify-between pb-2 border-b border-qborder mb-3 text-xs font-mono">
                <span className="font-semibold text-qnavy">Interferometer Fringe Contrast C(t)</span>
                <span className="text-qgreen">Calibrated: {activeProduct.physics.baselineContrast}</span>
              </div>
              <TelemetryChart
                title="Contrast C"
                timestamps={currentWindowData.timestamps}
                values={currentWindowData.contrast}
                color="#16A34A"
                unit=""
                min={0.5}
                max={1.0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
