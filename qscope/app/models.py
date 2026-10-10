from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ProjectInfo(BaseModel):
    name: str = "ATOM-QSA"
    description: str = "Quantum Sensor Analysis Platform — Q-SCOPE Risk Certificate & Statevector Quantum Monitor"
    version: str = "2.1.0"
    quantum_engine: str = "Statevector Quantum Monitor (4-Qubit Statevector + Baseline Normalizer + Fidelity Overlap + CUSUM)"

class HealthResponse(BaseModel):
    status: str
    db_status: str
    plugin_count: int
    quantum_engine_status: str = "operational (Statevector Quantum Monitor active)"

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class AnalysisRequest(BaseModel):
    window_id: Optional[str] = "0"
    run_id: Optional[str] = "live_stream"
    timestamps: Optional[List[float]] = None
    population: Optional[List[float]] = None
    phase_signal: Optional[List[float]] = None
    accel_x: Optional[List[float]] = None
    accel_y: Optional[List[float]] = None
    accel_z: Optional[List[float]] = None

class AnalysisResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    analysis_id: str
    window_id: str
    run_id: str
    phase_result: Dict[str, Any]
    uncertainty_result: Dict[str, Any]
    model_result: Dict[str, Any]
    estimator_result: Dict[str, Any]
    risk_certificate: Dict[str, Any]
    decision_result: Dict[str, Any]
    health_record: Optional[Dict[str, Any]] = None

class DecisionRequest(BaseModel):
    window_id: str = "0"
    run_id: str = "1"
    phase_mean_rad: float = 0.5
    uncertainty_rad: float = 0.05
    linear_approximation: float = 0.5

class DecisionResponse(BaseModel):
    state: str
    next_action: str
    certificate: Dict[str, Any]
    explanation: str

class HistoryQuery(BaseModel):
    page: int = 1
    limit: int = 10
    run_id: Optional[str] = None

class HistoryResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    limit: int

# Quantum Engine Models
class QuantumCalibrateRequest(BaseModel):
    key: str = "live"
    false_alarm_target: float = Field(default=0.01, gt=0, lt=1)
    healthy_window_count: int = Field(default=8, ge=3)

class QuantumMonitorWindowRequest(BaseModel):
    key: str = "live"
    signal: Optional[List[float]] = None
    features: Optional[Dict[str, float]] = None

class QuantumStreamRequest(BaseModel):
    key: str = "live"
    signal: Optional[List[float]] = None
    window_size: int = Field(default=60, ge=3)
    baseline: Optional[str] = "0-7"
