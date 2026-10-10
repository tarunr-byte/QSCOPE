from core.contracts import UncertaintyEstimator, PhaseResult, WindowData, UncertaintyEnvelope

class ResidualUncertainty(UncertaintyEstimator):
    def estimate(self, phase_result: PhaseResult, window: WindowData = None, config = None) -> UncertaintyEnvelope:
        mu = phase_result.phase_mean_rad
        spread = phase_result.phase_spread_rad
        
        # Profile adjustments
        profile = getattr(config, 'uncertainty_profile', 'wide') if config else 'wide'
        if profile == 'narrow':
            mu_delta = 0.15
            spread_mult = (0.8, 1.25)
            contrast_range = (0.75, 0.95)
        else:
            mu_delta = 0.30
            spread_mult = (0.5, 2.0)
            contrast_range = (0.50, 1.00)
            
        return UncertaintyEnvelope(
            phase_mean_range=(mu - mu_delta, mu + mu_delta),
            phase_spread_range=(max(0.001, spread * spread_mult[0]), spread * spread_mult[1]),
            contrast_range=contrast_range,
            distribution_family="gaussian",
            assumptions=("profile_envelope",)
        )
