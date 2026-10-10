import statistics
from typing import List, Dict, Any, Set
from core.contracts import QualityReport

class DataValidator:
    """
    Validates data records against the canonical schema.
    """
    
    def __init__(self):
        self.canonical_columns = {
            "run_id": int,
            "timestamp": float,
            "shot_id": int,
            "population": float,
            "phase_signal": float,
            "accel_x": float,
            "accel_y": float,
            "accel_z": float,
            "gyro_x": float,
            "gyro_y": float,
            "gyro_z": float,
            "contrast": float,
            "atom_count": int
        }
        
    def validate(self, records: List[Dict[str, Any]]) -> QualityReport:
        issues = []
        metrics = {
            "total_records": len(records),
            "missing_values": {},
            "duplicate_records": 0,
            "irregular_sampling": 0
        }
        
        if not records:
            issues.append("No records provided to validator.")
            return QualityReport(is_valid=False, issues=issues, metrics=metrics)
            
        seen_keys: Set[str] = set()
        timestamps = []
        
        for idx, record in enumerate(records):
            # Check for missing values and types
            for col, expected_type in self.canonical_columns.items():
                val = record.get(col)
                if val is None:
                    metrics["missing_values"][col] = metrics["missing_values"].get(col, 0) + 1
                else:
                    try:
                        expected_type(val)
                    except (ValueError, TypeError):
                        issues.append(f"Record {idx}: Column {col} value {val} is not of type {expected_type.__name__}")
                        
            # Validate ranges
            contrast = record.get("contrast")
            if contrast is not None and not (0 <= contrast <= 1):
                issues.append(f"Record {idx}: Contrast {contrast} out of bounds [0, 1]")
                
            atom_count = record.get("atom_count")
            if atom_count is not None and atom_count <= 0:
                issues.append(f"Record {idx}: Atom count {atom_count} must be positive")
                
            # Check duplicates
            ts = record.get("timestamp")
            shot = record.get("shot_id")
            
            if ts is not None:
                timestamps.append(ts)
                
            if ts is not None and shot is not None:
                key = f"{ts}_{shot}"
                if key in seen_keys:
                    metrics["duplicate_records"] += 1
                    issues.append(f"Record {idx}: Duplicate record detected for timestamp {ts} and shot_id {shot}")
                seen_keys.add(key)
                
        # Timestamp monotonicity and sampling regularity
        if len(timestamps) > 1:
            gaps = []
            for i in range(1, len(timestamps)):
                gap = timestamps[i] - timestamps[i-1]
                gaps.append(gap)
                if gap < 0:
                    issues.append(f"Timestamp monotonicity violated between idx {i-1} and {i}")
                    
            if gaps:
                median_gap = statistics.median(gaps)
                if median_gap > 0:
                    irregular = sum(1 for g in gaps if g > 2 * median_gap)
                    metrics["irregular_sampling"] = irregular
                    if irregular > 0:
                        issues.append(f"Found {irregular} instances of irregular sampling (>2x median gap)")
                        
        is_valid = len(issues) == 0
        return QualityReport(is_valid=is_valid, issues=issues, metrics=metrics)
