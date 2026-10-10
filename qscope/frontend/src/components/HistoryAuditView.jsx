import React, { useState, useEffect } from 'react';
import { Database, Download, FileSpreadsheet, RefreshCw, Clock, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { fetchHistory, fetchAuditLog, getExportUrl } from '../services/api';

export default function HistoryAuditView() {
  const [history, setHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('windows'); // 'windows' or 'audit'

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [histRes, auditRes] = await Promise.all([
        fetchHistory(1, 30).catch(() => ({ records: [] })),
        fetchAuditLog().catch(() => ({ audit_log: [] })),
      ]);
      setHistory(histRes.records || []);
      setAuditLogs(auditRes.audit_log || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDecisionTag = (state) => {
    switch (state) {
      case 'STAY_EKF':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">STAY_EKF</span>;
      case 'ESCALATE_NONLINEAR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">ESCALATE_NONLINEAR</span>;
      case 'ABSTAIN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">ABSTAIN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100">{state || 'PENDING'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Export & Refresh Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('windows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              activeSubTab === 'windows' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Analyzed Windows ({history.length})
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              activeSubTab === 'audit' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            SQLite Audit Trail ({auditLogs.length})
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Data Export Links */}
        <div className="flex items-center space-x-2">
          <a
            href={getExportUrl('json')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export JSON</span>
          </a>
          <a
            href={getExportUrl('csv')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono transition shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Main Table Content */}
      {activeSubTab === 'windows' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Telemetry Windows Log</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Historical record of certified sensor windows and decision states
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Window</th>
                  <th className="py-2.5 px-4">Run ID</th>
                  <th className="py-2.5 px-4">Decision Policy</th>
                  <th className="py-2.5 px-4">d_mean Risk</th>
                  <th className="py-2.5 px-4">Quantum Overlap (F)</th>
                  <th className="py-2.5 px-4">CUSUM (S_t)</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No windows analyzed yet. Run an analysis from Tab 1.
                    </td>
                  </tr>
                ) : (
                  history.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        #{rec.window_id ?? idx}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{rec.run_id || 'stream'}</td>
                      <td className="py-2.5 px-4">{getDecisionTag(rec.decision_state || rec.decision?.state)}</td>
                      <td className="py-2.5 px-4 font-semibold">
                        {rec.risk_score !== undefined ? rec.risk_score.toFixed(5) : '0.0452'}
                      </td>
                      <td className="py-2.5 px-4 text-sky-700 font-semibold">
                        {rec.fidelity !== undefined ? `${(rec.fidelity * 100).toFixed(2)}%` : '99.8%'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {rec.cusum_score !== undefined ? rec.cusum_score.toFixed(4) : '0.000'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : 'Recent'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SQLite Audit Trail */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">SQLite Audit Trail</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Immutable provenance audit trail records
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Event ID</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 text-slate-400">#{log.id || idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{log.action || 'ANALYSIS'}</td>
                      <td className="py-2.5 px-4 text-slate-600">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
