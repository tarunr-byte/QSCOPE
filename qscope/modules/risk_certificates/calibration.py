class RiskCalibration:
    def __init__(self, threshold=1.0, profile_metadata=None):
        self.threshold = threshold
        self.profile_metadata = profile_metadata or {}
        self.calibration_notes = "Converting score to failure probability requires separate calibration."
        
    def is_calibrated(self) -> bool:
        return False
        
    def get_explanation(self):
        return "Not calibrated: lacks real empirical failure data to map discrepancy scores to probabilities."
