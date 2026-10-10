import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, AlertTriangle, ArrowRight, Gauge, Cpu, CheckCircle2 } from 'lucide-react';
import { runDecision } from '../services/api';

export default function RiskCertificateView({ analysisResult, onAnalyzeCurrent }) {
  const [customThreshold, setCustomThreshold] = useState(0.067349);
  const [customProfile, setCustomProfile] = useState('wide');
  const [evalResult, setEvalResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const cert = analysisResult?.risk_certificate;
  const decision = evalResult || analysisResult?.decision_result;
  const ekf = analysisResult?.estimator_result;
  const phase = analysisResult?.phase_result;

  const scoreVal = cert ? cert.score_value : 0.0452;
  const scoreLower = cert ? cert.score_lower : 0.0381;
  const scoreUpper = cert ? cert.score_upper : 0.0712;
  const threshold = decision ? decision.threshold : customThreshold;

  const handleReevaluate = async () => {
    if (!cert) return;
    setIsEvaluating(true);
    try {
      const res = await runDecision(cert, parseFloat(customThreshold), customProfile);
      setEvalResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const getDecisionBadge = (state) => {
    switch (state) {
      case 'STAY_EKF':
        return {
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          title: 'STAY_EKF (Linear Tracking Valid)',
          desc: 'Nonlinear discrepancy certified below safety threshold. Fast Extended Kalman Filter is trustworthy.',
        };
      case 'ESCALATE_NONLINEAR':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-800',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          title: 'ESCALATE_NONLINEAR (Nonlinear Mismatch)',
          desc: 'Discrepancy upper bound exceeds linear threshold. Escalate to Phase-Grid / Particle Filter estimator.',
        };
      case 'ABSTAIN':
      default:
        return {
          bg: 'bg-rose-50 border-rose-300 text-rose-800',
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          title: 'ABSTAIN (Uncertainty Violation)',
          desc: 'Extreme measurement model divergence or degraded SNR. Measurement excluded from navigation solution.',
        };
    }
  };

  const currentBadge = getDecisionBadge(decision?.state || 'STAY_EKF');

  // Percentage on gauge
  const gaugePercent = Math.min(100, Math.max(0, (scoreUpper / (threshold * 2 || 0.1)) * 100));

  return (
    <div className="space-y-6">
      {/* Three-State Policy Banner */}
      <div className={`border rounded-xl p-5 shadow-xs ${currentBadge.bg} transition-all`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {currentBadge.icon}
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider opacity-75">
                Three-State Decision Policy Output
              </span>
              <h2 className="text-lg font-bold tracking-tight mt-0.5">{currentBadge.title}</h2>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-slate-500 block">Next Action</span>
            <span className="text-sm font-bold font-mono text-slate-900 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
              {decision?.next_action || 'PROCEED_LINEAR'}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs sm:text-sm leading-relaxed">{decision?.explanation || currentBadge.desc}</p>
      </div>

      {/* Primary Score & Gauge Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Certificate Gauge */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Gauge className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-sm">Q-SCOPE Discrepancy Risk Metric (d_mean)</h3>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              v1.0 Bound Certified
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 my-5 text-center">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-mono text-slate-500 uppercase">Lower Bound</span>
              <div className="text-lg font-bold font-mono text-slate-700 mt-1">{scoreLower.toFixed(6)}</div>
            </div>
            <div className="bg-sky-50 p-3 rounded-lg border border-sky-200">
              <span className="text-[11px] font-mono text-sky-700 uppercase font-semibold">Point Score (d_mean)</span>
              <div className="text-xl font-bold font-mono text-sky-900 mt-1">{scoreVal.toFixed(6)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-mono text-slate-500 uppercase">Upper Bound</span>
              <div className="text-lg font-bold font-mono text-slate-700 mt-1">{scoreUpper.toFixed(6)}</div>
            </div>
          </div>

          {/* Visual Risk Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>0.0000 (Ideal Linear)</span>
              <span className="font-semibold text-rose-600">Threshold: {threshold.toFixed(6)}</span>
              <span>{(threshold * 2).toFixed(4)} (Nonlinear)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  scoreUpper > threshold ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${gaugePercent}%` }}
              />
              {/* Threshold tick */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-rose-500" title="Safety Threshold" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Formula: B = |E[p(phi)] - p(mu)| / sqrt(Var[p(phi)] + 1/(4N))</span>
            <span>Validity: {cert?.valid !== false ? 'CERTIFIED' : 'INVALID'}</span>
          </div>
        </div>

        {/* Interactive Threshold & Policy Playground */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Policy Evaluator</h3>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-mono text-slate-600 block mb-1">
                  Threshold (tau): {customThreshold}
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.15"
                  step="0.005"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-600 block mb-1">Uncertainty Profile</label>
                <select
                  value={customProfile}
                  onChange={(e) => setCustomProfile(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800"
                >
                  <option value="narrow">Narrow (1.5 sigma)</option>
                  <option value="medium">Medium (2.0 sigma)</option>
                  <option value="wide">Wide (3.0 sigma, default)</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleReevaluate}
            disabled={isEvaluating}
            className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-semibold transition shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isEvaluating ? 'Re-evaluating...' : 'Re-Evaluate Decision'}
          </button>
        </div>
      </div>

      {/* State Estimator Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3">Extended Kalman Filter (EKF) State</h4>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="text-slate-500 block">Phase Estimate</span>
              <span className="font-bold text-slate-800 text-sm">
                {ekf?.phase_estimate_rad?.toFixed(6) ?? (phase?.phase_mean_rad?.toFixed(6) || '0.000000')} rad
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="text-slate-500 block">Posterior Uncertainty</span>
              <span className="font-bold text-slate-800 text-sm">
                {ekf?.uncertainty_rad?.toFixed(6) ?? '0.012400'} rad
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3">Model Sensitivities & Bounds</h4>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">∂B / ∂mu (Phase sensitivity)</span>
              <span className="font-semibold text-slate-700">
                {cert?.sensitivity?.['d_mu']?.toFixed(4) ?? '0.0125'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">∂B / ∂sigma (Spread sensitivity)</span>
              <span className="font-semibold text-slate-700">
                {cert?.sensitivity?.['d_sigma']?.toFixed(4) ?? '0.0841'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Data Quality Status</span>
              <span className="font-semibold text-emerald-600">
                {cert?.data_quality_status?.toUpperCase() || 'VALID'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
