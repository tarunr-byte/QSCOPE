import math
import datetime
from typing import Dict, Any
from core.contracts import StateEstimator, EstimatorResult, WindowData, MeasurementModel, ProvenanceRecord

class EKFEstimator(StateEstimator):
    def estimate(self, window: WindowData, model: MeasurementModel, config) -> EstimatorResult:
        if not window.records:
            return EstimatorResult(0.0, 0.0, 'ekf', False, {}, 'no data', None)
        
        mu = 0.0
        P = 1.0
        for r in window.records:
            phase = r.get('phase_rad', 0.0)
            pop = r.get('population', 0.5)
            H = -0.5 * config.measurement_contrast * math.sin(mu)
            S = H * P * H + (0.5 * 0.5 / config.shots) if config.shots > 0 else 1.0
            K = (P * H) / S if S != 0 else 0
            y = pop - (config.measurement_p0 + 0.5 * config.measurement_contrast * math.cos(mu))
            mu = mu + K * y
            P = (1.0 - K * H) * P
            
        prov = ProvenanceRecord('model_derived', 'ekf_1', datetime.datetime.now(datetime.timezone.utc).isoformat(), 'EKF', '1.0', '1.0', ())
        return EstimatorResult(mu, math.sqrt(max(0, P)), 'ekf', True, {}, '', prov)
