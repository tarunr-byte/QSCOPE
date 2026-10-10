from core.contracts import StateEstimator, EstimatorResult, WindowData, MeasurementModel

class PhaseGridEstimator(StateEstimator):
    def estimate(self, window: WindowData, model: MeasurementModel, config) -> EstimatorResult:
        return EstimatorResult(0.0, 0.0, 'grid', True, {}, '', None)
