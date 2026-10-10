from typing import List, Dict, Any
from core.contracts import QualityReport
from core.exceptions import ValidationError

class DataSynchronizer:
    """
    Synchronizes and aligns multiple telemetry streams based on timestamp and run_id/shot_id.
    """
    
    def __init__(self, tolerance: float = 0.05):
        """
        Args:
            tolerance: Timestamp alignment tolerance in seconds.
        """
        self.tolerance = tolerance

    def synchronize(self, primary_stream: List[Dict[str, Any]], secondary_stream: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Synchronizes a secondary stream into the primary stream.
        This is a basic implementation that merges dicts when timestamps align within tolerance
        or when run_id and shot_id match.
        """
        if not primary_stream:
            return []
            
        aligned_records = []
        unaligned_count = 0
        
        # Build index for secondary stream based on shot_id/run_id if available
        secondary_by_id = {}
        for record in secondary_stream:
            if "run_id" in record and "shot_id" in record and record["run_id"] is not None and record["shot_id"] is not None:
                secondary_by_id[(record["run_id"], record["shot_id"])] = record
                
        for p_record in primary_stream:
            merged = dict(p_record)
            matched = False
            
            # Try ID match first
            if "run_id" in p_record and "shot_id" in p_record and p_record["run_id"] is not None and p_record["shot_id"] is not None:
                key = (p_record["run_id"], p_record["shot_id"])
                if key in secondary_by_id:
                    s_record = secondary_by_id[key]
                    for k, v in s_record.items():
                        if k not in merged or merged[k] is None:
                            merged[k] = v
                    matched = True
                    
            # Fallback to timestamp alignment
            if not matched and "timestamp" in p_record and p_record["timestamp"] is not None:
                p_ts = p_record["timestamp"]
                # Find closest in secondary
                closest = None
                min_diff = float('inf')
                for s_record in secondary_stream:
                    if "timestamp" in s_record and s_record["timestamp"] is not None:
                        diff = abs(p_ts - s_record["timestamp"])
                        if diff < min_diff:
                            min_diff = diff
                            closest = s_record
                            
                if closest and min_diff <= self.tolerance:
                    for k, v in closest.items():
                        if k not in merged or merged[k] is None:
                            merged[k] = v
                    matched = True
                    
            if not matched:
                unaligned_count += 1
                
            aligned_records.append(merged)
            
        if unaligned_count > len(primary_stream) * 0.5:
            raise ValidationError(f"Too many unaligned records ({unaligned_count}/{len(primary_stream)}). Streams cannot be aligned.")
            
        return aligned_records
