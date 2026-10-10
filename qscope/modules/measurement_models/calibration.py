from core.exceptions import InvalidInputError

class ModelCalibration:
    def __init__(self, p0=0.5, A=0.5, phi0=0.0, provenance='default'):
        self.p0 = p0
        self.A = A
        self.phi0 = phi0
        self.provenance = provenance
        self._validate()
        
    def _validate(self):
        if not (0.0 <= self.p0 <= 1.0):
            raise ValueError("INVALID_INPUT: p0 must be between 0 and 1")
        if not (0.0 <= self.A <= 1.0):
            raise ValueError("INVALID_INPUT: A must be between 0 and 1")
            
    def to_dict(self):
        return {'p0': self.p0, 'A': self.A, 'phi0': self.phi0, 'provenance': self.provenance}
