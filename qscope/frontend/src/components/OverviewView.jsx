import React from 'react';
import { 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Database, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Layers, 
  TrendingUp,
  Sliders,
  ExternalLink,
  ChevronRight,
  HardDrive
} from 'lucide-react';

export default function OverviewView({
  activeProduct,
  quantumStatus,
  analysisResult,
  onNavigate,
  onResetQuantum,
  isResetting,
}) {
  const currentDecision = analysisResult?.decision_result?.state || 'STAY_EKF';
  const dmeanValue = analysisResult?.risk_certificate?.score_value ?? 0.0142;
  const threshold = activeProduct.physics.threshold;
  const fidelity = 0.9984;

  const fleetResources = [
    {
      id: 'qscope-statevector-4q',
      name: 'qscope_statevector_core',
      type: 'Quantum Co-Processor',
      architecture: '4-Qubit Statevector + Normalizer',
      status: 'Online',
      statusVariant: 'green',
      specs: '4 Qubits · 2⁴ Complex Amplitudes',
      basisGates: '{H, Ry, CX, Phase}',
      fidelity: '99.84%',
      latency: '1.4 ms',
    },
    {
      id: 'ekf-estimator-v1',
      name: 'ekf_estimator_v1',
      type: 'Primary Estimator',
      architecture: 'Linearized Extended Kalman Filter',
      status: 'Optimal',
      statusVariant: 'green',
      specs: '50 Hz Sampling Rate',
      basisGates: 'Linear State-Space Update',
      fidelity: '100% Convergence',
      latency: '0.8 ms',
    },
    {
      id: 'phase-grid-v1',
      name: 'phase_grid_escalation_v1',
      type: 'Nonlinear Estimator',
      architecture: 'Global Grid Bayesian Discretizer',
      status: 'Standby / Escalation',
      statusVariant: 'blue',
      specs: '1000 Bin Discretization',
      basisGates: 'Global Phase Integral',
      fidelity: 'Deterministic',
      latency: '4.6 ms',
    },
    {
      id: 'dmean-certificate-engine',
      name: 'qscope_dmean_certifier',
      type: 'Risk Certificate Engine',
      architecture: 'Analytic Moment Uncertainty Envelope',
      status: 'Certified',
      statusVariant: 'green',
      specs: `Boundary τ = ${threshold}`,
      basisGates: 'B = |E[p]-p| / √(Var+1/4N)',
      fidelity: 'Full Uncertainty Grid',
      latency: '1.2 ms',
    },
    {
      id: 'cusum-drift-monitor',
      name: 'cusum_drift_detector',
      type: 'Statistical Health Monitor',
      architecture: 'Sequential CUSUM Accumulator',
      status: quantumStatus?.latched_alerts?.live_sensor_link ? 'Latched Alert' : 'Active Monitoring',
      statusVariant: quantumStatus?.latched_alerts?.live_sensor_link ? 'amber' : 'green',
      specs: 'k = 0.002, h = 0.050',
      basisGates: 'Feature Drift Latch',
      fidelity: 'Zero False Drift',
      latency: '0.5 ms',
    },
    {
      id: 'sqlite-provenance-store',
      name: 'sqlite_audit_vault',
      type: 'Storage & Provenance',
      architecture: 'SQLite WAL-Journal Audit Trail',
      status: 'Synchronized',
      statusVariant: 'green',
      specs: 'Atom-QSA Relational Log',
      basisGates: 'SHA-256 Provenance Hash',
      fidelity: 'ACID Compliant',
      latency: '0.3 ms',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hero / Context Banner with subtle noise texture */}
      <div className="relative border border-qborder bg-qpure p-6 shadow-carbon-sm overflow-hidden">
        <div className="absolute inset-0 qscope-texture opacity-30 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-qblue-subtle text-qblue text-[11px] font-mono font-medium border border-qblue-border">
                {activeProduct.code}
              </span>
              <span className="text-xs text-qslate font-mono">
                {activeProduct.sensorFamily}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-qnavy tracking-tight font-sans">
              {activeProduct.productName}
            </h1>
            <p className="text-xs sm:text-sm text-qslate max-w-3xl leading-relaxed">
              {activeProduct.description} QSCOPE monitors fringe population variance, performs 4-qubit quantum statevector normalization, 
              and verifies non-linear risk boundaries before committing estimator updates.
            </p>
          </div>

          {/* Quick Launch Action Suite */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <button
              onClick={() => onNavigate('analyze')}
              className="h-9 px-4 bg-qblue hover:bg-qblue-hover text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors font-mono"
            >
              <span>Launch Live Pipeline</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('risk')}
              className="h-9 px-3.5 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs font-medium flex items-center space-x-1.5 transition-colors font-mono"
            >
              <span>Inspect Certificate</span>
            </button>
            <button
              onClick={() => onNavigate('health')}
              className="h-9 px-3.5 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs font-medium flex items-center space-x-1.5 transition-colors font-mono"
            >
              <span>VQC Health</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Carbon Metric Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Quantum Engine */}
        <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-qslate mb-2">
              <span className="font-mono uppercase tracking-wider text-[11px]">Quantum Co-Processor</span>
              <Cpu className="w-4 h-4 text-qblue" />
            </div>
            <div className="text-2xl font-bold font-mono text-qnavy">
              4 Qubits
            </div>
            <div className="text-[11px] font-mono text-qslate mt-1">
              Statevector Core · 16 State Amplitudes
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono">
            <span className="text-qgreen font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-qgreen inline-block" />
              <span>Fidelity 99.84%</span>
            </span>
            <span className="text-qslate-light">Auto Mode</span>
          </div>
        </div>

        {/* Tile 2: Estimator Decision State */}
        <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-qslate mb-2">
              <span className="font-mono uppercase tracking-wider text-[11px]">Estimator Regime</span>
              <Activity className="w-4 h-4 text-qteal" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-xl font-bold font-mono ${
                currentDecision === 'STAY_EKF' ? 'text-qgreen' :
                currentDecision === 'ESCALATE_NONLINEAR' ? 'text-qamber' : 'text-qred'
              }`}>
                {currentDecision}
              </span>
            </div>
            <div className="text-[11px] font-mono text-qslate mt-1">
              Linear filter tracking valid
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono">
            <span className="text-qslate">Policy: Three-State v1</span>
            <span className="text-qblue font-medium">Action: PROCEED</span>
          </div>
        </div>

        {/* Tile 3: Q-SCOPE Risk Metric d_mean */}
        <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-qslate mb-2">
              <span className="font-mono uppercase tracking-wider text-[11px]">Discrepancy (d_mean)</span>
              <ShieldCheck className="w-4 h-4 text-qblue" />
            </div>
            <div className="text-2xl font-bold font-mono text-qnavy">
              {dmeanValue.toFixed(4)}
            </div>
            <div className="text-[11px] font-mono text-qslate mt-1">
              Threshold Limit τ = {threshold}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono">
            <div className="w-full bg-qarctic h-1.5 mr-2">
              <div 
                className="bg-qblue h-1.5"
                style={{ width: `${Math.min(100, (dmeanValue / threshold) * 100)}%` }}
              />
            </div>
            <span className="text-qslate-light whitespace-nowrap">
              {((1 - dmeanValue / threshold) * 100).toFixed(0)}% Margin
            </span>
          </div>
        </div>

        {/* Tile 4: Hardware Physics Context */}
        <div className="border border-qborder bg-qpure p-4 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-qslate mb-2">
              <span className="font-mono uppercase tracking-wider text-[11px]">Interferometer Physics</span>
              <TrendingUp className="w-4 h-4 text-qviolet" />
            </div>
            <div className="text-2xl font-bold font-mono text-qnavy">
              N = {activeProduct.physics.atomCountDefault.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-qslate mt-1">
              Fringe Contrast C = {activeProduct.physics.baselineContrast}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-qborder flex items-center justify-between text-[11px] font-mono">
            <span className="text-qslate">T = {activeProduct.physics.interrogationTimeT}</span>
            <span className="text-qteal font-medium">{activeProduct.physics.primaryMetricName.split(' ')[0]}</span>
          </div>
        </div>
      </div>

      {/* Primary Section: IBM Quantum Compute Resources Fleet Table */}
      <div className="border border-qborder bg-qpure shadow-carbon-sm">
        {/* Table Toolbar */}
        <div className="h-12 px-4 border-b border-qborder flex items-center justify-between bg-qarctic">
          <div className="flex items-center space-x-3">
            <h2 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
              Compute & Analytical Pipeline Fleet
            </h2>
            <span className="text-[11px] font-mono text-qslate hidden sm:inline">
              ({fleetResources.length} subsystem engines active)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('runs')}
              className="text-xs text-qblue hover:underline font-mono flex items-center space-x-1"
            >
              <span>View Audit Workloads</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-qborder bg-qpure text-qslate font-mono text-[11px]">
                <th className="py-3 px-4 font-semibold">Subsystem Name</th>
                <th className="py-3 px-4 font-semibold">Engine Category</th>
                <th className="py-3 px-4 font-semibold">Operational Status</th>
                <th className="py-3 px-4 font-semibold">Configuration Specs</th>
                <th className="py-3 px-4 font-semibold hidden md:table-cell">Basis Ops / Rule</th>
                <th className="py-3 px-4 font-semibold text-right">Execution Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-qborder font-mono">
              {fleetResources.map((res) => (
                <tr key={res.id} className="hover:bg-qarctic/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-qnavy">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-qblue" />
                      <span>{res.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-qslate">{res.type}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 text-[10px] font-semibold border ${
                      res.statusVariant === 'green'
                        ? 'bg-qgreen-subtle text-qgreen-text border-qgreen-border'
                        : res.statusVariant === 'amber'
                        ? 'bg-qamber-subtle text-qamber-text border-qamber-border'
                        : 'bg-qblue-subtle text-qblue border-qblue-border'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        res.statusVariant === 'green' ? 'bg-qgreen' :
                        res.statusVariant === 'amber' ? 'bg-qamber' : 'bg-qblue'
                      }`} />
                      <span>{res.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-qslate-dark">{res.specs}</td>
                  <td className="py-3 px-4 text-qslate hidden md:table-cell">{res.basisGates}</td>
                  <td className="py-3 px-4 text-right text-qnavy font-semibold">{res.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split Section: Hardware Coupling Topology & Real-Time Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 4-Qubit Topology Map */}
        <div className="lg:col-span-2 border border-qborder bg-qpure p-5 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-qborder mb-4">
              <div>
                <h3 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
                  Statevector 4-Qubit Coupling & Entanglement Matrix
                </h3>
                <p className="text-[11px] text-qslate font-mono mt-0.5">
                  Linear nearest-neighbour CNOT lattice with periodic boundary kickback
                </p>
              </div>
              <span className="px-2 py-0.5 bg-qarctic border border-qborder text-[10px] font-mono text-qslate">
                1D Entangled Chain
              </span>
            </div>

            {/* Qubit Node Representation */}
            <div className="py-6 px-4 bg-qarctic border border-qborder flex flex-col md:flex-row items-center justify-around gap-4">
              {[0, 1, 2, 3].map((qubitIdx) => (
                <div key={qubitIdx} className="flex items-center">
                  <div className="bg-qpure border-2 border-qblue p-3 w-32 flex flex-col items-center shadow-xs">
                    <div className="w-8 h-8 rounded-full bg-qblue-subtle border border-qblue flex items-center justify-center font-mono font-bold text-xs text-qblue mb-1">
                      Q{qubitIdx}
                    </div>
                    <span className="text-[10px] font-mono text-qslate">
                      {qubitIdx === 0 ? 'Probe (P)' : qubitIdx === 1 ? 'Phase (Φ)' : qubitIdx === 2 ? 'Inertial (Az)' : 'Discrepancy (d)'}
                    </span>
                    <div className="text-[9px] font-mono text-qgreen font-semibold mt-1">
                      Readout 99.8%
                    </div>
                  </div>

                  {qubitIdx < 3 && (
                    <div className="hidden md:flex flex-col items-center px-2">
                      <span className="text-[9px] font-mono text-qslate-light">CNOT</span>
                      <div className="w-8 h-[2px] bg-qborder" />
                      <span className="text-[8px] font-mono text-qslate-light">ε = 0.08%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono pt-2">
              <div className="p-2.5 bg-qpure border border-qborder">
                <span className="text-qslate text-[10px] block">Coherence T1</span>
                <span className="text-qnavy font-semibold">142.6 μs</span>
              </div>
              <div className="p-2.5 bg-qpure border border-qborder">
                <span className="text-qslate text-[10px] block">Dephasing T2</span>
                <span className="text-qnavy font-semibold">98.4 μs</span>
              </div>
              <div className="p-2.5 bg-qpure border border-qborder">
                <span className="text-qslate text-[10px] block">Single-Qubit Gate</span>
                <span className="text-qnavy font-semibold">18 ns (Ry)</span>
              </div>
              <div className="p-2.5 bg-qpure border border-qborder">
                <span className="text-qslate text-[10px] block">Two-Qubit CX Gate</span>
                <span className="text-qnavy font-semibold">160 ns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Active Instrument Physics Specifications */}
        <div className="border border-qborder bg-qpure p-5 shadow-carbon-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-qborder mb-3">
              <h3 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
                Instrument Physics Parameters
              </h3>
              <span className="text-xs font-mono text-qblue font-semibold">
                {activeProduct.code}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {activeProduct.specs.map((spec, i) => (
                <div key={i} className="p-2.5 bg-qarctic border border-qborder">
                  <span className="text-[10px] font-mono text-qslate block uppercase">
                    {spec.label}
                  </span>
                  <span className="font-mono text-qnavy font-semibold text-xs mt-0.5 block">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-qborder">
            <button
              onClick={() => onNavigate('analyze')}
              className="w-full h-9 bg-qarctic hover:bg-qborder border border-qborder text-qnavy text-xs font-mono font-medium flex items-center justify-center space-x-1.5 transition-colors"
            >
              <span>Run Instrument Pipeline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
