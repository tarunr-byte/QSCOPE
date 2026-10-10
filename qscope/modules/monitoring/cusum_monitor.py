from core.contracts import HealthMonitor, HealthRecord, WindowData, ProvenanceRecord
import datetime

class CUSUMMonitor(HealthMonitor):
    def __init__(self):
        self.score = 0.0
        
    def update(self, window: WindowData, features: dict, config) -> HealthRecord:
        k = config.cusum_k
        h = config.cusum_h
        val = features.get('fidelity_loss', 0.0)
        self.score = max(0.0, self.score + val - k)
        alert = self.score > h
        prov = ProvenanceRecord('model_derived', 'cusum_1', datetime.datetime.now(datetime.timezone.utc).isoformat(), 'cusum', '1.0', '1.0', ())
        return HealthRecord(self.score, h, alert, features, 1.0-val, val, prov, ())
        
    def reset(self):
        self.score = 0.0
