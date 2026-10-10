from typing import List, Dict, Any, Optional
from core.contracts import WindowData, QualityReport

class WindowSegmenter:
    """
    Segments a continuous stream of telemetry records into Windows.
    """
    
    def __init__(self, window_size: int = 50, step_size: Optional[int] = None):
        """
        Args:
            window_size: Number of records per window.
            step_size: Number of records to advance for next window. Defaults to non-overlapping.
        """
        self.window_size = window_size
        self.step_size = step_size or window_size

    def segment(self, records: List[Dict[str, Any]]) -> Tuple[List[WindowData], QualityReport]:
        """
        Segment records into non-overlapping or overlapping windows.
        """
        windows = []
        total_records = len(records)
        discarded_records = 0
        
        if total_records == 0:
            return [], QualityReport(is_valid=False, issues=["No records to segment"], metrics={"discarded": 0})
            
        i = 0
        window_idx = 0
        
        while i + self.window_size <= total_records:
            window_records = records[i:i + self.window_size]
            
            # Create WindowData object
            window_data = WindowData(
                window_id=f"win_{window_idx}",
                start_time=window_records[0].get("timestamp", 0.0),
                end_time=window_records[-1].get("timestamp", 0.0),
                records=window_records,
                metadata={"size": len(window_records)}
            )
            windows.append(window_data)
            window_idx += 1
            i += self.step_size
            
        discarded_records = max(0, total_records - i + self.step_size - self.window_size if len(windows) > 0 else total_records)
        
        report = QualityReport(
            is_valid=True,
            issues=[],
            metrics={
                "total_windows": len(windows),
                "discarded_records": discarded_records
            }
        )
        
        return windows, report

    def segment_by_run(self, records: List[Dict[str, Any]]) -> Tuple[List[WindowData], QualityReport]:
        """
        Group records by run_id into separate windows.
        """
        groups = {}
        for record in records:
            run_id = record.get("run_id", -1)
            if run_id not in groups:
                groups[run_id] = []
            groups[run_id].append(record)
            
        windows = []
        for run_id, group_records in groups.items():
            window_data = WindowData(
                window_id=f"run_{run_id}",
                start_time=group_records[0].get("timestamp", 0.0),
                end_time=group_records[-1].get("timestamp", 0.0),
                records=group_records,
                metadata={"run_id": run_id, "size": len(group_records)}
            )
            windows.append(window_data)
            
        report = QualityReport(
            is_valid=True,
            issues=[],
            metrics={"total_windows": len(windows), "discarded_records": 0}
        )
        
        return windows, report
