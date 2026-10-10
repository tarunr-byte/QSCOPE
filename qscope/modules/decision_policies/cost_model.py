class CostModel:
    def __init__(self, miss_cost=10.0, escalation_cost=1.0, abstention_cost=2.0):
        self.miss_cost = miss_cost
        self.escalation_cost = escalation_cost
        self.abstention_cost = abstention_cost
        self.notes = "Costs are illustrative and need operational grounding."
        
    def evaluate_cost(self, decision_state, true_state=None) -> float:
        if decision_state == "STAY_EKF":
            return self.miss_cost if true_state == "unsafe" else 0.0
        if decision_state == "ESCALATE_NONLINEAR":
            return self.escalation_cost
        if decision_state == "ABSTAIN":
            return self.abstention_cost
        return 0.0
