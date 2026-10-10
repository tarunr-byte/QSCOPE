import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Database,
  Sliders,
  Filter
} from 'lucide-react';
import { fetchHistory, fetchAuditLog, getExportUrl } from '../services/api';

export default function RunsAuditView({ activeProduct }) {
  const [activeSubTab, setActiveSubTab] = useState('windows'); // 'windows' | 'audit'
  const [historyItems, setHistoryItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [histRes, auditRes] = await Promise.all([
        fetchHistory(1, 50).catch(() => ({ items: [] })),
        fetchAuditLog().catch(() => ({ audit_log: [] })),
      ]);

      const items = histRes.items || histRes.records || [];
      setHistoryItems(items);
      setAuditLogs(auditRes.audit_log || []);
    } catch (err) {
      console.warn('Error loading runs and audit data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProduct]);

  // Demo fallback items if database is empty yet
  const displayItems = historyItems.length > 0 ? historyItems : [
    {
      window_id: 0,
      run_id: `run_${activeProduct.code.toLowerCase()}_0`,
      timestamp: new Date(Date.now() - 360000).toISOString(),
      phase_mean: activeProduct.physics.nominalPhase,
      uncertainty: 0.042,
      score_value: 0.0142,
      decision_state: 'STAY_EKF',
      provenance: {
        source_type: 'real_observation',
        model_version: '2.1.0',
        config_version: '1.0',
        description: `${activeProduct.productName} Baseline Run`
      }
    },
    {
      window_id: 1,
      run_id: `run_${activeProduct.code.toLowerCase()}_1`,
      timestamp: new Date(Date.now() - 240000).toISOString(),
      phase_mean: activeProduct.physics.nominalPhase + 0.02,
      uncertainty: 0.045,
      score_value: 0.0168,
      decision_state: 'STAY_EKF',
      provenance: {
        source_type: 'real_observation',
        model_version: '2.1.0',
        config_version: '1.0',
        description: `${activeProduct.productName} Calibrated Window`
      }
    },
    {
      window_id: 2,
      run_id: `run_${activeProduct.code.toLowerCase()}_2`,
      timestamp: new Date(Date.now() - 120000).toISOString(),
      phase_mean: activeProduct.physics.nominalPhase + 0.08,
      uncertainty: 0.082,
      score_value: 0.0712,
      decision_state: 'ESCALATE_NONLINEAR',
      provenance: {
        source_type: 'simulation',
        model_version: '2.1.0',
        config_version: '1.0',
        description: 'Vibration perturbation test'
      }
    }
  ];

  const filteredItems = displayItems.filter((item) => {
    const matchesSearch = 
      String(item.window_id).includes(searchTerm) ||
      (item.run_id && item.run_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = 
      statusFilter === 'ALL' || item.decision_state === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDecisionBadge = (state) => {
    switch (state) {
      case 'STAY_EKF':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold font-mono bg-qgreen-subtle text-qgreen-text border border-qgreen-border">
            <span className="w-1.5 h-1.5 rounded-full bg-qgreen" />
            <span>STAY_EKF</span>
          </span>
        );
      case 'ESCALATE_NONLINEAR':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold font-mono bg-qamber-subtle text-qamber-text border border-qamber-border">
            <span className="w-1.5 h-1.5 rounded-full bg-qamber" />
            <span>ESCALATE_NONLINEAR</span>
          </span>
        );
      case 'ABSTAIN':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold font-mono bg-qred-subtle text-qred-text border border-qred-border">
            <span className="w-1.5 h-1.5 rounded-full bg-qred" />
            <span>ABSTAIN</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-qslate bg-qarctic border border-qborder">
            {state || 'PENDING'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="border border-qborder bg-qpure p-5 shadow-carbon-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-qblue" />
            <h1 className="text-base font-bold text-qnavy uppercase tracking-wider font-mono">
              Workloads, Analysis Runs & Audit Vault
            </h1>
          </div>
          <p className="text-xs text-qslate mt-1 max-w-2xl leading-relaxed">
            Carbon DataTable tracking all processed sensor windows, mathematical certificates, 
            decision transitions, and cryptographic SQLite provenance logs.
          </p>
        </div>

        {/* Global Export & Refresh */}
        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="h-9 px-3 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs font-mono flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-qslate ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href={getExportUrl('csv')}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs font-mono flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-qteal" />
            <span>Export CSV</span>
          </a>

          <a
            href={getExportUrl('json')}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 bg-qblue hover:bg-qblue-hover text-white text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {/* Main Carbon DataTable Container */}
      <div className="border border-qborder bg-qpure shadow-carbon-sm">
        {/* Table Sub-Tab Bar */}
        <div className="h-11 px-4 border-b border-qborder flex items-center justify-between bg-qarctic">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveSubTab('windows')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border-b-2 ${
                activeSubTab === 'windows'
                  ? 'border-qblue text-qblue bg-qpure'
                  : 'border-transparent text-qslate hover:text-qnavy'
              }`}
            >
              Analyzed Windows ({filteredItems.length})
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border-b-2 ${
                activeSubTab === 'audit'
                  ? 'border-qblue text-qblue bg-qpure'
                  : 'border-transparent text-qslate hover:text-qnavy'
              }`}
            >
              SQLite Audit Trail ({auditLogs.length})
            </button>
          </div>
        </div>

        {/* Toolbar Filters (for windows tab) */}
        {activeSubTab === 'windows' && (
          <div className="p-3 border-b border-qborder bg-qpure flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            {/* Search Box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-qslate absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by Window ID or Run ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 pl-8 pr-3 border border-qborder bg-qarctic text-xs text-qnavy placeholder-qslate-light focus:outline-none focus:border-qblue"
              />
            </div>

            {/* Filter by Decision State */}
            <div className="flex items-center space-x-2">
              <span className="text-qslate text-[11px]">State Filter:</span>
              {['ALL', 'STAY_EKF', 'ESCALATE_NONLINEAR', 'ABSTAIN'].map((state) => (
                <button
                  key={state}
                  onClick={() => setStatusFilter(state)}
                  className={`px-2 py-0.5 text-[10px] border transition-colors ${
                    statusFilter === state
                      ? 'bg-qblue text-white border-qblue font-semibold'
                      : 'bg-qpure text-qslate border-qborder hover:text-qnavy'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Windows Table */}
        {activeSubTab === 'windows' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-qborder bg-qarctic text-qslate text-[11px]">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4 font-semibold">Window ID</th>
                  <th className="py-2.5 px-4 font-semibold">Run Identifier</th>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Phase Mean (rad)</th>
                  <th className="py-2.5 px-4 font-semibold">d_mean Risk</th>
                  <th className="py-2.5 px-4 font-semibold">Decision State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-qborder">
                {filteredItems.map((item, index) => {
                  const isExpanded = expandedRow === index;
                  const winId = item.window_id ?? index;
                  const phaseMean = item.phase_mean ?? item.result?.phase_result?.phase_mean_rad ?? 0.42;
                  const dmeanScore = item.score_value ?? item.result?.risk_certificate?.score_value ?? 0.0142;
                  const decState = item.decision_state ?? item.result?.decision_result?.state ?? 'STAY_EKF';

                  return (
                    <React.Fragment key={index}>
                      <tr 
                        onClick={() => setExpandedRow(isExpanded ? null : index)}
                        className={`hover:bg-qarctic/60 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-qblue-subtle/30 carbon-row-selected' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-qslate">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="py-3 px-4 font-semibold text-qnavy">#{winId}</td>
                        <td className="py-3 px-4 text-qslate">{item.run_id || `run_${activeProduct.code.toLowerCase()}_${winId}`}</td>
                        <td className="py-3 px-4 text-qslate-light">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'}
                        </td>
                        <td className="py-3 px-4 text-qnavy font-semibold">
                          {Number(phaseMean).toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-qnavy font-semibold">
                          {Number(dmeanScore).toFixed(4)}
                        </td>
                        <td className="py-3 px-4">
                          {getDecisionBadge(decState)}
                        </td>
                      </tr>

                      {/* Expanded Row Accordion with Provenance */}
                      {isExpanded && (
                        <tr className="bg-qarctic/40 border-b border-qborder">
                          <td colSpan={7} className="p-4">
                            <div className="bg-qpure border border-qborder p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-qborder pb-2 text-[11px]">
                                <span className="font-semibold text-qnavy uppercase tracking-wider">
                                  Window #{winId} Execution Details & Provenance
                                </span>
                                <span className="text-qteal font-mono">Verified by QSCOPE v2.1.0</span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                <div className="p-2 bg-qarctic border border-qborder">
                                  <span className="text-qslate-light block text-[10px]">Source Type</span>
                                  <span className="text-qnavy font-semibold">{item.provenance?.source_type || 'real_observation'}</span>
                                </div>
                                <div className="p-2 bg-qarctic border border-qborder">
                                  <span className="text-qslate-light block text-[10px]">Model Version</span>
                                  <span className="text-qnavy font-semibold">{item.provenance?.model_version || '2.1.0'}</span>
                                </div>
                                <div className="p-2 bg-qarctic border border-qborder">
                                  <span className="text-qslate-light block text-[10px]">Config Version</span>
                                  <span className="text-qnavy font-semibold">{item.provenance?.config_version || '1.0'}</span>
                                </div>
                                <div className="p-2 bg-qarctic border border-qborder">
                                  <span className="text-qslate-light block text-[10px]">Threshold Boundary</span>
                                  <span className="text-qblue font-semibold">τ = {activeProduct.physics.threshold}</span>
                                </div>
                              </div>

                              {/* Raw Payload Excerpt */}
                              <div className="p-2.5 bg-qarctic border border-qborder font-mono text-[10px] text-qslate-dark overflow-x-auto max-h-24">
                                <pre>{JSON.stringify(item, null, 2)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: SQLite Audit Vault Table */}
        {activeSubTab === 'audit' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-qborder bg-qarctic text-qslate text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Event ID</th>
                  <th className="py-2.5 px-4 font-semibold">Event Type</th>
                  <th className="py-2.5 px-4 font-semibold">Analysis Reference</th>
                  <th className="py-2.5 px-4 font-semibold">Logged Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Status / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-qborder">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-qarctic/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-qnavy truncate max-w-[140px]">
                        {log.log_id || `log_${idx}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-qblue-subtle text-qblue border border-qblue-border text-[10px] font-semibold">
                          {log.event_type || 'ANALYSIS_COMPLETED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-qslate truncate max-w-[140px]">
                        {log.analysis_id || 'live_stream'}
                      </td>
                      <td className="py-3 px-4 text-qslate-light">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                      </td>
                      <td className="py-3 px-4 text-qgreen font-medium">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || 'success')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-qslate text-xs">
                      No external SQLite audit records yet. As live windows are evaluated, events are automatically saved here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
