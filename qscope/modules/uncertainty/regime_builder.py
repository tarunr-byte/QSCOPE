import numpy as np
import itertools

class RegimeBuilder:
    def __init__(self, profile='narrow'):
        self.profile = profile
        self.points = 3 if profile == 'narrow' else 5
        
    def build(self, envelope):
        means = np.linspace(envelope.phase_mean_range[0], envelope.phase_mean_range[1], self.points)
        spreads = np.linspace(envelope.phase_spread_range[0], envelope.phase_spread_range[1], self.points)
        contrasts = np.linspace(envelope.contrast_range[0], envelope.contrast_range[1], self.points)
        
        return [
            {'phase_mean': float(m), 'phase_spread': float(s), 'contrast': float(c)}
            for m, s, c in itertools.product(means, spreads, contrasts)
        ]
