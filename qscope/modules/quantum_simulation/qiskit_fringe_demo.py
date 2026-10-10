import math
from typing import Tuple

class QiskitFringeDemo:
    """
    Implements H-P(phi)-H Mach-Zehnder one-qubit fringe probability.
    Two modes: qiskit (if available) or analytic fallback.
    NOTE: This is NOT cos^2(phi/2) used as the instrument model.
    This is a quantum-circuit simulation for the auxiliary health monitor, NOT for the main risk certificate.
    """
    
    @staticmethod
    def compute_probability(phase_rad: float, backend: str = 'auto') -> Tuple[float, str]:
        """
        Returns (probability, backend_used)
        """
        use_qiskit = False
        if backend in ('auto', 'qiskit'):
            try:
                from qiskit import QuantumCircuit
                from qiskit.quantum_info import Statevector
                use_qiskit = True
            except ImportError:
                if backend == 'qiskit':
                    raise ImportError("Qiskit is not installed.")
                use_qiskit = False
                
        if use_qiskit:
            qc = QuantumCircuit(1)
            qc.h(0)
            qc.p(phase_rad, 0)
            qc.h(0)
            
            state = Statevector(qc)
            probs = state.probabilities()
            return float(probs[0]), 'qiskit'
        else:
            # Fallback to analytic formula: P(0) = (1 + cos(phi)) / 2
            p_0 = (1.0 + math.cos(phase_rad)) / 2.0
            return p_0, 'analytic'
