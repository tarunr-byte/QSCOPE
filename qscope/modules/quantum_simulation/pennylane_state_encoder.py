import math
from typing import Sequence, Tuple, List

class PennyLaneStateEncoder:
    """
    Implements 4-qubit state encoding using RY angle embedding + trainable RY + CNOT chain.
    Two modes: pennylane or built-in statevector simulator.
    """
    
    @staticmethod
    def encode(angles: Sequence[float], backend: str = 'auto') -> Tuple[List[complex], str]:
        if len(angles) != 4:
            raise ValueError("Requires exactly 4 angles.")
            
        use_pennylane = False
        if backend in ('auto', 'pennylane'):
            try:
                import pennylane as qml
                use_pennylane = True
            except ImportError:
                if backend == 'pennylane':
                    raise ImportError("PennyLane is not installed.")
                use_pennylane = False
                
        if use_pennylane:
            dev = qml.device('default.qubit', wires=4)
            
            @qml.qnode(dev)
            def circuit():
                qml.AngleEmbedding(features=angles, wires=range(4), rotation='Y')
                for q in range(4):
                    qml.RY(0.15 * (q + 1), wires=q)
                for q in range(3):
                    qml.CNOT(wires=[q, q+1])
                return qml.state()
                
            state = circuit()
            return [complex(x) for x in state], 'pennylane'
            
        else:
            # Built-in statevector simulator
            # 4 qubits -> 16 states
            state = [0.0j] * 16
            state[0] = 1.0 + 0.0j
            
            # AngleEmbedding(RY)
            for q in range(4):
                state = PennyLaneStateEncoder._apply_ry(state, q, angles[q], 4)
                
            # trainable RY(0.15*(q+1))
            for q in range(4):
                state = PennyLaneStateEncoder._apply_ry(state, q, 0.15 * (q + 1), 4)
                
            # CNOT chain
            for q in range(3):
                state = PennyLaneStateEncoder._apply_cnot(state, q, q + 1, 4)
                
            return state, 'builtin'

    @staticmethod
    def _apply_ry(state: List[complex], qubit: int, angle: float, num_qubits: int) -> List[complex]:
        new_state = [0.0j] * len(state)
        cos_half = math.cos(angle / 2.0)
        sin_half = math.sin(angle / 2.0)
        
        # PennyLane convention: wire 0 is most significant bit
        bit_mask = 1 << (num_qubits - 1 - qubit)
        
        for i in range(len(state)):
            if (i & bit_mask) == 0:
                i0 = i
                i1 = i | bit_mask
                
                a = state[i0]
                b = state[i1]
                
                new_state[i0] = a * cos_half - b * sin_half
                new_state[i1] = a * sin_half + b * cos_half
                
        return new_state
        
    @staticmethod
    def _apply_cnot(state: List[complex], control: int, target: int, num_qubits: int) -> List[complex]:
        new_state = list(state)
        c_mask = 1 << (num_qubits - 1 - control)
        t_mask = 1 << (num_qubits - 1 - target)
        
        for i in range(len(state)):
            if (i & c_mask) != 0: # Control is 1
                if (i & t_mask) == 0: # Target is 0, swap with 1
                    i1 = i | t_mask
                    new_state[i], new_state[i1] = state[i1], state[i]
        return new_state
