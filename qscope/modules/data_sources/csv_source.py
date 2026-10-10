import csv
import datetime
from typing import List, Dict, Any
from core.contracts import QualityReport, ProvenanceRecord, DataSource, WindowData

class CSVDataSource(DataSource):
    def __init__(self, csv_path: str = ''):
        self.csv_path = csv_path

    def load(self, config) -> List[Dict[str, Any]]:
        path = self.csv_path or getattr(config, 'csv_path', 'data.csv')
        records = []
        try:
            with open(path, 'r', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    parsed = {}
                    for k, v in row.items():
                        try:
                            parsed[k] = float(v)
                        except ValueError:
                            parsed[k] = v
                    records.append(parsed)
        except Exception:
            pass
        return records

    def validate_schema(self, records: List[Dict[str, Any]]) -> QualityReport:
        missing = {}
        invalid = {}
        warnings = []
        valid_count = 0
        reqs = ['population', 'phase_rad', 'contrast']
        for r in records:
            valid = True
            for req in reqs:
                if req not in r:
                    missing[req] = missing.get(req, 0) + 1
                    valid = False
                elif not isinstance(r[req], (int, float)):
                    invalid.setdefault(req, []).append(str(r[req]))
                    valid = False
            if valid:
                valid_count += 1

        prov = ProvenanceRecord(
            source_type='unverified', source_id=self.csv_path,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(), description='CSV load',
            model_version='1.0', config_version='1.0', warnings=tuple(warnings)
        )
        return QualityReport(
            valid=(valid_count>0), total_records=len(records), missing_fields=missing,
            invalid_values=invalid, warnings=warnings, discarded_records=len(records)-valid_count,
            interpolated_records=0, provenance=prov
        )
