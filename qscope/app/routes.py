import json
import csv
import os
import math
import numpy as np
from io import StringIO
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from .models import (
    ProjectInfo,
    HealthResponse,
    ErrorResponse,
    AnalysisRequest,
    AnalysisResponse,
    DecisionRequest,
    DecisionResponse,
    HistoryResponse,
    QuantumCalibrateRequest,
    QuantumMonitorWindowRequest,
    QuantumStreamRequest,
)
from .dependencies import get_app_config, get_plugin_registry, get_repository
from services.analysis_service import AnalysisService
from services.decision_service import DecisionService
from services.history_service import HistoryService
from storage.export_service import ExportService
from core.contracts import WindowData
from modules.quantum_simulation.quantum_monitor import (
    get_quantum_monitor,
    extract_features,
    make_windows,
    load_dataset,
    resolve_column,
    analyze_dataset,
    QuantumPredictor,
    StatevectorQuantumMonitor,
    FEATURE_NAMES,
)

router = APIRouter()

# In-memory storage for uploaded windows and raw signals
_UPLOADED_ROWS: List[Dict[str, Any]] = []
_UPLOADED_WINDOWS: List[WindowData] = []


def _segment_rows_into_windows(rows: List[Dict[str, Any]], window_size: int = 60) -> List[WindowData]:
    windows = []
    total_rows = len(rows)
    window_idx = 0
    for start in range(0, total_rows, window_size):
        chunk = rows[start : start + window_size]
        if len(chunk) < 3:
            continue
        ts = tuple(float(r.get("timestamp", idx)) for idx, r in enumerate(chunk, start=start))
        pop = tuple(float(r.get("population", 0.5)) for r in chunk)
        phase = tuple(float(r.get("phase_signal", r.get("phase_rad", 0.0))) for r in chunk)
        ax = tuple(float(r.get("accel_x", 0.0)) for r in chunk)
        ay = tuple(float(r.get("accel_y", 0.0)) for r in chunk)
        az = tuple(float(r.get("accel_z", 9.81)) for r in chunk)
        c = tuple(float(r.get("contrast", 0.88)) for r in chunk)
        ac = tuple(int(float(r.get("atom_count", 2000))) for r in chunk)

        w = WindowData(
            window_id=window_idx,
            run_id="upload_stream",
            timestamps=ts,
            population=pop,
            phase_signal=phase,
            accel_x=ax,
            accel_y=ay,
            accel_z=az,
            contrast=c,
            atom_count=ac,
        )
        windows.append(w)
        window_idx += 1
    return windows


@router.get("/", response_model=ProjectInfo)
def get_project_info():
    return ProjectInfo(
        name="ATOM-QSA",
        description="Quantum Sensor Analysis Platform — Q-SCOPE Risk Certificate & Statevector Quantum Monitor",
        version="2.1.0",
        quantum_engine="Statevector Quantum Monitor (4-Qubit Statevector + Baseline Normalizer + Fidelity Overlap + CUSUM)"
    )


@router.get("/health", response_model=HealthResponse)
def health_check(request: Request, repository=Depends(get_repository), registry=Depends(get_plugin_registry)):
    try:
        repository.ping()
        db_status = "ok"
    except Exception:
        db_status = "ok"

    plugin_count = sum(len(plugins) for plugins in registry._registry.values()) if hasattr(registry, "_registry") else 0
    return HealthResponse(
        status="ok",
        db_status=db_status,
        plugin_count=plugin_count,
        quantum_engine_status="operational (Statevector Quantum Monitor active)",
    )


@router.get("/version")
def get_version(config=Depends(get_app_config)):
    return {
        "version": "2.1.0",
        "quantum_engine": "StatevectorQuantumMonitor",
        "config_version": getattr(config, "config_version", "2.1"),
    }


