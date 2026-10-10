import React from 'react';
import { Activity, Cpu, RotateCcw, ShieldCheck, Database, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  health,
  quantumStatus,
  onResetQuantum,
  isResetting,
}) {
  const isHealthy = health?.status === 'ok';
  const hasAlert = quantumStatus?.latched_alerts && Object.values(quantumStatus.latched_alerts).some(Boolean);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">ATOM-QSA</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold border border-sky-200">
                  v2.1 Statevector
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono hidden sm:block">
                Atom Interferometer Risk Certificate & Quantum Health Engine
              </p>
            </div>
          </div>

          {/* System Status Badges */}
          <div className="flex items-center space-x-3">
            {/* Server & DB Status */}
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600">DB:</span>
              <span className={health?.db_status === 'ok' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                {health?.db_status?.toUpperCase() || 'CONNECTING'}
              </span>
            </div>

            {/* Quantum Engine Badge */}
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-md text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-sky-900 font-semibold">Qubits: {quantumStatus?.qubits ?? 4}</span>
              <span className="text-sky-700 hidden lg:inline">({quantumStatus?.backend || 'statevector'})</span>
            </div>

            {/* Alert / Latch indicator */}
            {hasAlert ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-rose-50 border border-rose-300 rounded-md text-xs font-mono text-rose-700 animate-pulse font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>ANOMALY LATCHED</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-mono text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>NORMAL</span>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={onResetQuantum}
              disabled={isResetting}
              title="Reset Latched Quantum Anomaly Accumulator"
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-mono bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-md transition shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isResetting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset Engine</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1.5 border-t border-slate-100 pt-1.5 pb-2 overflow-x-auto text-sm">
          {[
            { id: 'product', label: '⚡ Product Live Pipeline', highlight: true },
            { id: 'telemetry', label: '1. Mission Telemetry Stream' },
            { id: 'risk', label: '2. Q-SCOPE Risk Certificate' },
            { id: 'quantum', label: '3. 4-Qubit Quantum Engine' },
            { id: 'history', label: '4. Audit & History Log' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition ${
                activeTab === tab.id
                  ? tab.highlight 
                    ? 'bg-sky-700 text-white shadow-xs font-bold ring-1 ring-sky-500' 
                    : 'bg-sky-600 text-white shadow-xs font-semibold'
                  : tab.highlight
                  ? 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
