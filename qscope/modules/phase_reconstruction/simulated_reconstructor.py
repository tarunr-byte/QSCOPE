import math
import statistics
import datetime
from core.contracts import PhaseResult, ProvenanceRecord, PhaseReconstructor, WindowData

class SimulatedReconstructor(PhaseReconstructor):
    def reconstruct(self, window: WindowData, config) -> PhaseResult:
        phases = [r.get('phase_rad', 0.0) for r in window.records]
        if not phases:
            return PhaseResult(0.0, 0.0, 0.0, 'simulated', False, 'No data', (), None)
        mean_p = statistics.mean(phases)
        spread_p = statistics.stdev(phases) if len(phases)>1 else 0.0
        res_u = spread_p / math.sqrt(len(phases)) if len(phases)>0 else 0.0
        prov = ProvenanceRecord(
            source_type='model_derived', source_id='sim_recon',
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(), description='Sim recon',
            model_version='1.0', config_version='1.0', warnings=()
        )
        return PhaseResult(mean_p, spread_p, res_u, 'simulated', True, '', ('gaussian_noise',), prov)
