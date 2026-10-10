import dataclasses
from core.contracts import (
    WindowData,
    PhaseResult,
    UncertaintyEnvelope,
    MeasurementModelResult,
    EstimatorResult,
    DecisionResult,
    HealthRecord,
)
from dataclasses import dataclass
from typing import Optional

@dataclass
class AnalysisRecord:
    window: WindowData
    phase_result: Optional[PhaseResult] = None
    envelope: Optional[UncertaintyEnvelope] = None
    model_result: Optional[MeasurementModelResult] = None
    estimator_result: Optional[EstimatorResult] = None
    decision_result: Optional[DecisionResult] = None
    health_record: Optional[HealthRecord] = None
    
    def to_dict(self):
        return {
            "window": dataclasses.asdict(self.window) if self.window else None,
            "phase_result": dataclasses.asdict(self.phase_result) if self.phase_result else None,
            "envelope": dataclasses.asdict(self.envelope) if self.envelope else None,
            "model_result": dataclasses.asdict(self.model_result) if self.model_result else None,
            "estimator_result": dataclasses.asdict(self.estimator_result) if self.estimator_result else None,
            "decision_result": dataclasses.asdict(self.decision_result) if self.decision_result else None,
            "health_record": dataclasses.asdict(self.health_record) if self.health_record else None,
        }

class PipelineOrchestrator:
    def __init__(self, registry, config):
        self.registry = registry
        self.config = config
        
        self.phase_reconstructor = self.registry.get("PhaseReconstructor", "simulated")
        self.uncertainty_estimator = self.registry.get("UncertaintyEstimator", "default")
        self.measurement_model = self.registry.get("MeasurementModel", "fringe_model_v1")
        self.state_estimator = self.registry.get("StateEstimator", "ekf_v1")
        self.risk_certificate_plugin = self.registry.get("RiskCertificatePlugin", "dmean_v1")
        self.decision_policy = self.registry.get("DecisionPolicy", "three_state_v1")
        try:
            self.health_monitor = self.registry.get("HealthMonitor", "quantum_monitor")
        except Exception:
            self.health_monitor = self.registry.get("HealthMonitor", "cusum_v1")

    def process_window(self, window_data: WindowData) -> AnalysisRecord:
        record = AnalysisRecord(window=window_data)
        
        # 1. Phase Reconstruction
        try:
            phase_res = self.phase_reconstructor.reconstruct(window_data, self.config)
        except TypeError:
            phase_res = self.phase_reconstructor.reconstruct(window_data)
        record.phase_result = phase_res
        if not phase_res.valid:
            return record

        # 2. Uncertainty Estimation
        try:
            envelope = self.uncertainty_estimator.estimate(phase_res, window_data, self.config)
        except Exception:
            envelope = self.uncertainty_estimator.estimate(phase_res, window_data)
        record.envelope = envelope

        # 3. Measurement Model Distribution
        try:
            model_res = self.measurement_model.predict_distribution(envelope, self.config)
        except Exception:
            model_res = self.measurement_model.predict(phase_res.phase_mean_rad, 0.88, 0.5, 2000)
        record.model_result = model_res
        if not model_res.valid:
            return record

        # 4. State Estimator (EKF)
        try:
            est_res = self.state_estimator.estimate(window_data, self.measurement_model, self.config)
        except Exception:
            est_res = self.state_estimator.estimate(phase_res, model_res)
        record.estimator_result = est_res
        if not est_res.valid:
            return record

        # 5. Risk Certificate (dmean Q-SCOPE discrepancy)
        try:
            cert = self.risk_certificate_plugin.evaluate(model_res, est_res, envelope, self.config)
        except Exception:
            cert = self.risk_certificate_plugin.evaluate(envelope, {}, 2000)

        # 6. Decision Policy (STAY_EKF / ESCALATE_NONLINEAR / ABSTAIN)
        try:
            decision = self.decision_policy.decide(cert, self.config)
        except Exception:
            decision = self.decision_policy.decide(cert)
        record.decision_result = decision

        # 7. Quantum VQC Health Monitor (live anomaly and drift evaluation)
        try:
            health_rec = self.health_monitor.update(window_data, config=self.config)
            record.health_record = health_rec
        except Exception:
            pass

        return record
