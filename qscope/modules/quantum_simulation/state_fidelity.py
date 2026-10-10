from typing import Sequence
import cmath

def compute_fidelity(reference: Sequence[complex], live: Sequence[complex]) -> float:
    """
    Computes |<reference|live>|^2 (state overlap squared).
    Clamped to [0, 1].
    Validates equal non-zero dimensions.
    NOTE: All-zero measurement probability is NOT automatically fidelity.
    This is a mathematical comparison of simulated states.
    """
    if not reference or not live:
        raise ValueError("Dimensions must be non-zero.")
        
    if len(reference) != len(live):
        raise ValueError("Dimensions of reference and live state must be equal.")
        
    overlap = sum((a.conjugate() * b) for a, b in zip(reference, live))
    fidelity = abs(overlap) ** 2
    
    return max(0.0, min(1.0, float(fidelity)))
