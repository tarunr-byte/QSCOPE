import uuid
import dataclasses
from core.pipeline import PipelineOrchestrator
from core.contracts import WindowData

class AnalysisService:
    def __init__(self, registry, repository, config):
        self.registry = registry
        self.repository = repository
        self.config = config
        self.pipeline = PipelineOrchestrator(registry, config)

    def analyze(self, window_data: WindowData) -> dict:
        analysis_id = str(uuid.uuid4())
        
        # Run full pipeline including EKF, risk certificate, and quantum VQC monitor
        record = self.pipeline.process_window(window_data)
        result_dict = record.to_dict()
        
        # Save to SQLite database
        try:
            self.repository.save_analysis(
                analysis_id=analysis_id,
                run_id=str(window_data.run_id),
                window_id=int(window_data.window_id),
                config_version=getattr(self.config, 'config_version', '1.0'),
                result=result_dict
            )
            self.repository.save_audit_log(
                log_id=str(uuid.uuid4()),
                analysis_id=analysis_id,
                event_type="ANALYSIS_COMPLETED",
                details={"status": "success"}
            )
        except Exception:
            pass
        
        return {
            "analysis_id": analysis_id,
            "window_id": str(window_data.window_id),
            "run_id": str(window_data.run_id),
            "phase_result": dataclasses.asdict(record.phase_result) if record.phase_result else {},
            "uncertainty_result": dataclasses.asdict(record.envelope) if record.envelope else {},
            "model_result": dataclasses.asdict(record.model_result) if record.model_result else {},
            "estimator_result": dataclasses.asdict(record.estimator_result) if record.estimator_result else {},
            "risk_certificate": dataclasses.asdict(record.decision_result.certificate) if record.decision_result and record.decision_result.certificate else {},
            "decision_result": dataclasses.asdict(record.decision_result) if record.decision_result else {},
            "health_record": dataclasses.asdict(record.health_record) if record.health_record else {}
        }
