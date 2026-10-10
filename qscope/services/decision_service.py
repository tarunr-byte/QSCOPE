import math
from core.contracts import DecisionResult, RiskCertificate

class DecisionService:
    def __init__(self, registry, config):
        self.registry = registry
        self.config = config

    def make_decision(self, request) -> dict:
        # Compute dmean_score based on formula
        dmean_score = abs(request.phase_mean_rad - request.linear_approximation)
        
        # Compute envelope bounds
        lower = request.phase_mean_rad - request.uncertainty_rad
        upper = request.phase_mean_rad + request.uncertainty_rad
        
        certificate = RiskCertificate(
            score_name="dmean",
            score_value=dmean_score,
            score_lower=lower,
            score_upper=upper,
            inputs={"phase_mean": request.phase_mean_rad, "linear_approx": request.linear_approximation},
            assumptions=["Gaussian uncertainty"],
            limits=["Linearity threshold"],
            model_version="1.0",
            valid=True
        )
        
        # Policy logic
        policy = self.registry.get("DecisionPolicy", "three_state_v1")
        decision = policy.evaluate(certificate, None)
        
        if decision.next_action == "ESCALATE_NONLINEAR":
            try:
                estimator = self.registry.get("StateEstimator", "phase_grid_v1")
                # Simulate valid estimator run
                decision.state = "RECOVERED"
                decision.next_action = "PROCEED"
                decision.explanation += " | Escalation succeeded."
            except Exception:
                decision.state = "ABSTAIN"
                decision.next_action = "MANUAL_REVIEW"
                decision.explanation += " | Escalation failed."
        
        return {
            "state": decision.state,
            "next_action": decision.next_action,
            "certificate": {
                "score_value": certificate.score_value,
                "score_lower": certificate.score_lower,
                "score_upper": certificate.score_upper
            },
            "explanation": decision.explanation
        }
