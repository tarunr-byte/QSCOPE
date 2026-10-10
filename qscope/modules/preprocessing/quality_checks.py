from typing import List
from core.contracts import WindowData, QualityReport

class QualityChecker:
    """
    Performs comprehensive quality checks on WindowData.
    """
    
    def __init__(self, min_samples: int = 4, max_missing_ratio: float = 0.1):
        """
        Args:
            min_samples: Minimum number of samples required in a window.
            max_missing_ratio: Maximum allowed ratio of missing values per field.
        """
        self.min_samples = min_samples
        self.max_missing_ratio = max_missing_ratio

    def check_window(self, window: WindowData) -> QualityReport:
        """
        Run quality checks on a single window.
        """
        issues = []
        records = window.records
        n_records = len(records)
        
        if n_records < self.min_samples:
            issues.append(f"Insufficient samples: {n_records} < {self.min_samples}")
            return QualityReport(is_valid=False, issues=issues, metrics={"n_records": n_records})
            
        missing_counts = {}
        fields_to_check = ["timestamp", "phase_signal", "contrast", "atom_count"]
        
        for record in records:
            for field in fields_to_check:
                val = record.get(field)
                if val is None:
                    missing_counts[field] = missing_counts.get(field, 0) + 1
                    continue
                    
                if field == "contrast" and not (0 <= val <= 1):
                    issues.append(f"Invalid contrast value: {val}")
                elif field == "atom_count" and val <= 0:
                    issues.append(f"Invalid atom count: {val}")
                    
        for field, count in missing_counts.items():
            ratio = count / n_records
            if ratio > self.max_missing_ratio:
                issues.append(f"Excessive missing data for {field}: {ratio:.1%} > {self.max_missing_ratio:.1%}")
                
        is_valid = len(issues) == 0
        return QualityReport(is_valid=is_valid, issues=issues, metrics={"missing_counts": missing_counts})

    def check_all(self, windows: List[WindowData]) -> List[QualityReport]:
        """
        Check multiple windows and return their reports.
        """
        return [self.check_window(win) for win in windows]
