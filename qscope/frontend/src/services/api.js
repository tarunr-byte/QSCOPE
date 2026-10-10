const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Health check endpoint
 */
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

/**
 * Version / Project information
 */
export async function fetchProjectInfo() {
  try {
    const res = await fetch(`${API_BASE}/version`);
    if (res.ok) return res.json();
  } catch (e) {
    // fallback
  }
  return {
    version: '2.1.0',
    name: 'QSCOPE',
    quantum_engine: 'Statevector Quantum Monitor',
    description: 'Quantum Sensor Condition Observation & Prognostics Engine',
  };
}

/**
 * Quantum engine status
 */
export async function fetchQuantumStatus() {
  const res = await fetch(`${API_BASE}/quantum/status`);
  if (!res.ok) throw new Error(`Failed to fetch quantum status: ${res.statusText}`);
  return res.json();
}

/**
 * Reset quantum accumulator
 */
export async function resetQuantum(key = null) {
  const url = key ? `${API_BASE}/quantum/reset?key=${encodeURIComponent(key)}` : `${API_BASE}/quantum/reset`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Reset failed: ${res.statusText}`);
  return res.json();
}

/**
 * Calibrate quantum baseline
 */
export async function calibrateQuantum(healthyWindowCount = 8, key = 'live_sensor_link', falseAlarmTarget = 0.01) {
  const res = await fetch(`${API_BASE}/quantum/calibrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      healthy_window_count: healthyWindowCount,
      false_alarm_target: falseAlarmTarget,
    }),
  });
  if (!res.ok) throw new Error(`Calibration failed: ${res.statusText}`);
  return res.json();
}

/**
 * Monitor a single window or feature set via Statevector Quantum Monitor
 */
export async function monitorQuantumWindow(signalOrFeatures, key = 'live_sensor_link') {
  const body = Array.isArray(signalOrFeatures)
    ? { signal: signalOrFeatures, key }
    : { features: signalOrFeatures, key };
  const res = await fetch(`${API_BASE}/quantum/monitor-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Monitor window failed: ${res.statusText}`);
  return res.json();
}

/**
 * Process a complete stream array through quantum pipeline
 */
export async function processQuantumStream(signal, windowSize = 60, baseline = '0-7', key = 'live_sensor_link') {
  const res = await fetch(`${API_BASE}/quantum/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, window_size: windowSize, baseline, key }),
  });
  if (!res.ok) throw new Error(`Stream processing failed: ${res.statusText}`);
  return res.json();
}

/**
 * Upload sensor CSV
 */
export async function uploadCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/upload-csv`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

/**
 * Full pipeline window analysis
 */
export async function analyzeWindow(windowData) {
  const res = await fetch(`${API_BASE}/analyze-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(windowData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Analysis failed');
  }
  return res.json();
}

/**
 * Decision re-evaluation
 */
export async function runDecision(requestPayload) {
  // Normalize payload to match backend DecisionRequest
  const payload = {
    window_id: String(requestPayload.window_id ?? '0'),
    run_id: String(requestPayload.run_id ?? 'live_stream'),
    phase_mean_rad: Number(requestPayload.phase_mean_rad ?? requestPayload.certificate?.inputs?.phase_mean ?? 0.5),
    uncertainty_rad: Number(requestPayload.uncertainty_rad ?? 0.05),
    linear_approximation: Number(requestPayload.linear_approximation ?? requestPayload.certificate?.inputs?.linear_approx ?? 0.5),
  };
  const res = await fetch(`${API_BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Decision evaluation failed: ${res.statusText}`);
  return res.json();
}

/**
 * Historical runs query
 */
export async function fetchHistory(page = 1, limit = 20, runId = null) {
  let url = `${API_BASE}/history?page=${page}&limit=${limit}`;
  if (runId) url += `&run_id=${encodeURIComponent(runId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
  return res.json();
}

/**
 * Audit log query
 */
export async function fetchAuditLog() {
  const res = await fetch(`${API_BASE}/audit-log`);
  if (!res.ok) throw new Error(`Failed to fetch audit log: ${res.statusText}`);
  return res.json();
}

/**
 * Export URL generator
 */
export function getExportUrl(format = 'json') {
  return `${API_BASE}/export?format=${format}`;
}
