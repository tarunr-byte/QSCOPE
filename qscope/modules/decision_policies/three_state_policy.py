from core.contracts import DecisionPolicy, DecisionResult, RiskCertificate, EstimatorResult

class ThreeStatePolicy(DecisionPolicy):
    def decide(self, certificate: RiskCertificate, config) -> DecisionResult:
        state = 'STAY_EKF'
        if certificate.score_value > config.threshold:
            state = 'ESCALATE_NONLINEAR'
        return DecisionResult(state, 'measure', certificate, config.threshold, config.uncertainty_profile, 'eval', None, ())
        
    def confirm_escalation(self, decision: DecisionResult, estimator_result: EstimatorResult) -> DecisionResult:
        return DecisionResult(
            decision.state, decision.next_action, decision.certificate, decision.threshold,
            decision.profile, decision.explanation, estimator_result, decision.warnings
        )
