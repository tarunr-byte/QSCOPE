import math
import random
import csv
import datetime
from typing import List, Dict, Any
from core.contracts import QualityReport, ProvenanceRecord, DataSource

class SyntheticDataSource(DataSource):
    def load(self, config) -> List[Dict[str, Any]]:
        random.seed(config.seed)
        records = []
        for i in range(config.window_size * config.baseline_windows):
            phase = random.uniform(0, 2*math.pi)
            pop = config.measurement_p0 + config.measurement_amplitude * config.measurement_contrast * math.cos(phase)
            noise = random.gauss(0, 1.0/math.sqrt(config.shots) if config.shots else 0.05)
            records.append({'phase_rad': phase, 'population': max(0.0, min(1.0, pop+noise)), 'contrast': config.measurement_contrast, 'timestamp': i})
        return records

    def validate_schema(self, records: List[Dict[str, Any]]) -> QualityReport:
        prov = ProvenanceRecord(
            source_type='synthetic', source_id='synth_1', timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            description='Synthetic gen', model_version='1.0', config_version='1.0', warnings=()
        )
        return QualityReport(True, len(records), {}, {}, [], 0, 0, prov)
        
    def generate_sample_csv(self, config, filepath: str):
        recs = self.load(config)
        if recs:
            with open(filepath, 'w', newline='') as f:
                w = csv.DictWriter(f, fieldnames=recs[0].keys())
                w.writeheader()
                w.writerows(recs)
