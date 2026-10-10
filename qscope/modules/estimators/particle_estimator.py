from core.contracts import StateEstimator
from core.exceptions import UnavailableError

class ParticleEstimator(StateEstimator):
    def __init__(self, *args, **kwargs):
        raise UnavailableError('Particle filter estimator requires validated configuration. Use phase_grid_estimator as the nonlinear alternative.')
        
    def estimate(self, *args, **kwargs):
        pass
