from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, Sequence, List, Dict, Tuple
from datetime import datetime
import json

@dataclass(frozen=True)
class ProvenanceRecord:
    source_type: str  # 'real_observation', 'synthetic', 'model_derived', 'simulation', 'unverified'
    source_id: str
    timestamp: str
    description: str
    model_version: str = ''
    config_version: str = ''
    warnings: Tuple[str, ...] = ()
    
    def to_dict(self) -> dict:
        return asdict(self)

@dataclass(frozen=True) 
class QualityReport:
    valid: bool
    total_records: int
    missing_fields: Dict[str, int]  # field_name -> count
    invalid_values: Dict[str, List[str]]  # field_name -> list of issues
    warnings: List[str]
    discarded_records: int
    interpolated_records: int
    provenance: ProvenanceRecord
    
    def to_dict(self) -> dict:
        return asdict(self)

@dataclass(frozen=True)
class WindowData:
    window_id: int
    run_id: str
    timestamps: Tuple[float, ...]
    population: Tuple[float, ...]
    phase_signal: Tuple[float, ...]
    accel_x: Tuple[float, ...]
    accel_y: Tuple[float, ...]
    accel_z: Tuple[float, ...]
    gyro_x: Tuple[float, ...] = ()
    gyro_y: Tuple[float, ...] = ()
    gyro_z: Tuple[float, ...] = ()
    contrast: Tuple[float, ...] = ()
    atom_count: Tuple[int, ...] = ()
    shot_ids: Tuple[str, ...] = ()
    quality: Optional[QualityReport] = None
    provenance: Optional[ProvenanceRecord] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def records(self) -> List[Dict[str, Any]]:
        n = max(len(self.timestamps), len(self.population), len(self.phase_signal))
        recs = []
        for i in range(n):
            recs.append({
                'timestamp': self.timestamps[i] if i < len(self.timestamps) else float(i),
                'population': self.population[i] if i < len(self.population) else 0.5,
                'phase_rad': self.phase_signal[i] if i < len(self.phase_signal) else 0.0,
                'phase_signal': self.phase_signal[i] if i < len(self.phase_signal) else 0.0,
                'accel_x': self.accel_x[i] if i < len(self.accel_x) else 0.0,
                'accel_y': self.accel_y[i] if i < len(self.accel_y) else 0.0,
                'accel_z': self.accel_z[i] if i < len(self.accel_z) else 9.81,
                'contrast': self.contrast[i] if i < len(self.contrast) else 0.88,
                'atom_count': self.atom_count[i] if i < len(self.atom_count) else 2000,
            })
        return recs

@dataclass(frozen=True)
class PhaseResult:
    phase_mean_rad: float
    phase_spread_rad: float  # environmental phase spread
    residual_uncertainty_rad: float  # residual phase-estimation uncertainty
    method: str
    valid: bool
    reason: str = ''
    assumptions: Tuple[str, ...] = ()
    provenance: Optional[ProvenanceRecord] = None

@dataclass(frozen=True)
class UncertaintyEnvelope:
    phase_mean_range: Tuple[float, float]
    phase_spread_range: Tuple[float, float]
    contrast_range: Tuple[float, float]
    distribution_family: str
    assumptions: Tuple[str, ...] = ()

@dataclass(frozen=True)
class MeasurementModelResult:
    expected_population: float
    population_variance: float
    linear_approximation: float
    nonlinear_vs_linear_discrepancy: float
    model_version: str
    valid: bool
    parameters: Dict[str, float] = field(default_factory=dict)
    reason: str = ''

@dataclass(frozen=True)
class EstimatorResult:
    phase_estimate_rad: float
    uncertainty_rad: float
    method: str
    valid: bool
    diagnostics: Dict[str, Any] = field(default_factory=dict)
    reason: str = ''
    provenance: Optional[ProvenanceRecord] = None

@dataclass(frozen=True)
class RiskCertificate:
    score_name: str
    score_value: float
    score_lower: float
    score_upper: float
    inputs: Dict[str, Any]
    assumptions: Tuple[str, ...]
    limits: Tuple[str, ...]
    model_version: str
    valid: bool
    sensitivity: Dict[str, float] = field(default_factory=dict)
    data_quality_status: str = 'unknown'
    warnings: Tuple[str, ...] = ()
    reason: str = ''
    
    def to_dict(self) -> dict:
        return asdict(self)

@dataclass(frozen=True)
class DecisionResult:
    state: str  # STAY_EKF, ESCALATE_NONLINEAR, ABSTAIN
    next_action: str
    certificate: RiskCertificate
    threshold: float
    profile: str
    explanation: str
    escalation_result: Optional[EstimatorResult] = None
    warnings: Tuple[str, ...] = ()
    
    def to_dict(self) -> dict:
        d = asdict(self)
        return d

@dataclass(frozen=True)
class HealthRecord:
    cusum_score: float
    cusum_threshold: float
    alert: bool
    features: Dict[str, float]
    fidelity: Optional[float] = None
    fidelity_loss: Optional[float] = None
    provenance: Optional[ProvenanceRecord] = None
    warnings: Tuple[str, ...] = ()

class DataSource(ABC):
    @abstractmethod
    def load(self, config: Any) -> List[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def validate_schema(self, records: List[Dict[str, Any]]) -> QualityReport:
        pass

class Preprocessor(ABC):
    @abstractmethod
    def validate(self, records: List[Dict[str, Any]]) -> QualityReport:
        pass
    
    @abstractmethod
    def synchronize(self, streams: Any) -> List[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def window(self, records: List[Dict[str, Any]], config: Any) -> List[WindowData]:
        pass

class PhaseReconstructor(ABC):
    @abstractmethod
    def reconstruct(self, window: WindowData, config: Any) -> PhaseResult:
        pass

class UncertaintyEstimator(ABC):
    @abstractmethod
    def estimate(self, phase_result: PhaseResult, window: WindowData, config: Any) -> UncertaintyEnvelope:
        pass

class MeasurementModel(ABC):
    @abstractmethod
    def predict(self, phase_rad: float, contrast: float, offset: float, atom_count: int) -> MeasurementModelResult:
        pass
    
    @abstractmethod
    def predict_distribution(self, envelope: UncertaintyEnvelope, config: Any) -> MeasurementModelResult:
        pass

class StateEstimator(ABC):
    @abstractmethod
    def estimate(self, window: WindowData, model: MeasurementModel, config: Any) -> EstimatorResult:
        pass

class RiskCertificatePlugin(ABC):
    @abstractmethod
    def evaluate(self, model_result: MeasurementModelResult, estimator_result: EstimatorResult, envelope: UncertaintyEnvelope, config: Any) -> RiskCertificate:
        pass

class DecisionPolicy(ABC):
    @abstractmethod
    def decide(self, certificate: RiskCertificate, config: Any) -> DecisionResult:
        pass

class HealthMonitor(ABC):
    @abstractmethod
    def update(self, window: WindowData, features: Dict[str, float], config: Any) -> HealthRecord:
        pass
    
    @abstractmethod
    def reset(self) -> None:
        pass

class QuantumMonitor(ABC):
    @abstractmethod
    def encode(self, features: Dict[str, float], config: Any) -> List[complex]:
        pass
    
    @abstractmethod
    def compare(self, reference: List[complex], live: List[complex]) -> float:
        pass

class AuditRepository(ABC):
    @abstractmethod
    def save(self, record: Any) -> str:
        pass
    
    @abstractmethod
    def load(self, record_id: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def list_records(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        pass