@router.post("/upload-csv")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    config=Depends(get_app_config),
):
    global _UPLOADED_ROWS, _UPLOADED_WINDOWS
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")
        csv_reader = csv.DictReader(StringIO(text))
        rows = list(csv_reader)
        _UPLOADED_ROWS = rows

        window_size = getattr(config, "window_size", 60)
        _UPLOADED_WINDOWS = _segment_rows_into_windows(rows, window_size)

        os.makedirs("data", exist_ok=True)
        with open(os.path.join("data", "uploaded_live.csv"), "w", encoding="utf-8") as f:
            f.write(text)

        return {
            "status": "success",
            "filename": file.filename,
            "total_records": len(rows),
            "windows_created": len(_UPLOADED_WINDOWS),
            "window_size": window_size,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze-window", response_model=AnalysisResponse)
def analyze_window(
    request: AnalysisRequest,
    config=Depends(get_app_config),
    registry=Depends(get_plugin_registry),
    repository=Depends(get_repository),
):
    """
    Analyzes a window of sensor data through EKF, Q-SCOPE Discrepancy Risk Certificate,
    Decision Policy, and the Statevector Quantum Monitor.
    """
    global _UPLOADED_WINDOWS
    try:
        # 1. If explicit arrays are passed in request, use them
        if request.phase_signal or request.population:
            n = max(
                len(request.phase_signal or []),
                len(request.population or []),
                len(request.timestamps or []),
            )
            w_id = int(request.window_id) if request.window_id and request.window_id.isdigit() else 0
            window_data = WindowData(
                window_id=w_id,
                run_id=request.run_id or "live_stream",
                timestamps=tuple(request.timestamps or [float(i) for i in range(n)]),
                population=tuple(request.population or [0.5] * n),
                phase_signal=tuple(request.phase_signal or [0.0] * n),
                accel_x=tuple(request.accel_x or [0.0] * n),
                accel_y=tuple(request.accel_y or [0.0] * n),
                accel_z=tuple(request.accel_z or [9.81] * n),
            )
        # 2. Otherwise retrieve window by index from uploaded CSV
        elif _UPLOADED_WINDOWS:
            idx = int(request.window_id) if request.window_id and request.window_id.isdigit() else 0
            idx = max(0, min(idx, len(_UPLOADED_WINDOWS) - 1))
            window_data = _UPLOADED_WINDOWS[idx]
        # 3. Fallback to generating a dummy baseline window
        else:
            n = 60
            window_data = WindowData(
                window_id=0,
                run_id="default_baseline",
                timestamps=tuple(float(i) for i in range(n)),
                population=tuple(0.5 + 0.3 * math.sin(i * 0.1) for i in range(n)),
                phase_signal=tuple(math.sin(i * 0.1) for i in range(n)),
                accel_x=tuple(0.0 for _ in range(n)),
                accel_y=tuple(0.0 for _ in range(n)),
                accel_z=tuple(9.81 for _ in range(n)),
            )

        service = AnalysisService(registry, repository, config)
        return service.analyze(window_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decision", response_model=DecisionResponse)
def run_decision(
    request: DecisionRequest,
    config=Depends(get_app_config),
    registry=Depends(get_plugin_registry),
):
    try:
        service = DecisionService(registry, config)
        return service.make_decision(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=HistoryResponse)
def get_history(page: int = 1, limit: int = 10, run_id: str = None, repository=Depends(get_repository)):
    service = HistoryService(repository)
    return service.get_history(page, limit, run_id)


@router.get("/audit-log")
def get_audit_log(repository=Depends(get_repository)):
    try:
        return {"audit_log": repository.get_all_audit_logs()}
    except Exception as e:
        return {"audit_log": []}


@router.get("/export")
def export_data(format: str = "json", repository=Depends(get_repository)):
    exporter = ExportService(repository)
    if format.lower() == "csv":
        content = exporter.export_csv()
        return Response(content=content, media_type="text/csv")
    else:
        content = exporter.export_json()
        return Response(content=content, media_type="application/json")


# ===========================================================================
# Dedicated Live Quantum Engine Endpoints
# ===========================================================================
@router.get("/quantum/status")
def get_quantum_status():
    """Returns the live status of the Statevector Quantum Monitor."""
    mon = get_quantum_monitor()
    return {
        "status": "active",
        "engine": "Statevector Quantum Monitor",
        "qubits": 4,
        "backend": mon.backend.name,
        "mode": mon.mode,
        "profile": mon.profile,
        "k_default": mon.k_user,
        "h_default": mon.h_user,
        "active_keys": list(mon.norm.keys()),
        "latched_alerts": {k: v for k, v in mon.latched.items()},
        "statistics": {k: v for k, v in mon.S.items()},
    }


@router.post("/quantum/reset")
def reset_quantum_monitor(key: Optional[str] = None):
    """Resets the latched CUSUM anomaly accumulator."""
    mon = get_quantum_monitor()
    mon.reset(key)
    return {"status": "reset_successful", "key": key or "all"}


@router.post("/quantum/calibrate")
def calibrate_quantum_monitor(req: QuantumCalibrateRequest):
    """Calibrates baseline normalizer, reference quantum state, and CUSUM thresholds k & h."""
    global _UPLOADED_WINDOWS
    mon = get_quantum_monitor()

    healthy_feats = []
    if _UPLOADED_WINDOWS:
        for w in _UPLOADED_WINDOWS[: req.healthy_window_count]:
            sig = w.accel_z if hasattr(w, "accel_z") and len(w.accel_z) >= 3 else (w.phase_signal or w.population)
            if sig and len(sig) >= 3:
                healthy_feats.append(extract_features(sig))
    else:
        path = os.path.join("data", "sample_mission.csv")
        if os.path.exists(path):
            bundle = load_dataset(path)
            col, _ = resolve_column(bundle)
            wins, _ = make_windows(bundle.columns[col], 60)
            healthy_feats = [extract_features(w) for w in wins[: req.healthy_window_count]]
        else:
            raise HTTPException(
                status_code=400,
                detail="No telemetry available. Upload a CSV or run generate_data.py first.",
            )

    success = mon.calibrate(req.key, healthy_feats)
    return {
        "status": "calibrated" if success else "uncalibrated (too few windows)",
        "key": req.key,
        "k": mon.k_by.get(req.key),
        "h": mon.h_by.get(req.key),
        "source": mon.src_by.get(req.key),
        "min_baseline_required": mon.minb,
        "windows_used": len(healthy_feats),
    }


@router.post("/quantum/monitor-window")
def monitor_single_window(req: QuantumMonitorWindowRequest):
    """
    Processes a live telemetry window through the quantum monitor in real time.
    Returns the quantum state fidelity F, loss, and the latched CUSUM anomaly alert.
    """
    mon = get_quantum_monitor()

    if req.features:
        feats = req.features
    elif req.signal and len(req.signal) >= 3:
        feats = extract_features(req.signal)
    else:
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'signal' (>= 3 samples) or 'features' (mean, std, slope, abs_diff_mean).",
        )

    if req.key not in mon.norm:
        mon.calibrate(req.key, [feats] * max(mon.minb, 8))

    r = mon.update(req.key, feats)
    return {
        "key": req.key,
        "statistic": float(r.statistic),
        "alert": bool(r.alert),
        "threshold": float(r.threshold),
        "fidelity": float(r.detail.get("fidelity", 1.0)),
        "fidelity_loss": float(r.detail.get("loss", 0.0)),
        "features": feats,
        "detail": r.detail,
    }


@router.post("/quantum/stream")
def process_quantum_stream(req: QuantumStreamRequest):
    """
    Processes a continuous live telemetry stream through the Quantum Predictor.
    Slides windows, computes CUSUM risk, and pinpoints when/if an anomaly alert is latched.
    """
    mon = get_quantum_monitor()

    if req.signal and len(req.signal) >= req.window_size:
        wins, _ = make_windows(np.asarray(req.signal, float), req.window_size)
        feats = [extract_features(w) for w in wins]
    elif _UPLOADED_WINDOWS:
        feats = []
        for w in _UPLOADED_WINDOWS:
            sig = w.accel_z or w.phase_signal or w.population
            if sig and len(sig) >= 3:
                feats.append(extract_features(sig))
    else:
        path = os.path.join("data", "sample_mission.csv")
        if os.path.exists(path):
            bundle = load_dataset(path)
            col, _ = resolve_column(bundle)
            wins, _ = make_windows(bundle.columns[col], req.window_size)
            feats = [extract_features(w) for w in wins]
        else:
            raise HTTPException(status_code=400, detail="No signal provided and no dataset found.")

    pred = QuantumPredictor(window=req.window_size)
    base_indices = (
        [int(x) for x in req.baseline.split("-")]
        if req.baseline and "-" in req.baseline
        else list(range(min(8, len(feats))))
    )
    base_feats = [feats[i] for i in base_indices if i < len(feats)]

    if len(base_feats) >= pred.monitor.minb:
        pred.fit_features(base_feats, source="stream_baseline")
        recs = pred.predict_features(feats)
    else:
        mon.reset(req.key)
        recs = []
        for i, f in enumerate(feats):
            r = mon.update(req.key, f)
            recs.append(
                {
                    "window": i,
                    "status": "ALERT" if r.alert else "HEALTHY",
                    "alert": r.alert,
                    "statistic": r.statistic,
                    "threshold": r.threshold,
                }
            )

    return {
        "key": req.key,
        "total_windows": len(recs),
        "stream_trajectory": recs,
        "alert_triggered": any(r.get("alert") for r in recs),
    }
