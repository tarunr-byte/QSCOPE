import math
from typing import Dict, Any
from core.contracts import MeasurementModel, MeasurementModelResult

class FringeModel(MeasurementModel):
    def predict(self, phase_rad: float, contrast: float, offset: float, atom_count: int) -> MeasurementModelResult:
        pop = offset + 0.5 * contrast * math.cos(phase_rad)
        var = pop * (1.0 - pop) / atom_count if atom_count > 0 else 0.0
        return MeasurementModelResult(
            expected_population=pop, population_variance=var, linear_approximation=pop,
            nonlinear_vs_linear_discrepancy=0.0, model_version='1.0', valid=True,
            parameters={'contrast': contrast, 'offset': offset, 'atom_count': float(atom_count)}, reason=''
        )
        
    def predict_distribution(self, envelope, config) -> MeasurementModelResult:
        return MeasurementModelResult(0.5, 0.01, 0.5, 0.0, '1.0', True, {}, '')
