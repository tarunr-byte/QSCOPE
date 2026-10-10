"""
AI-QSA quantum branch  (optional, independent of the Q-SCOPE risk certificate)
==============================================================================
Drop this file into:  modules/quantum_simulation/quantum_monitor.py
Also runs standalone:  python quantum_monitor.py --selftest | --demo

What it implements (from the AI-QSA / Q-SCOPE architecture map)
  1. Features per vibration window: [mean, std, slope, abs_diff_mean]
  2. Baseline normalisation:  c = median(feature over calibration windows),
        half-width w = 3|c| + 1e-3,  z = clip((x-(c-w)) / (2w), 0, 1),  angle = pi*z
  3. 1-qubit fringe circuit:  H -> PhaseShift(phi) -> H,  P(0) = (1 + cos phi)/2,
        P(0) estimated from virtual shots (default 2000)
  4. 4-wire encoder:  RY(angle_i) embedding -> fixed RY(0.15, 0.30, 0.45, 0.60) -> CNOT 0->1->2->3
  5. Reference fidelity:  F_t = |<psi_ref|psi_t>|^2,  loss L_t = 1 - F_t,
        psi_ref prepared from the MEAN calibration angles
  6. CUSUM:  S_t = max(0, S_{t-1} + L_t - k);  alert when S_t > h; alert is LATCHED per key
  Backends:  "statevector" (built-in NumPy, no dependencies, default) | "qiskit" | "pennylane"

Claim boundary
  * Software simulation of encoded features. No quantum hardware is controlled.
  * No quantum-advantage claim. F is a state overlap, NOT the 1-qubit fringe probability P(0).
  * k = 0.002 and h = 0.05 are ILLUSTRATIVE defaults; calibrate on healthy real telemetry.
  * Missing backend libraries raise an error; there is never a silent fallback to another backend.
"""
from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

# --------------------------------------------------------------------------------------
# Integration shim: use the backend's contracts if present, otherwise stand alone.
# --------------------------------------------------------------------------------------
try:
    from core.contracts import QuantumMonitor, HealthMonitor, HealthRecord, WindowData, ProvenanceRecord
    from core.exceptions import UnavailableError as _UnavailableBase
    from core.registry import PluginRegistry
except Exception:  # standalone use
    PluginRegistry = None

    class _UnavailableBase(RuntimeError):
        pass

    class QuantumMonitor:
        pass

    class HealthMonitor:
        pass

    class WindowData:
        pass

    class HealthRecord:
        def __init__(self, cusum_score, cusum_threshold, alert, features, fidelity=None, fidelity_loss=None, provenance=None, warnings=()):
            self.cusum_score = cusum_score
            self.cusum_threshold = cusum_threshold
            self.alert = alert
            self.features = features
            self.fidelity = fidelity
            self.fidelity_loss = fidelity_loss
            self.provenance = provenance
            self.warnings = warnings

@dataclass
class HealthResult:
    statistic: float
    alert: bool
    threshold: float
    detail: Dict = field(default_factory=dict)


class BackendUnavailable(_UnavailableBase):
    """Requested quantum library is not installed. Never silently replaced by another backend."""


FEATURE_NAMES = ("mean", "std", "slope", "abs_diff_mean")
FIXED_RY = (0.15, 0.30, 0.45, 0.60)
N_WIRES = 4
PROVENANCE = "quantum_sim"          # label stored with every result


# --------------------------------------------------------------------------------------
# 1. Features
# --------------------------------------------------------------------------------------
def extract_features(x) -> Dict[str, float]:
    """Features of one vibration window v_1..v_n (population SD, least-squares slope)."""
    x = np.asarray(x, dtype=float)
    if x.size < 3 or not np.all(np.isfinite(x)):
        raise ValueError("window needs >= 3 finite samples")
    return {
        "mean": float(x.mean()),
        "std": float(x.std(ddof=0)),
        "slope": float(np.polyfit(np.arange(x.size), x, 1)[0]),
        "abs_diff_mean": float(np.mean(np.abs(np.diff(x)))),
    }


# --------------------------------------------------------------------------------------
# 2. Baseline normalisation -> rotation angles in [0, pi]
# --------------------------------------------------------------------------------------
class BaselineNormalizer:
    def __init__(self, rel_halfwidth: float = 3.0, abs_halfwidth: float = 1e-3, spread_mult: float = 0.0):
        self.rel, self.abs = rel_halfwidth, abs_halfwidth     # spec: w = 3|c| + 1e-3
        # OPT-IN deviation from the spec: w = max(3|c|+1e-3, spread_mult * robust_sd). 0.0 = exact spec.
        # Needed because features near zero (slope, mean) get a ~zero half-width under the spec rule
        # and saturate randomly, which makes healthy windows look like drift.
        self.spread_mult = spread_mult
        self.center: Optional[np.ndarray] = None
        self.lower: Optional[np.ndarray] = None
        self.upper: Optional[np.ndarray] = None

    def fit(self, windows: Sequence[Dict[str, float]]) -> "BaselineNormalizer":
        M = np.array([[w[n] for n in FEATURE_NAMES] for w in windows], dtype=float)
        c = np.median(M, axis=0)
        w = self.rel * np.abs(c) + self.abs
        if self.spread_mult > 0:
            robust_sd = 1.4826 * np.median(np.abs(M - c), axis=0)
            w = np.maximum(w, self.spread_mult * robust_sd)
        self.center, self.lower, self.upper = c, c - w, c + w
        return self

    def angles(self, feats: Dict[str, float]) -> np.ndarray:
        if self.center is None:
            raise RuntimeError("normalizer not fitted")
        x = np.array([feats[n] for n in FEATURE_NAMES], dtype=float)
        z = np.clip((x - self.lower) / (self.upper - self.lower), 0.0, 1.0)  # saturates beyond limits
        return math.pi * z


# --------------------------------------------------------------------------------------
# 3-4. Backends: encoder state + 1-qubit fringe probability
# --------------------------------------------------------------------------------------
class StatevectorBackend:
    """Built-in NumPy statevector simulator. Wire 0 is the most significant bit."""
    name = "statevector"

    @staticmethod
    def _apply_1q(psi: np.ndarray, U: np.ndarray, wire: int) -> np.ndarray:
        return np.moveaxis(np.tensordot(U, psi, axes=([1], [wire])), 0, wire)

    @staticmethod
    def _apply_cnot(psi: np.ndarray, c: int, t: int) -> np.ndarray:
        out = psi.copy()
        idx = [slice(None)] * psi.ndim
        idx[c] = 1                                    # control = |1>
        t_axis = t - 1 if t > c else t                # axis shift after fixing control
        out[tuple(idx)] = np.flip(psi[tuple(idx)], axis=t_axis)   # X on target
        return out

    @staticmethod
    def _ry(theta: float) -> np.ndarray:
        c, s = math.cos(theta / 2), math.sin(theta / 2)
        return np.array([[c, -s], [s, c]], dtype=complex)

    def encoder_state(self, angles: Sequence[float]) -> np.ndarray:
        psi = np.zeros((2,) * N_WIRES, dtype=complex)
        psi[(0,) * N_WIRES] = 1.0
        for i, a in enumerate(angles):                 # RY angle embedding
            psi = self._apply_1q(psi, self._ry(float(a)), i)
        for i, c in enumerate(FIXED_RY):               # fixed RY rotations
            psi = self._apply_1q(psi, self._ry(c), i)
        for i in range(N_WIRES - 1):                   # CNOT chain 0->1->2->3
            psi = self._apply_cnot(psi, i, i + 1)
        return psi.reshape(-1)

    def fringe_p0(self, phi: float) -> float:
        H = np.array([[1, 1], [1, -1]], dtype=complex) / math.sqrt(2)
        P = np.array([[1, 0], [0, np.exp(1j * phi)]], dtype=complex)
        psi = H @ P @ H @ np.array([1, 0], dtype=complex)
        return float(abs(psi[0]) ** 2)


class QiskitBackend:
    """Optional. Needs `pip install qiskit`. (Qiskit is little-endian; overlaps are unaffected.)"""
    name = "qiskit"

    def __init__(self):
        try:
            from qiskit import QuantumCircuit
            from qiskit.quantum_info import Statevector
        except Exception as e:
            raise BackendUnavailable("qiskit not installed (pip install qiskit)") from e
        self._QC, self._SV = QuantumCircuit, Statevector

    def encoder_state(self, angles):
        qc = self._QC(N_WIRES)
        for i, a in enumerate(angles):
            qc.ry(float(a), i)
        for i, c in enumerate(FIXED_RY):
            qc.ry(c, i)
        for i in range(N_WIRES - 1):
            qc.cx(i, i + 1)
        return np.asarray(self._SV.from_instruction(qc).data)

    def fringe_p0(self, phi):
        qc = self._QC(1)
        qc.h(0); qc.p(float(phi), 0); qc.h(0)
        return float(self._SV.from_instruction(qc).probabilities([0])[0])


class PennyLaneBackend:
    """Optional. Needs `pip install pennylane`."""
    name = "pennylane"

    def __init__(self):
        try:
            import pennylane as qml
        except Exception as e:
            raise BackendUnavailable("pennylane not installed (pip install pennylane)") from e
        self._qml = qml
        d4, d1 = qml.device("default.qubit", wires=N_WIRES), qml.device("default.qubit", wires=1)

        @qml.qnode(d4)
        def _enc(angles):
            qml.AngleEmbedding(angles, wires=range(N_WIRES), rotation="Y")
            for i, c in enumerate(FIXED_RY):
                qml.RY(c, wires=i)
            for i in range(N_WIRES - 1):
                qml.CNOT(wires=[i, i + 1])
            return qml.state()

        @qml.qnode(d1)
        def _fringe(phi):
            qml.Hadamard(wires=0); qml.PhaseShift(phi, wires=0); qml.Hadamard(wires=0)
            return qml.probs(wires=0)

        self._enc, self._fringe = _enc, _fringe

    def encoder_state(self, angles):
        return np.asarray(self._enc(np.asarray(angles, dtype=float)))

    def fringe_p0(self, phi):
        return float(self._fringe(float(phi))[0])


class NoisyShotBackend:
    """Hardware-like fidelity estimate by COMPUTE-UNCOMPUTE: run the live encoder, then the inverse of the
    reference encoder, and measure P(0000) = |<ref|live>|^2 (ideal). Simulated on a 4-qubit density matrix with
      * depolarising noise after every single-qubit gate (p1) and every CNOT (p2),
      * symmetric readout bit-flip error per qubit (readout),
      * binomial shot noise (shots).
    This is a simulator of noise, not a device. Gate-error numbers are illustrative superconducting-scale values."""
    name = "noisy_sim"
    _I = np.eye(2, dtype=complex)
    _P = {"X": np.array([[0, 1], [1, 0]], complex), "Y": np.array([[0, -1j], [1j, 0]], complex),
          "Z": np.array([[1, 0], [0, -1]], complex)}

    def __init__(self, shots: int = 2000, p1: float = 0.001, p2: float = 0.01, readout: float = 0.02, seed: int = 0):
        if shots < 1 or not (0 <= p1 < 0.75 and 0 <= p2 < 0.9375 and 0 <= readout < 0.5):
            raise ValueError("invalid noise parameters")
        self.shots, self.p1, self.p2, self.readout = int(shots), float(p1), float(p2), float(readout)
        self.rng = np.random.default_rng(seed)
        self._ideal = StatevectorBackend()
        d = 2 ** N_WIRES
        def full(ops):  # ops: {wire: 2x2}
            m = np.array([[1]], complex)
            for w in range(N_WIRES):
                m = np.kron(m, ops.get(w, self._I))
            return m
        self._full = full
        self._pauli1 = {w: [full({w: P}) for P in self._P.values()] for w in range(N_WIRES)}
        paulis = [self._I] + list(self._P.values())
        self._pauli2 = {}
        for c in range(N_WIRES - 1):
            t = c + 1
            self._pauli2[c] = [full({c: a, t: b}) for ia, a in enumerate(paulis) for ib, b in enumerate(paulis) if (ia, ib) != (0, 0)]
        self._cnot = {}
        for c in range(N_WIRES - 1):
            P = np.zeros((d, d), complex)
            for b in range(d):
                bits = [(b >> (N_WIRES - 1 - w)) & 1 for w in range(N_WIRES)]
                if bits[c]:
                    bits[c + 1] ^= 1
                P[sum(v << (N_WIRES - 1 - w) for w, v in enumerate(bits)), b] = 1
            self._cnot[c] = P
        pop = np.array([bin(x).count("1") for x in range(d)])
        self._ro_w = (self.readout ** pop) * ((1 - self.readout) ** (N_WIRES - pop))

    def _ry(self, theta, w):
        c, s_ = math.cos(theta / 2), math.sin(theta / 2)
        return self._full({w: np.array([[c, -s_], [s_, c]], complex)})

    def _noisy(self, rho, U, mats, p):
        rho = U @ rho @ U.conj().T
        if p > 0:
            rho = (1 - p) * rho + (p / len(mats)) * sum(M @ rho @ M.conj().T for M in mats)
        return rho

    def p_all_zero(self, ref_angles, live_angles) -> float:
        """Noisy P(0000) after live encoder then inverse reference encoder (before shot sampling)."""
        rho = np.zeros((2 ** N_WIRES,) * 2, complex); rho[0, 0] = 1.0
        seq = []
        for i, a in enumerate(live_angles): seq.append(("ry", float(a), i))
        for i, c in enumerate(FIXED_RY): seq.append(("ry", c, i))
        for i in range(N_WIRES - 1): seq.append(("cx", i, None))
        inv = []
        for i in range(N_WIRES - 2, -1, -1): inv.append(("cx", i, None))
        for i, c in enumerate(FIXED_RY): inv.append(("ry", -c, i))
        for i, a in enumerate(ref_angles): inv.append(("ry", -float(a), i))
        for g, x, w in seq + inv:
            if g == "ry":
                rho = self._noisy(rho, self._ry(x, w), self._pauli1[w], self.p1)
            else:
                rho = self._noisy(rho, self._cnot[x], self._pauli2[x], self.p2)
        probs = np.clip(np.real(np.diag(rho)), 0, None)
        return float(np.dot(probs / probs.sum(), self._ro_w))

    def fidelity(self, ref_angles, live_angles) -> float:
        p0 = self.p_all_zero(ref_angles, live_angles)
        return float(self.rng.binomial(self.shots, min(max(p0, 0.0), 1.0)) / self.shots)

    def encoder_state(self, angles):          # ideal state, only used to keep the monitor interface uniform
        return self._ideal.encoder_state(angles)

    def fringe_p0(self, phi):
        return self._ideal.fringe_p0(phi)


def get_backend(name: str = "statevector", **params):
    table = {"statevector": StatevectorBackend, "qiskit": QiskitBackend, "pennylane": PennyLaneBackend,
             "noisy_sim": NoisyShotBackend}
    if name not in table:
        raise ValueError(f"unknown backend '{name}'; choose from {sorted(table)}")
    if params and name != "noisy_sim":
        raise ValueError(f"backend '{name}' takes no parameters")
    return table[name](**params)


def fringe_estimate(phi: float, backend=None, shots: int = 2000, rng=None) -> Dict[str, float]:
    """Virtual-shot estimate of P(0) for the 1-qubit fringe, next to the ideal value."""
    backend = backend or StatevectorBackend()
    rng = rng or np.random.default_rng(0)
    p0 = backend.fringe_p0(phi)
    return {"phi": float(phi), "p0_exact": p0, "p0_ideal_formula": 0.5 * (1 + math.cos(phi)),
            "p0_shots": float(rng.binomial(shots, p0) / shots), "shots": shots}


# --------------------------------------------------------------------------------------
# 5. Fidelity
# --------------------------------------------------------------------------------------
def state_fidelity(psi_ref: np.ndarray, psi_live: np.ndarray) -> float:
    """|<ref|live>|^2 for statevectors. A real overlap, not the all-zero measurement probability."""
    a = np.asarray(psi_ref, complex); b = np.asarray(psi_live, complex)
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    return float(min(1.0, abs(np.vdot(a, b)) ** 2))


# --------------------------------------------------------------------------------------
# 6. The monitor (implements the backend's QuantumMonitor interface)
# --------------------------------------------------------------------------------------
class StatevectorQuantumMonitor(QuantumMonitor, HealthMonitor):
    """mode="auto" (DEFAULT): spread-aware normaliser; k and h are learned from the healthy baseline
         windows with leave-one-out fidelity losses (k = k_margin * worst LOO loss, h = h_mult * k).
       mode="spec": the architecture map's exact constants (k=0.002, h=0.05, spec normaliser).
         Kept for reference: it false-alarms on healthy data because natural fidelity noise (~0.03-0.3)
         is far above k.
       Explicit k / h / spread_mult always override the mode's value."""
    plugin_id, version = "statevector_v1", "2"
    SPEC_K, SPEC_H = 0.002, 0.05
    SPREAD = 4.0
    # (k_margin, h_mult) chosen on tuning seeds 0-99; trade-off measured in --benchmark:
    #   balanced : ~2% false-alarm runs / 25 healthy windows, small (1.5x) shifts mostly missed
    #   sensitive: ~11% false-alarm runs, small shifts caught far more often
    PROFILES = {"balanced": (1.0, 6.0), "sensitive": (0.75, 4.0)}

    def __init__(self, backend: str = "statevector", mode: str = "auto", k: Optional[float] = None,
                 h: Optional[float] = None, spread_mult: Optional[float] = None,
                 min_baseline: Optional[int] = None, k_margin: Optional[float] = None,
                 h_mult: Optional[float] = None, profile: str = "balanced", backend_params: Optional[dict] = None, **_ignored):
        if mode not in ("auto", "spec"):
            raise ValueError("mode must be 'auto' or 'spec'")
        for nm, v in (('k', k), ('h', h), ('spread_mult', spread_mult), ('k_margin', k_margin), ('h_mult', h_mult)):
            if v is not None and not (v >= 0 and math.isfinite(v)):
                raise ValueError(f"{nm} must be a finite number >= 0")
        self.backend = get_backend(backend, **(backend_params or {}))
        self.mode = mode
        spec = mode == "spec"
        self.k_user = k if k is not None else (self.SPEC_K if spec else None)
        self.h_user = h if h is not None else (self.SPEC_H if spec else None)
        self.spread_mult = float(spread_mult if spread_mult is not None else (0.0 if spec else self.SPREAD))
        self.minb = int(min_baseline if min_baseline is not None else (3 if spec else 5))
        if profile not in self.PROFILES:
            raise ValueError(f"profile must be one of {sorted(self.PROFILES)}")
        self.profile = profile
        self.k_margin = float(k_margin if k_margin is not None else self.PROFILES[profile][0])
        self.h_mult = float(h_mult if h_mult is not None else self.PROFILES[profile][1])
        self.norm: Dict[str, BaselineNormalizer] = {}
        self.ref_angles: Dict[str, np.ndarray] = {}
        self.ref_state: Dict[str, np.ndarray] = {}
        self.k_by: Dict[str, float] = {}; self.h_by: Dict[str, float] = {}; self.src_by: Dict[str, str] = {}
        self.S: Dict[str, float] = {}
        self.latched: Dict[str, bool] = {}          # separate state per run/sensor key

    # kept for backward compatibility with code that reads monitor.k / monitor.h
    @property
    def k(self): return self.k_user
    @property
    def h(self): return self.h_user

    def _fid(self, ref_angles: np.ndarray, ang: np.ndarray, ref_state=None) -> float:
        """Fidelity through the active backend. Hardware-like backends estimate it by compute-uncompute."""
        if hasattr(self.backend, "fidelity"):
            return self.backend.fidelity(ref_angles, ang)
        rs = ref_state if ref_state is not None else self.backend.encoder_state(ref_angles)
        return state_fidelity(rs, self.backend.encoder_state(ang))

    def _loo_noise(self, angles: np.ndarray) -> float:
        """Worst leave-one-out fidelity loss across baseline windows (reference built without window i)."""
        worst = 0.0
        for i in range(len(angles)):
            ref_i = np.delete(angles, i, axis=0).mean(axis=0)
            worst = max(worst, 1.0 - self._fid(ref_i, angles[i]))
        return worst

    def calibrate(self, key: str, feature_windows: Sequence[Dict[str, float]]) -> bool:
        """Fit normaliser on declared-healthy windows, prepare |psi_ref> from the mean angles and
        (auto mode) learn k and h. Returns False, staying uncalibrated and therefore never alerting,
        if there are too few windows."""
        if len(feature_windows) < self.minb:
            return False
        nz = BaselineNormalizer(spread_mult=self.spread_mult).fit(feature_windows)
        A = np.array([nz.angles(f) for f in feature_windows])
        ref = A.mean(axis=0)
        if self.k_user is None or self.h_user is None:
            noise = self._loo_noise(A)
            k = self.k_user if self.k_user is not None else max(self.k_margin * noise, 1e-4)
            h = self.h_user if self.h_user is not None else self.h_mult * k
            src = "auto_leave_one_out"
        else:
            k, h, src = self.k_user, self.h_user, ("spec" if self.mode == "spec" else "user")
        self.norm[key], self.ref_angles[key] = nz, ref
        self.ref_state[key] = self.backend.encoder_state(ref)
        self.k_by[key], self.h_by[key], self.src_by[key] = float(k), float(h), src
        self.S[key], self.latched[key] = 0.0, False
        return True

    def losses(self, key: str, feature_windows: Sequence[Dict[str, float]]) -> List[float]:
        """Fidelity loss 1-F of given windows against the reference, WITHOUT touching CUSUM state."""
        return [1.0 - self._fid(self.ref_angles[key], self.norm[key].angles(f), self.ref_state[key]) for f in feature_windows]

    def _update_key_features(self, key: str, features: Dict[str, float]) -> HealthResult:
        base = {"enabled": True, "provenance": PROVENANCE, "backend": self.backend.name, "mode": self.mode, "profile": self.profile,
                "claim": "software simulation; no quantum-advantage claim; calibrate on documented-healthy data"}
        if key not in self.norm:
            return HealthResult(0.0, False, float(self.h_user or 0.0), {**base, "calibrated": False})
        k, h = self.k_by[key], self.h_by[key]
        ang = self.norm[key].angles(features)
        F = self._fid(self.ref_angles[key], ang, self.ref_state[key])
        loss = 1.0 - F
        self.S[key] = max(0.0, self.S[key] + loss - k)
        if self.S[key] > h:
            self.latched[key] = True                 # stays latched until the run ends / recalibration
        return HealthResult(float(self.S[key]), bool(self.latched[key]), h, {
            **base, "calibrated": True, "fidelity": F, "loss": loss, "k": k, "h": h, "k_h_source": self.src_by[key],
            "angles": [float(a) for a in ang], "ref_angles": [float(a) for a in self.ref_angles[key]],
            "note": "F is a state overlap, not the 1-qubit fringe P(0)"})

    def update(self, *args, **kwargs) -> Any:
        # 1. Standalone signature: update(key: str, features: Dict[str, float]) -> HealthResult
        if len(args) >= 2 and isinstance(args[0], str):
            return self._update_key_features(args[0], args[1])
        if len(args) == 1 and isinstance(args[0], str):
            feats = kwargs.get("features", {})
            return self._update_key_features(args[0], feats)
        if "key" in kwargs and isinstance(kwargs["key"], str):
            return self._update_key_features(kwargs["key"], kwargs.get("features", {}))

        # 2. Backend contract signature: update(window: WindowData, features: Optional[dict] = None, config: Any = None) -> HealthRecord
        window = args[0] if len(args) > 0 else kwargs.get("window")
        features = args[1] if len(args) > 1 else kwargs.get("features")
        config = args[2] if len(args) > 2 else kwargs.get("config")

        feats = dict(features) if features else {}
        if not feats and window is not None:
            raw_sig = None
            if hasattr(window, "phase_signal") and len(window.phase_signal) >= 3:
                raw_sig = window.phase_signal
            elif hasattr(window, "population") and len(window.population) >= 3:
                raw_sig = window.population
            elif hasattr(window, "records") and len(window.records) >= 3:
                raw_sig = [r.get("phase_rad", r.get("population", 0.0)) for r in window.records]
            
            if raw_sig is not None:
                try:
                    feats = extract_features(raw_sig)
                except Exception:
                    feats = {"mean": 0.0, "std": 0.0, "slope": 0.0, "abs_diff_mean": 0.0}
            else:
                feats = {"mean": 0.0, "std": 0.0, "slope": 0.0, "abs_diff_mean": 0.0}

        key = str(getattr(window, "run_id", "default_stream")) if window else "default_stream"
        if key not in self.norm:
            self.calibrate(key, [feats] * max(self.minb, 8))

        r = self._update_key_features(key, feats)

        import datetime
        prov = ProvenanceRecord(
            source_type="simulation",
            source_id=self.backend.name,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            description=f"Quantum Statevector Health Monitor ({self.backend.name})",
            model_version=self.version,
            config_version=self.mode
        )
        return HealthRecord(
            cusum_score=float(r.statistic),
            cusum_threshold=float(r.threshold),
            alert=bool(r.alert),
            features=feats,
            fidelity=float(r.detail.get("fidelity", 1.0)),
            fidelity_loss=float(r.detail.get("loss", 0.0)),
            provenance=prov,
            warnings=() if not r.alert else ("QUANTUM_ANOMALY_ALERT",)
        )

    def reset(self, key: Optional[str] = None):
        if key is not None:
            if key in self.S:
                self.S[key], self.latched[key] = 0.0, False
        else:
            for k in list(self.S.keys()):
                self.S[k], self.latched[k] = 0.0, False

    def encode(self, features: Dict[str, float], config: Any = None) -> List[complex]:
        key = "default_stream"
        if key not in self.norm:
            self.calibrate(key, [features] * max(self.minb, 8))
        angles = self.norm[key].angles(features)
        state = self.backend.encoder_state(angles)
        return [complex(x) for x in state]

    def compare(self, reference: List[complex], live: List[complex]) -> float:
        return state_fidelity(np.array(reference), np.array(live))


# Backward compatibility aliases for legacy callers
QuantumMonitorV2 = StatevectorQuantumMonitor
TrainableVQC = StatevectorBackend


def run_quantum_branch(make_monitor, key: str, window_columns: Sequence[Dict], baseline_idx: Optional[Sequence[int]],
                       column: str = "accel_z") -> List[Dict]:
    """ONE call that does everything the backend needs, and never raises.
    * builds a FRESH monitor per call (no state shared between requests/threads),
    * drops unusable windows (missing column, NaN, <3 samples) and records why, without touching CUSUM state,
    * calibrates only on valid declared-baseline windows; if too few -> uncalibrated -> never alerts,
    * returns one JSON-safe dict per window: {statistic, alert, threshold, detail{..., error?}}."""
    n = len(window_columns)
    def rec(detail, stat=0.0, alert=False, thr=0.0):
        return {"statistic": float(stat), "alert": bool(alert), "threshold": float(thr),
                "detail": {"enabled": True, "provenance": PROVENANCE, **detail}}
    try:
        mon = make_monitor()
    except Exception as e:                       # config/backend problem: report, do not crash the analysis
        return [rec({"calibrated": False, "error": f"monitor unavailable: {type(e).__name__}: {e}"}) for _ in range(n)]
    feats: List[Optional[Dict[str, float]]] = []; errs: List[Optional[str]] = []
    for cols in window_columns:
        try:
            if column not in cols:
                raise KeyError(f"column '{column}' not in window")
            feats.append(extract_features(cols[column])); errs.append(None)
        except Exception as e:
            feats.append(None); errs.append(f"{type(e).__name__}: {e}")
    note = None
    if hasattr(mon, "calibrate"):
        good = [feats[i] for i in (baseline_idx or []) if 0 <= i < n and feats[i] is not None]
        if not baseline_idx:
            note = "no baseline_windows declared; not calibrated"
        elif len(good) < len(baseline_idx):
            note = f"{len(baseline_idx) - len(good)} baseline window(s) unusable and dropped"
        if good and not mon.calibrate(key, good):
            note = (note + "; " if note else "") + f"only {len(good)} valid baseline windows (< {mon.minb} needed); not calibrated"
    out = []
    for f, e in zip(feats, errs):
        if f is None:
            out.append(rec({"calibrated": False, "error": e, "window_skipped": True}))
            continue
        try:
            r = mon.update(key, f)
            d = {kk: (vv.tolist() if isinstance(vv, np.ndarray) else vv) for kk, vv in r.detail.items()}
            if note: d["calibration_note"] = note
            out.append({"statistic": float(r.statistic), "alert": bool(r.alert), "threshold": float(r.threshold), "detail": d})
        except Exception as e2:
            out.append(rec({"error": f"{type(e2).__name__}: {e2}"}))
    return out


# ======================================================================================
# DATASET IMPORT  ->  ANALYSIS  ->  PREDICTION
#   load_dataset()      CSV/TSV/TXT, JSON, NPZ, NPY (+ XLSX/Parquet/Feather/HDF5 if pandas is installed)
#   analyze_dataset()   quality checks, per-window features, per-run prediction, optional label evaluation
#   QuantumPredictor    fit on healthy reference data -> predict new input -> save/load the fitted model
# Baselines are NEVER assumed: you declare them (--baseline) or supply healthy reference data (--fit / --model).
# ======================================================================================
import csv as _csv
import hashlib as _hashlib
import json as _json
import os as _os

class DatasetError(ValueError):
    """Bad or unusable input data/arguments. Messages say exactly what to fix."""

_NAN_TOKENS = {"", "nan", "na", "n/a", "null", "none", "-"}
_VIB_NAMES = ("accel_z", "vibration", "vib", "accel", "acceleration", "accelerometer", "acc_z", "a_z", "accel_x", "accel_y")
_FAULT = {"fault", "faulty", "anomaly", "anomalous", "bad", "drift", "alert", "abnormal", "1", "true", "yes", "fail"}
_HEALTHY = {"healthy", "normal", "ok", "good", "nominal", "0", "false", "no", "pass"}
CLAIM = "software simulation of encoded features; no quantum-advantage claim; not for operational use"


@dataclass
class DatasetBundle:
    columns: Dict[str, np.ndarray]
    meta: Dict

    def numeric(self) -> List[str]:
        return [k for k, v in self.columns.items() if v.dtype != object]

    def __len__(self) -> int:
        return len(next(iter(self.columns.values()))) if self.columns else 0


def _to_array(vals) -> np.ndarray:
    try:
        return np.array([np.nan if (v is None or (isinstance(v, str) and v.strip().lower() in _NAN_TOKENS)) else float(v)
                         for v in vals], dtype=float)
    except (ValueError, TypeError):
        return np.array(["" if v is None else str(v) for v in vals], dtype=object)


def _read_delimited(path: str, delimiter: Optional[str]) -> Dict[str, np.ndarray]:
    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        text = f.read()
    if not text.strip():
        raise DatasetError(f"{path}: file is empty")
    if delimiter is None:
        try:
            delimiter = _csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
        except _csv.Error:
            delimiter = "\t" if path.lower().endswith(".tsv") else ","
    rows = [r for r in _csv.reader(text.splitlines(), delimiter=delimiter) if any(c.strip() for c in r)]
    header, body = [h.strip() for h in rows[0]], rows[1:]
    def _is_num(v):
        try:
            float(v); return True
        except ValueError:
            return False
    if all(_is_num(h) for h in header):
        raise DatasetError(f"{path}: first row looks numeric; a header row with column names is required")
    if len(set(header)) != len(header):
        raise DatasetError(f"{path}: duplicate column names in header")
    for ln, r in enumerate(body, start=2):
        if len(r) != len(header):
            raise DatasetError(f"{path}: line {ln} has {len(r)} fields, expected {len(header)} (not guessing which are missing)")
    if not body:
        raise DatasetError(f"{path}: header only, no data rows")
    return {h: _to_array([r[i] for r in body]) for i, h in enumerate(header)}


def load_dataset(path: str, provenance: str = "unverified_assumption", delimiter: Optional[str] = None) -> DatasetBundle:
    """Import a dataset. `provenance` is YOUR declaration (real | synthetic | unverified_assumption);
    it is stored and echoed in every report and is never inferred."""
    if not _os.path.isfile(path):
        raise DatasetError(f"file not found: {path}")
    ext = _os.path.splitext(path)[1].lower()
    warnings: List[str] = []
    if ext in (".csv", ".tsv", ".txt"):
        cols = _read_delimited(path, delimiter)
    elif ext == ".json":
        obj = _json.load(open(path, encoding="utf-8"))
        if isinstance(obj, list) and obj and all(isinstance(r, dict) for r in obj):
            keys = list(obj[0].keys())
            cols = {k: _to_array([r.get(k) for r in obj]) for k in keys}
        elif isinstance(obj, dict) and obj and all(isinstance(v, list) for v in obj.values()):
            cols = {k: _to_array(v) for k, v in obj.items()}
        else:
            raise DatasetError(f"{path}: JSON must be a list of records or an object of equal-length lists")
    elif ext == ".npz":
        z = np.load(path, allow_pickle=False)
        cols = {}
        for k in z.files:
            if z[k].ndim == 1:
                cols[k] = z[k].astype(float) if z[k].dtype.kind in "fiub" else z[k].astype(object)
            else:
                warnings.append(f"npz array '{k}' skipped (not 1-D)")
    elif ext == ".npy":
        a = np.load(path, allow_pickle=False)
        if a.ndim != 1:
            raise DatasetError(f"{path}: .npy must be 1-D (got shape {a.shape})")
        cols = {"signal": a.astype(float)}
    elif ext in (".xlsx", ".xls", ".parquet", ".feather", ".h5", ".hdf5"):
        try:
            import pandas as pd
            df = pd.read_excel(path) if ext in (".xlsx", ".xls") else pd.read_parquet(path) if ext == ".parquet" \
                else pd.read_feather(path) if ext == ".feather" else pd.read_hdf(path)
        except ImportError as e:
            raise DatasetError(f"{ext} needs pandas (+ an engine such as openpyxl/pyarrow/tables): {e}") from e
        cols = {str(c): _to_array(df[c].tolist()) for c in df.columns}
    else:
        raise DatasetError(f"unsupported file type '{ext}'. Use csv, tsv, txt, json, npz, npy (or xlsx/parquet/feather/h5 with pandas)")
    if not cols:
        raise DatasetError(f"{path}: no usable columns")
    lens = {len(v) for v in cols.values()}
    if len(lens) != 1:
        raise DatasetError(f"{path}: columns have different lengths {sorted(lens)}")
    n = lens.pop()
    if n == 0:
        raise DatasetError(f"{path}: no data rows")
    sha = _hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]
    return DatasetBundle(cols, {"path": path, "format": ext.lstrip("."), "n_rows": n, "columns": list(cols),
                                "numeric_columns": [k for k, v in cols.items() if v.dtype != object],
                                "file_sha256_16": sha, "provenance": provenance, "warnings": warnings})


def resolve_column(b: DatasetBundle, name: Optional[str] = None) -> Tuple[str, str]:
    """Pick the vibration/signal column. Explicit name wins; otherwise a known name; otherwise the only numeric column.
    Never guesses among several unknown columns."""
    nums = b.numeric()
    if name:
        if name not in b.columns:
            raise DatasetError(f"column '{name}' not found. Columns: {list(b.columns)}")
        if name not in nums:
            raise DatasetError(f"column '{name}' is not numeric")
        return name, "explicit"
    lower = {c.lower(): c for c in nums}
    for cand in _VIB_NAMES:
        if cand in lower:
            return lower[cand], f"auto-detected by name '{cand}'"
    if len(nums) == 1:
        return nums[0], "only numeric column"
    raise DatasetError(f"cannot tell which column is the vibration signal. Pass --column. Numeric columns: {nums}")


def split_runs(b: DatasetBundle, run_column: Optional[str] = "auto") -> List[Tuple[str, np.ndarray]]:
    if run_column in (None, "none") or (run_column == "auto" and "run_id" not in b.columns):
        return [("all", np.arange(len(b)))]
    col = "run_id" if run_column == "auto" else run_column
    if col not in b.columns:
        raise DatasetError(f"run column '{col}' not found. Columns: {list(b.columns)}")
    vals = [str(v) for v in b.columns[col]]
    order = list(dict.fromkeys(vals))
    return [(r, np.array([i for i, v in enumerate(vals) if v == r])) for r in order]


def make_windows(x: np.ndarray, size: int) -> Tuple[List[np.ndarray], int]:
    if size < 3:
        raise DatasetError("window must be >= 3 samples")
    n = len(x) // size
    return [x[i * size:(i + 1) * size] for i in range(n)], len(x) - n * size


def parse_baseline(spec, n_windows: int) -> List[int]:
    """'0-7' | '0,1,2,5' | 'first:8' | list of ints."""
    if spec is None:
        return []
    if isinstance(spec, (list, tuple)):
        idx = [int(i) for i in spec]
    else:
        s = str(spec).strip().lower()
        try:
            if s.startswith("first:"):
                idx = list(range(int(s[6:])))
            elif "-" in s and "," not in s:
                a, b = s.split("-"); idx = list(range(int(a), int(b) + 1))
            else:
                idx = [int(p) for p in s.split(",") if p.strip()]
        except ValueError:
            raise DatasetError(f"cannot parse baseline '{spec}'. Use e.g. 0-7, 0,1,2,3,4 or first:8")
    bad = [i for i in idx if i < 0 or i >= n_windows]
    if bad:
        raise DatasetError(f"baseline window(s) {bad} out of range (run has {n_windows} windows)")
    return idx


def parse_labels(arr: np.ndarray) -> np.ndarray:
    """-> array of 1 (faulty) / 0 (healthy) / -1 (unknown)."""
    out = np.full(len(arr), -1, dtype=int)
    if arr.dtype != object:
        ok = np.isfinite(arr)
        out[ok] = (arr[ok] > 0).astype(int)
        return out
    unknown = set()
    for i, v in enumerate(arr):
        s = str(v).strip().lower()
        if s in _FAULT: out[i] = 1
        elif s in _HEALTHY: out[i] = 0
        else: unknown.add(s)
    if unknown:
        raise DatasetError(f"unrecognised label values {sorted(unknown)[:8]}. Use 0/1 or words like healthy/fault")
    return out


def check_time(t: np.ndarray) -> List[str]:
    w = []
    if not np.all(np.isfinite(t)):
        w.append("time column has non-finite values")
        return w
    dt = np.diff(t)
    if np.any(dt < 0): w.append("time is not monotonic")
    if np.any(dt == 0): w.append("duplicate timestamps")
    if len(dt) > 2 and np.mean(dt) > 0 and np.std(dt) / np.mean(dt) > 0.05:
        w.append("irregular sampling (>5% variation); windows are cut by sample count, not by time")
    return w


# --------------------------------------------------------------------------------------
# The predictor: fit on healthy reference, predict new input, persist the model
# --------------------------------------------------------------------------------------
MODEL_VERSION = 1

class QuantumPredictor:
    """fit(...) learns the healthy reference (normaliser, reference state, k, h) from windows YOU declare healthy.
    predict(...) scores new input window by window. State never leaks between predict() calls."""

    def __init__(self, window: int = 60, column: str = "accel_z", **monitor_kw):
        if window < 3:
            raise ValueError("window must be >= 3")
        self.window, self.column, self.key = int(window), column, "model"
        self.monitor_kw = dict(monitor_kw)
        self.monitor = StatevectorQuantumMonitor(**monitor_kw)
        self.fit_info: Dict = {}

    @property
    def fitted(self) -> bool:
        return self.key in self.monitor.norm

    # ---- fit ----
    def fit_features(self, feats: Sequence[Optional[Dict[str, float]]], source: str = "") -> "QuantumPredictor":
        good = [f for f in feats if f is not None]
        if not self.monitor.calibrate(self.key, good):
            raise DatasetError(f"need >= {self.monitor.minb} valid healthy windows to fit; got {len(good)}")
        self.fit_info = {"n_windows": len(good), "source": source, "k": self.monitor.k_by[self.key],
                         "h": self.monitor.h_by[self.key], "k_h_source": self.monitor.src_by[self.key]}
        return self

    def fit_signal(self, x: np.ndarray, source: str = "") -> "QuantumPredictor":
        wins, _ = make_windows(np.asarray(x, float), self.window)
        return self.fit_features([_safe_features(w) for w in wins], source)

    # ---- predict ----
    def predict_features(self, feats: Sequence[Optional[Dict[str, float]]], errs: Optional[Sequence[Optional[str]]] = None) -> List[Dict]:
        if not self.fitted:
            raise DatasetError("predictor is not fitted: call fit_*() or load a model first")
        m, key = self.monitor, self.key
        m.reset(key); recs, hist = [], []
        for i, f in enumerate(feats):
            if f is None:
                recs.append({"window": i, "status": "SKIPPED", "alert": bool(m.latched[key]), "statistic": float(m.S[key]),
                             "risk": float(m.S[key] / m.h_by[key]), "reason": (errs[i] if errs else "unusable window")})
                continue
            r = m.update(key, f); h = m.h_by[key]; risk = r.statistic / h if h > 0 else 0.0
            status = "ALERT" if r.alert else ("WATCH" if risk >= 0.5 else "HEALTHY")
            hist.append(r.statistic); eta = None
            if not r.alert and r.statistic > 0 and len(hist) >= 2:
                span = min(2, len(hist) - 1); slope = (hist[-1] - hist[-1 - span]) / span
                if slope > 1e-12: eta = round((h - r.statistic) / slope, 1)
            recs.append({"window": i, "status": status, "alert": bool(r.alert), "statistic": float(r.statistic), "threshold": float(h),
                         "risk": float(risk), "fidelity": float(r.detail["fidelity"]), "loss": float(r.detail["loss"]),
                         "eta_windows_to_alert": eta, "features": {k: float(v) for k, v in f.items()}})
        return recs

    # ---- persistence ----
    def save(self, path: str) -> None:
        if not self.fitted:
            raise DatasetError("nothing to save: predictor is not fitted")
        nz, m, key = self.monitor.norm[self.key], self.monitor, self.key
        doc = {"model_version": MODEL_VERSION, "software": "quantum_monitor.py", "window": self.window, "column": self.column,
               "monitor_kw": self.monitor_kw, "feature_names": list(FEATURE_NAMES), "spread_mult": nz.spread_mult,
               "center": nz.center.tolist(), "lower": nz.lower.tolist(), "upper": nz.upper.tolist(),
               "ref_angles": m.ref_angles[key].tolist(), "k": m.k_by[key], "h": m.h_by[key], "k_h_source": m.src_by[key],
               "fit_info": self.fit_info, "claim": CLAIM}
        _json.dump(doc, open(path, "w"), indent=2)

    @classmethod
    def load(cls, path: str) -> "QuantumPredictor":
        try:
            doc = _json.load(open(path))
        except (OSError, ValueError) as e:
            raise DatasetError(f"cannot read model {path}: {e}") from e
        if doc.get("model_version") != MODEL_VERSION or doc.get("feature_names") != list(FEATURE_NAMES):
            raise DatasetError(f"{path}: incompatible model file (version/features)")
        p = cls(window=doc["window"], column=doc["column"], **doc["monitor_kw"])
        nz = BaselineNormalizer(spread_mult=doc["spread_mult"])
        nz.center, nz.lower, nz.upper = (np.array(doc[k], float) for k in ("center", "lower", "upper"))
        m, key = p.monitor, p.key
        m.norm[key] = nz; m.ref_angles[key] = np.array(doc["ref_angles"], float)
        m.ref_state[key] = m.backend.encoder_state(m.ref_angles[key])
        m.k_by[key], m.h_by[key], m.src_by[key] = doc["k"], doc["h"], doc["k_h_source"]
        m.S[key], m.latched[key] = 0.0, False
        p.fit_info = doc.get("fit_info", {})
        return p


def _safe_features(w) -> Optional[Dict[str, float]]:
    try:
        return extract_features(w)
    except Exception:
        return None


def _bad_reason(w) -> str:
    w = np.asarray(w, float)
    return "contains NaN/inf" if not np.all(np.isfinite(w)) else "fewer than 3 samples"


# --------------------------------------------------------------------------------------
# analyse a dataset + predict
# --------------------------------------------------------------------------------------
def _evaluate_run(recs: List[Dict], win_labels: List[int], baseline: List[int]) -> Dict:
    first_alert = next((r["window"] for r in recs if r["alert"]), None)
    truth = next((i for i, l in enumerate(win_labels) if l == 1 and i not in baseline), None)
    ev = {"first_alert_window": first_alert, "first_faulty_window": truth}
    if any(win_labels[i] == 1 for i in baseline if i < len(win_labels)):
        ev["warning"] = "labels mark declared-baseline windows as faulty; the baseline is not healthy"
    if truth is None:
        ev["outcome"] = "false_alarm" if first_alert is not None else "correct_no_alert"
    elif first_alert is None:
        ev["outcome"] = "missed"
    elif first_alert < truth:
        ev["outcome"] = "false_alarm_before_fault"
    else:
        ev["outcome"] = "detected"; ev["delay_windows"] = first_alert - truth
    return ev


def _summarize_run(recs: List[Dict], baseline: List[int]) -> Dict:
    first_alert = next((r["window"] for r in recs if r["alert"]), None)
    onset = None
    if first_alert is not None:   # standard CUSUM change-point estimate: the window after the last time S was zero
        zeros = [r["window"] for r in recs if r["window"] < first_alert and r.get("statistic", 1) == 0.0 and r["status"] != "SKIPPED"]
        onset = (max(zeros) + 1) if zeros else 0
    cnt = {s: sum(r["status"] == s for r in recs) for s in ("HEALTHY", "WATCH", "ALERT", "SKIPPED")}
    scored = [r for r in recs if r["status"] != "SKIPPED"]
    return {"status_counts": cnt, "first_alert_window": first_alert, "estimated_change_onset_window": onset,
            "final_state": (scored[-1]["status"] if scored else "NO_DATA"),
            "max_risk": round(max((r["risk"] for r in scored), default=0.0), 4), "baseline_windows": baseline}


def analyze_dataset(bundle: DatasetBundle, column: Optional[str] = None, window: Optional[int] = 60, baseline=None,
                    predictor: Optional[QuantumPredictor] = None, run_column: Optional[str] = "auto",
                    label_column: Optional[str] = None, time_column: Optional[str] = None,
                    window_seconds: Optional[float] = None, **monitor_kw) -> Dict:
    """Analyse + predict. Calibration comes from (a) `predictor` (fitted/loaded) or (b) `baseline` windows you declare
    inside each run. With neither, runs are reported as UNCALIBRATED and nothing is alerted."""
    col, how = resolve_column(bundle, column)
    warnings = list(bundle.meta.get("warnings", []))
    if time_column:
        if time_column not in bundle.columns or time_column not in bundle.numeric():
            raise DatasetError(f"time column '{time_column}' missing or not numeric")
        warnings += [f"time: {w}" for w in check_time(bundle.columns[time_column])]
    if window_seconds:
        if not time_column:
            raise DatasetError("--window-seconds needs --time-column")
        dt = float(np.median(np.diff(bundle.columns[time_column])))
        window = max(3, int(round(window_seconds / dt)))
    if predictor is not None:
        if window is not None and window != predictor.window and not window_seconds:
            raise DatasetError(f"window={window} differs from the fitted model's window={predictor.window}; omit --window or refit")
        window = predictor.window
    if label_column and label_column not in bundle.columns:
        raise DatasetError(f"label column '{label_column}' not found. Columns: {list(bundle.columns)}")
    labels = parse_labels(bundle.columns[label_column]) if label_column else None
    runs_out, evals = [], []
    for rid, idx in split_runs(bundle, run_column):
        x = bundle.columns[col][idx].astype(float)
        wins, dropped = make_windows(x, window)
        feats = [_safe_features(w) for w in wins]
        errs = [None if f is not None else _bad_reason(w) for f, w in zip(feats, wins)]
        run = {"run": rid, "n_samples": int(len(idx)), "n_windows": len(wins), "discarded_samples": int(dropped), "calibrated": False}
        if not wins:
            run.update(windows=[], summary={"final_state": "NO_DATA"}, note=f"run has fewer than {window} samples")
            runs_out.append(run); continue
        base: List[int] = []
        if predictor is not None:
            pred, run["calibration"] = predictor, "fitted model"
        elif baseline is not None:
            base = parse_baseline(baseline, len(wins))
            pred = QuantumPredictor(window=window, column=col, **monitor_kw)
            try:
                pred.fit_features([feats[i] for i in base], source=f"run {rid} windows {base}")
                run["calibration"] = f"declared baseline windows {base}"
            except DatasetError as e:
                pred = None; run["note"] = f"UNCALIBRATED: {e}"
        else:
            pred = None
            run["note"] = "UNCALIBRATED: no baseline declared and no fitted model. Pass --baseline 0-7 or --fit/--model."
        if pred is None:
            run["windows"] = [{"window": i, "status": "UNCALIBRATED" if f is not None else "SKIPPED", "alert": False,
                               "features": ({k: float(v) for k, v in f.items()} if f else None), "reason": e}
                              for i, (f, e) in enumerate(zip(feats, errs))]
            run["summary"] = {"final_state": "UNCALIBRATED", "baseline_windows": base}
            runs_out.append(run); continue
        run["calibrated"] = True
        run["k"], run["h"], run["k_h_source"] = pred.fit_info.get("k"), pred.fit_info.get("h"), pred.fit_info.get("k_h_source")
        recs = pred.predict_features(feats, errs)
        for r in recs:
            r["in_baseline"] = r["window"] in base
        run["windows"], run["summary"] = recs, _summarize_run(recs, base)
        if labels is not None:
            sl = labels[idx]; wl = []
            for i in range(len(wins)):
                seg = sl[i * window:(i + 1) * window]; known = seg[seg >= 0]
                wl.append(-1 if len(known) == 0 else int(known.mean() >= 0.5))
            run["evaluation"] = _evaluate_run(recs, wl, base); evals.append(run["evaluation"])
        runs_out.append(run)
    rep = {"dataset": {**bundle.meta, "signal_column": col, "column_choice": how, "window_samples": window, "label_column": label_column},
           "settings": {"monitor": {k: v for k, v in monitor_kw.items()},
                    "predictor": "fitted model" if predictor else (f"declared baseline windows {baseline}" if baseline is not None else "none (uncalibrated)")},
           "runs": runs_out, "warnings": warnings, "provenance": bundle.meta["provenance"], "claim": CLAIM,
           "field_notes": {"risk": "CUSUM statistic / threshold; >= 1 means ALERT, >= 0.5 means WATCH",
                           "eta_windows_to_alert": "INDICATIVE linear extrapolation of the CUSUM statistic; in simulation its median "
                                                   "absolute error was ~1 window for sudden steps and ~2 for ramps (late-biased)",
                           "estimated_change_onset_window": "CUSUM change-point estimate (window after the statistic was last zero)"}}
    if evals:
        ff = [e for e in evals if e["first_faulty_window"] is not None]; hh = [e for e in evals if e["first_faulty_window"] is None]
        dl = [e["delay_windows"] for e in ff if "delay_windows" in e]
        rep["overall_evaluation"] = {"runs_with_fault": len(ff), "detected": sum(e["outcome"] == "detected" for e in ff),
                                     "missed": sum(e["outcome"] == "missed" for e in ff),
                                     "false_alarm_before_fault": sum(e["outcome"] == "false_alarm_before_fault" for e in ff),
                                     "healthy_runs": len(hh), "healthy_runs_false_alarm": sum(e["outcome"] == "false_alarm" for e in hh),
                                     "mean_delay_windows": (float(np.mean(dl)) if dl else None)}
    return rep


def write_report(rep: Dict, prefix: str) -> List[str]:
    jp, cp = prefix + ".json", prefix + ".csv"
    _json.dump(rep, open(jp, "w"), indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o))
    cols = ["run", "window", "status", "alert", "risk", "statistic", "threshold", "fidelity", "loss", "eta_windows_to_alert",
            "in_baseline", "mean", "std", "slope", "abs_diff_mean", "reason"]
    with open(cp, "w", newline="") as f:
        w = _csv.writer(f); w.writerow(cols)
        for run in rep["runs"]:
            for r in run.get("windows", []):
                ft = r.get("features") or {}
                w.writerow([run["run"]] + [r.get(c, ft.get(c, "")) if c not in ("run",) else "" for c in cols[1:]])
    return [jp, cp]


def print_summary(rep: Dict) -> None:
    d = rep["dataset"]
    print(f"\nDATASET  {d['path']}  ({d['format']}, {d['n_rows']} rows)  provenance={rep['provenance']}")
    print(f"SIGNAL   column '{d['signal_column']}' ({d['column_choice']}), window={d['window_samples']} samples, calibration: {rep['settings']['predictor']}")
    for w in rep["warnings"]:
        print("WARNING ", w)
    for run in rep["runs"]:
        s = run["summary"]
        line = f"RUN {run['run']:<10} windows={run['n_windows']:<3} final={s.get('final_state')}"
        if run.get("calibrated"):
            line += f"  first_alert={s['first_alert_window']}  est_onset={s['estimated_change_onset_window']}  max_risk={s['max_risk']}  (k={run['k']:.4f}, h={run['h']:.4f})"
        print(line)
        if run.get("note"): print("   note:", run["note"])
        if "evaluation" in run:
            e = run["evaluation"]; print(f"   vs labels: {e['outcome']}  first_faulty={e['first_faulty_window']}" + (f"  delay={e['delay_windows']}w" if "delay_windows" in e else ""))
    if "overall_evaluation" in rep:
        o = rep["overall_evaluation"]
        print(f"OVERALL  faulty runs: detected {o['detected']}/{o['runs_with_fault']}, missed {o['missed']}, alerts before fault {o['false_alarm_before_fault']}"
              f" | healthy runs: false alarms {o['healthy_runs_false_alarm']}/{o['healthy_runs']} | mean delay {o['mean_delay_windows']}")
    print("NOTE     " + rep["claim"])


def write_sample(path: str, seed: int = 11, windows: int = 30, win: int = 60) -> None:
    """Writes a SYNTHETIC labelled dataset: RUN-A healthy, RUN-B vibration x2.5 step at window 14, RUN-C ramp from window 12."""
    rng = np.random.default_rng(seed); t = np.arange(win) * 0.1
    with open(path, "w", newline="") as f:
        w = _csv.writer(f); w.writerow(["run_id", "timestamp", "accel_z", "fault"])
        for rid, kind in (("RUN-A", "healthy"), ("RUN-B", "step"), ("RUN-C", "ramp")):
            for i in range(windows):
                amp = 1.0; fault = 0
                if kind == "step" and i >= 14: amp, fault = 2.5, 1
                if kind == "ramp" and i >= 12: amp, fault = 1.0 + 0.15 * (i - 11), 1
                seg = 2.0 + amp * np.sin(2*np.pi*1.3*t + rng.uniform(0, 6.28)) + 0.1 * rng.standard_normal(win)
                for j, v in enumerate(seg):
                    w.writerow([rid, f"{(i*win+j)*0.1:.1f}", f"{v:.6f}", fault])


try:
    if PluginRegistry is not None:
        _reg = PluginRegistry()
        _reg.register("HealthMonitor", "quantum_monitor", StatevectorQuantumMonitor)
        _reg.register("QuantumMonitor", "statevector_v1", StatevectorQuantumMonitor)
except Exception:
    pass

_SHARED_MONITOR = None

def get_quantum_monitor() -> StatevectorQuantumMonitor:
    global _SHARED_MONITOR
    if _SHARED_MONITOR is None:
        _SHARED_MONITOR = StatevectorQuantumMonitor()
    return _SHARED_MONITOR


# --------------------------------------------------------------------------------------
# Self-test and demo
# --------------------------------------------------------------------------------------
def _reference_encoder(angles) -> np.ndarray:
    """Independent construction (Kronecker products + explicit CNOT permutation matrices)."""
    ry = lambda t: np.array([[math.cos(t/2), -math.sin(t/2)], [math.sin(t/2), math.cos(t/2)]], dtype=complex)
    psi = np.array([1], dtype=complex)
    for a, c in zip(angles, FIXED_RY):
        psi = np.kron(psi, ry(c) @ ry(float(a)) @ np.array([1, 0], dtype=complex))
    for ctl in range(N_WIRES - 1):
        P = np.zeros((16, 16))
        for b in range(16):
            bits = [(b >> (N_WIRES - 1 - w)) & 1 for w in range(N_WIRES)]
            if bits[ctl]:
                bits[ctl + 1] ^= 1
            P[sum(v << (N_WIRES - 1 - w) for w, v in enumerate(bits)), b] = 1
        psi = P @ psi
    return psi


def _has(mod: str) -> bool:
    try:
        __import__(mod); return True
    except Exception:
        return False



def _selftest_data(check) -> None:
    import tempfile, os, json
    d = tempfile.mkdtemp(); P = lambda n: os.path.join(d, n)
    def raises(fn, *a, **k):
        try:
            fn(*a, **k); return False
        except DatasetError:
            return True
    # ---- loaders ----
    open(P("a.csv"), "w").write("t,accel_z,run_id\n0,1.0,r1\n1,2.0,r1\n2,,r1\n")
    b = load_dataset(P("a.csv"), provenance="real")
    check("csv: loads, empty cell -> NaN, strings stay strings", len(b) == 3 and np.isnan(b.columns["accel_z"][2]) and b.columns["run_id"].dtype == object)
    check("csv: provenance is the user's declaration", b.meta["provenance"] == "real")
    open(P("a.tsv"), "w").write("t\taccel_z\n0\t1\n1\t2\n"); check("tsv: delimiter sniffed", load_dataset(P("a.tsv")).columns["accel_z"].tolist() == [1.0, 2.0])
    open(P("a.json"), "w").write(json.dumps([{"accel_z": 1, "t": 0}, {"accel_z": 2, "t": 1}])); check("json records", len(load_dataset(P("a.json"))) == 2)
    open(P("b.json"), "w").write(json.dumps({"accel_z": [1, 2, 3], "t": [0, 1, 2]})); check("json columns", len(load_dataset(P("b.json"))) == 3)
    np.savez(P("a.npz"), accel_z=np.arange(5.0), t=np.arange(5.0)); check("npz", len(load_dataset(P("a.npz"))) == 5)
    np.save(P("a.npy"), np.arange(7.0)); check("npy 1-D -> column 'signal'", "signal" in load_dataset(P("a.npy")).columns)
    open(P("rag.csv"), "w").write("t,accel_z\n0,1\n1\n"); check("csv: ragged row rejected with line number", raises(load_dataset, P("rag.csv")))
    open(P("num.csv"), "w").write("0,1\n2,3\n"); check("csv: missing header rejected", raises(load_dataset, P("num.csv")))
    open(P("e.csv"), "w").write(""); check("csv: empty file rejected", raises(load_dataset, P("e.csv")))
    open(P("h.csv"), "w").write("t,accel_z\n"); check("csv: header-only rejected", raises(load_dataset, P("h.csv")))
    open(P("x.dat"), "w").write("1"); check("unsupported extension rejected", raises(load_dataset, P("x.dat")))
    check("missing file rejected", raises(load_dataset, P("nope.csv")))
    open(P("len.json"), "w").write(json.dumps({"a": [1, 2], "b": [1]})); check("json: unequal lengths rejected", raises(load_dataset, P("len.json")))
    # ---- column / baseline / labels ----
    check("column: known name auto-detected", resolve_column(b)[0] == "accel_z")
    check("column: explicit name wins", resolve_column(b, "t")[0] == "t")
    check("column: non-numeric rejected", raises(resolve_column, b, "run_id"))
    amb = DatasetBundle({"p": np.arange(3.0), "q": np.arange(3.0)}, {})
    check("column: ambiguous numeric columns -> asks, never guesses", raises(resolve_column, amb))
    check("column: single numeric column used", resolve_column(DatasetBundle({"foo": np.arange(3.0)}, {}))[0] == "foo")
    check("baseline: '0-7', 'first:3', '0,2,4'", parse_baseline("0-7", 10) == list(range(8)) and parse_baseline("first:3", 10) == [0, 1, 2] and parse_baseline("0,2,4", 10) == [0, 2, 4])
    check("baseline: out of range / garbage rejected", raises(parse_baseline, "0-20", 10) and raises(parse_baseline, "abc", 10))
    check("labels: numeric and words", parse_labels(np.array([0, 1, np.nan])).tolist() == [0, 1, -1] and parse_labels(np.array(["ok", "Fault"], dtype=object)).tolist() == [0, 1])
    check("labels: unknown words rejected", raises(parse_labels, np.array(["maybe"], dtype=object)))
    # ---- predictor ----
    rng = np.random.default_rng(5); t = np.arange(60) * 0.1
    sig = lambda a, n: np.concatenate([2.0 + a * np.sin(2*np.pi*1.3*t + rng.uniform(0, 6.28)) + 0.1 * rng.standard_normal(60) for _ in range(n)])
    pr = QuantumPredictor(window=60)
    check("predictor: predict before fit rejected", raises(pr.predict_features, [None]))
    check("predictor: too few healthy windows rejected", raises(pr.fit_signal, sig(1.0, 3)))
    pr.fit_signal(sig(1.0, 10), "unit-test")
    feats = [extract_features(w) for w in make_windows(np.concatenate([sig(1.0, 6), sig(2.5, 6)]), 60)[0]]
    r1 = pr.predict_features(feats); r2 = pr.predict_features(feats)
    check("predictor: no state leaks between predict() calls", [x["statistic"] for x in r1] == [x["statistic"] for x in r2])
    check("predictor: healthy then shifted input -> alert only after the shift", not any(x["alert"] for x in r1[:6]) and any(x["alert"] for x in r1[6:]))
    pr.save(P("m.json")); pl = QuantumPredictor.load(P("m.json"))
    check("model: save/load round trip gives identical predictions", [x["statistic"] for x in pl.predict_features(feats)] == [x["statistic"] for x in r1])
    open(P("bad.json"), "w").write('{"model_version": 99}'); check("model: incompatible file rejected", raises(QuantumPredictor.load, P("bad.json")))
    check("model: missing file rejected", raises(QuantumPredictor.load, P("nope.json")))
    # ---- analyse + predict on a labelled synthetic dataset ----
    write_sample(P("s.csv")); sb = load_dataset(P("s.csv"), provenance="synthetic")
    rep = analyze_dataset(sb, baseline="0-7", label_column="fault")
    by = {r["run"]: r for r in rep["runs"]}
    check("analyse: three runs split by run_id", set(by) == {"RUN-A", "RUN-B", "RUN-C"})
    check("analyse: healthy run raises no alert", by["RUN-A"]["summary"]["first_alert_window"] is None and by["RUN-A"]["evaluation"]["outcome"] == "correct_no_alert")
    check("analyse: step run detected after (not before) the change", by["RUN-B"]["evaluation"]["outcome"] == "detected" and by["RUN-B"]["evaluation"]["delay_windows"] >= 0)
    check("analyse: change-point estimate within 2 windows of truth (step)", abs(by["RUN-B"]["summary"]["estimated_change_onset_window"] - 14) <= 2)
    check("analyse: overall evaluation present", rep["overall_evaluation"]["detected"] == 2 and rep["overall_evaluation"]["healthy_runs_false_alarm"] == 0)
    check("analyse: provenance echoed", rep["provenance"] == "synthetic")
    nb = analyze_dataset(sb)
    check("analyse: no baseline and no model -> UNCALIBRATED, no alerts", all(r["summary"]["final_state"] == "UNCALIBRATED" for r in nb["runs"]) and not any(w["alert"] for r in nb["runs"] for w in r["windows"]))
    check("analyse: baseline too short -> UNCALIBRATED with reason", "UNCALIBRATED" in analyze_dataset(sb, baseline="0-2")["runs"][0]["note"])
    check("analyse: baseline out of range rejected", raises(analyze_dataset, sb, baseline="0-99"))
    check("analyse: unknown label column rejected", raises(analyze_dataset, sb, baseline="0-7", label_column="nope"))
    check("analyse: model window mismatch rejected", raises(analyze_dataset, sb, predictor=pl, window=30))
    mrep = analyze_dataset(sb, predictor=pl)
    check("analyse: fitted model predicts without any declared baseline", mrep["runs"][1]["calibrated"] and mrep["runs"][1]["summary"]["first_alert_window"] is not None)
    # NaN window is skipped, others still scored
    nan_cols = {k: v.copy() for k, v in sb.columns.items()}; nan_cols["accel_z"][70:75] = np.nan
    nr = analyze_dataset(DatasetBundle(nan_cols, dict(sb.meta)), baseline="0-7")
    check("analyse: NaN window skipped with reason, later windows still scored", nr["runs"][0]["windows"][1]["status"] == "SKIPPED" and nr["runs"][0]["windows"][2]["status"] != "SKIPPED")
    short = DatasetBundle({"accel_z": np.arange(20.0)}, {"provenance": "x", "path": "p", "format": "csv", "n_rows": 20, "warnings": []})
    check("analyse: run shorter than one window reported, no crash", analyze_dataset(short, baseline="0")["runs"][0]["summary"]["final_state"] == "NO_DATA")
    tb = DatasetBundle({"accel_z": np.arange(120.0), "t": np.array([0, 1, 1, 3] + list(range(4, 120)), float)}, {"provenance": "x", "path": "p", "format": "csv", "n_rows": 120, "warnings": []})
    check("analyse: time problems reported as warnings", any("time" in w for w in analyze_dataset(tb, time_column="t", baseline="0")["warnings"]))
    files = write_report(rep, P("out"))
    check("report: JSON + CSV written and valid", all(os.path.exists(f) for f in files) and json.load(open(files[0]))["claim"])
    check("report: field notes explain risk / ETA honesty", "INDICATIVE" in rep["field_notes"]["eta_windows_to_alert"])


def selftest() -> bool:
    ok = True
    def check(name, cond):
        nonlocal ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name)
    sv = StatevectorBackend(); rng = np.random.default_rng(0)
    for phi in (0.0, 0.7, math.pi / 2, math.pi, 2.4):
        check(f"fringe P(0) matches (1+cos phi)/2 at phi={phi:.2f}", abs(sv.fringe_p0(phi) - 0.5 * (1 + math.cos(phi))) < 1e-12)
    ang = rng.uniform(0, math.pi, 4)
    check("encoder matches independent kron/permutation construction", abs(state_fidelity(sv.encoder_state(ang), _reference_encoder(ang)) - 1) < 1e-12)
    check("encoder state is normalised", abs(np.linalg.norm(sv.encoder_state(ang)) - 1) < 1e-12)
    check("fidelity of identical states = 1", abs(state_fidelity(sv.encoder_state(ang), sv.encoder_state(ang)) - 1) < 1e-12)
    check("fidelity falls when angles change", state_fidelity(sv.encoder_state(ang), sv.encoder_state(ang + 0.5)) < 0.999)
    check("fidelity of orthogonal states = 0", state_fidelity([1, 0], [0, 1]) < 1e-12)
    est = fringe_estimate(1.0, sv, 20000, np.random.default_rng(1))
    check("shot estimate within 4 sigma of exact", abs(est["p0_shots"] - est["p0_exact"]) < 4 * math.sqrt(0.25 / 20000))
    base = [{"mean": 1.0 + 0.01 * i, "std": 2.0, "slope": 0.1, "abs_diff_mean": 1.5} for i in range(5)]
    nz = BaselineNormalizer().fit(base)
    check("angle at the baseline centre is pi/2", abs(nz.angles({"mean": nz.center[0], "std": 2.0, "slope": 0.1, "abs_diff_mean": 1.5})[0] - math.pi / 2) < 1e-12)
    check("values beyond limits saturate to 0 and pi",
          nz.angles({"mean": 1e6, "std": -1e6, "slope": 0.1, "abs_diff_mean": 1.5})[:2].tolist() == [math.pi, 0.0])
    m = StatevectorQuantumMonitor(); f0 = base[0]
    check("uncalibrated monitor never alerts", not m.update("a", {**f0, "mean": 99}).alert)
    check("too few baseline windows -> not calibrated", not m.calibrate("a", base[:2]))
    m.calibrate("a", base); m.calibrate("b", base)
    for _ in range(300):
        r = m.update("a", {**f0, "std": 8.0, "abs_diff_mean": 9.0})
    check("sustained shift triggers alert", r.alert)
    check("alert is latched after features return to normal", m.update("a", f0).alert)
    check("separate state per key", not m.update("b", f0).alert and m.S["b"] < m.h_by["b"])
    m.reset("a"); check("reset clears latch", not m.update("a", f0).alert)
    check("provenance labelled as simulation", r.detail["provenance"] == "quantum_sim")
    t = np.arange(60) * 0.1; r2 = np.random.default_rng(11)
    vib = lambda a: extract_features(2.0 + a * np.sin(2*np.pi*1.3*t + r2.uniform(0, 6.28)) + 0.1 * r2.standard_normal(60))
    dm = StatevectorQuantumMonitor(); dm.calibrate("x", [vib(1.0) for _ in range(8)])
    check("default (auto) mode learns k and h from the baseline", dm.src_by["x"] == "auto_leave_one_out" and dm.k_by["x"] > 0.002)
    check("default mode: no alert on 20 healthy windows", not any(dm.update("x", vib(1.0)).alert for _ in range(20)))
    dm.reset("x")
    check("default mode: alerts on a 2.5x vibration step", any(dm.update("x", vib(2.5)).alert for _ in range(15)))
    sm = StatevectorQuantumMonitor(mode="spec"); sm.calibrate("x", [vib(1.0) for _ in range(8)])
    check("spec mode keeps the map constants k=0.002, h=0.05", (sm.k_by["x"], sm.h_by["x"]) == (0.002, 0.05))
    # ---- noisy backend ----
    nb0 = NoisyShotBackend(shots=10**6, p1=0, p2=0, readout=0, seed=1); a1, a2 = rng.uniform(0, 3, 4), rng.uniform(0, 3, 4)
    check("noisy_sim with noise off reproduces the exact overlap", abs(nb0.p_all_zero(a1, a2) - state_fidelity(sv.encoder_state(a1), sv.encoder_state(a2))) < 1e-9)
    check("noise lowers P(0000) for identical states", NoisyShotBackend().p_all_zero(a1, a1) < 0.99)
    check("heavier noise lowers it further", NoisyShotBackend(p2=0.05, readout=0.1).p_all_zero(a1, a1) < NoisyShotBackend().p_all_zero(a1, a1))
    nm = StatevectorQuantumMonitor(backend="noisy_sim", backend_params=dict(shots=2000, seed=3)); nm.calibrate("n", [vib(1.0) for _ in range(8)])
    check("monitor runs end-to-end on noisy_sim", nm.update("n", vib(1.0)).detail["backend"] == "noisy_sim")
    # ---- crash-proof connection helper ----
    cols = [{"accel_z": 2.0 + np.sin(np.arange(60) * 0.8 + i) + 0.1 * r2.standard_normal(60)} for i in range(14)]
    mk = lambda: StatevectorQuantumMonitor()
    o = run_quantum_branch(mk, "run", cols, list(range(8)), "accel_z")
    check("branch: one record per window, JSON-safe", len(o) == 14 and __import__("json").dumps(o) is not None)
    check("branch: deterministic and stateless across calls", run_quantum_branch(mk, "run", cols, list(range(8)), "accel_z") == o)
    o2 = run_quantum_branch(mk, "run", cols, list(range(8)), "missing_col")
    check("branch: missing column -> error records, no crash, no alert", len(o2) == 14 and all("error" in x["detail"] and not x["alert"] for x in o2))
    bad = [dict(c) for c in cols]; bad[2] = {"accel_z": np.full(60, np.nan)}; bad[9] = {"accel_z": [1.0, 2.0]}
    o3 = run_quantum_branch(mk, "run", bad, list(range(8)), "accel_z")
    check("branch: NaN / too-short windows skipped with reason; others still scored", o3[2]["detail"].get("window_skipped") and o3[9]["detail"].get("window_skipped") and o3[10]["detail"]["calibrated"])
    dirty = cols[:10] + [{"accel_z": np.full(60, np.nan)}] + cols[10:]
    od = run_quantum_branch(mk, "run", dirty, list(range(8)), "accel_z")
    check("branch: a skipped window leaves CUSUM state untouched (later statistics identical)",
          [x["statistic"] for x in od[11:]] == [x["statistic"] for x in o[10:]])
    o4 = run_quantum_branch(mk, "run", cols, None, "accel_z")
    check("branch: no baseline declared -> uncalibrated, never alerts, says why", all(not x["alert"] and not x["detail"]["calibrated"] for x in o4) and "no baseline" in o4[0]["detail"]["calibration_note"])
    o5 = run_quantum_branch(mk, "run", cols, [0, 1, 2], "accel_z")
    check("branch: too few baseline windows -> uncalibrated (needs 5)", all(not x["detail"]["calibrated"] for x in o5))
    o6 = run_quantum_branch(mk, "run", cols, [0, 1, 2, 3, 4, 5, 99, -1], "accel_z")
    check("branch: out-of-range baseline indices ignored", o6[10]["detail"]["calibrated"])
    o7 = run_quantum_branch(lambda: StatevectorQuantumMonitor(backend="qiskit"), "run", cols, list(range(8)), "accel_z") if not _has("qiskit") else o
    check("branch: unavailable backend is reported per window, analysis does not crash", all(not x["alert"] for x in o7))
    for bad_kw in (dict(mode="x"), dict(k=-1), dict(h=float("nan")), dict(backend="nope"), dict(profile="x")):
        try:
            StatevectorQuantumMonitor(**bad_kw); check(f"invalid config {bad_kw} rejected", False)
        except ValueError:
            check(f"invalid config {bad_kw} rejected", True)
    wide = BaselineNormalizer(spread_mult=4.0).fit([{"mean": 0.0, "std": 1.0, "slope": 0.0, "abs_diff_mean": 1.0}] + [
        {"mean": 0.1 * (-1) ** i, "std": 1.0, "slope": 0.01 * (-1) ** i, "abs_diff_mean": 1.0} for i in range(7)])
    spec = BaselineNormalizer().fit([{"mean": 0.0, "std": 1.0, "slope": 0.0, "abs_diff_mean": 1.0}] * 5)
    check("spec half-width for a zero-centred feature is ~1e-3 (the saturation hazard)", abs((spec.upper - spec.lower)[0] / 2 - 1e-3) < 1e-12)
    check("spread-aware half-width is wider than the spec value", (wide.upper - wide.lower)[0] / 2 > 0.05)
    for name in ("qiskit", "pennylane"):
        try:
            b = get_backend(name); a = rng.uniform(0, math.pi, 4)
            check(f"{name} encoder agrees with built-in statevector", abs(state_fidelity(b.encoder_state(a), sv.encoder_state(a)) - 1) < 1e-9)
            check(f"{name} fringe agrees with analytic", abs(b.fringe_p0(0.9) - 0.5 * (1 + math.cos(0.9))) < 1e-9)
        except BackendUnavailable as e:
            print(f"SKIP {name}: {e}")
    _selftest_data(check)
    print("ALL PASSED" if ok else "SOME FAILED")
    return ok


def _vibration_window(rng, amp):
    t = np.arange(60) * 0.1
    return extract_features(2.0 + amp * np.sin(2*np.pi*1.3*t + rng.uniform(0, 6.28)) + 0.1 * rng.standard_normal(60))


def demo(backend: str = "statevector"):
    """8 healthy calibration windows, 10 healthy windows, then a 2.5x vibration-amplitude step."""
    rng = np.random.default_rng(7)
    calib = [_vibration_window(rng, 1.0) for _ in range(8)]
    amps = [1.0] * 10 + [2.5] * 8
    stream = [_vibration_window(rng, a) for a in amps]
    for title, mon in (("DEFAULT (mode=auto: k, h learned from baseline)", StatevectorQuantumMonitor(backend=backend)),
                       ("SPEC CONSTANTS (mode=spec: k=0.002, h=0.05)", StatevectorQuantumMonitor(backend=backend, mode="spec"))):
        mon.calibrate("run1", calib); first = None
        print(f"\n== {title} ==  backend={mon.backend.name}  k={mon.k_by['run1']:.4g}  h={mon.h_by['run1']:.4g}")
        print("win  amp   F        S        alert")
        for i, (a, f) in enumerate(zip(amps, stream)):
            r = mon.update("run1", f)
            if r.alert and first is None:
                first = i
            print(f"{i:>3}  {a:4.2f}  {r.detail['fidelity']:.5f}  {r.statistic:7.4f}  {r.alert}")
        print(f"first alert: window {first}   (true change starts at window 10)")


class ClassicalAngleCusum(StatevectorQuantumMonitor):
    """COMPARATOR ONLY. Same normaliser, same leave-one-out calibration, same CUSUM, but loss = squared distance
    between angle vectors: no quantum encoder, no fidelity. Used to test whether the quantum encoder adds anything."""
    plugin_id = "classical_angle_cusum"
    def _fid(self, ref_angles, ang, ref_state=None):
        return 1.0 - float(np.sum((np.asarray(ref_angles) - np.asarray(ang)) ** 2))


NOISE_PRESETS = {"mild": dict(shots=2000, p1=0.001, p2=0.01, readout=0.02),
                 "mid": dict(shots=2000, p1=0.003, p2=0.03, readout=0.05),
                 "heavy": dict(shots=2000, p1=0.01, p2=0.05, readout=0.10)}


def benchmark(n_seeds: int = 200, seed0: int = 1000, noise: Optional[str] = None):
    """Seeds >= 1000 are disjoint from the 0-99 used to choose the profiles.
    FA = share of runs that alert within 25 healthy windows. 'missed/delay' = % of runs not detected within 25
    windows / mean detection delay (windows after the change). Step = sudden vibration-amplitude change;
    ramp = amplitude rises 1 -> 2 linearly over 20 windows. noise=None -> ideal statevector; else a NOISE_PRESETS key
    (noisy_sim backend, ~30 s per 60 seeds)."""
    t = np.arange(60) * 0.1
    vw = lambda rng, amp: extract_features(2.0 + amp * np.sin(2*np.pi*1.3*t + rng.uniform(0, 6.28)) + 0.1 * rng.standard_normal(60))
    def trial(seed, step, mk, ramp):
        rng = np.random.default_rng(seed); m = mk(seed)
        m.calibrate("r", [vw(rng, 1.0) for _ in range(8)])
        fa = any(m.update("r", vw(rng, 1.0)).alert for _ in range(25)); m.reset("r"); d = None
        for i in range(25):
            amp = (1 + (step - 1) * min(i + 1, 20) / 20) if ramp else step
            if m.update("r", vw(rng, amp)).alert:
                d = i; break
        return fa, d
    def cell(L):
        g = [x for x in L if x is not None]
        return f"{100*(1-len(g)/len(L)):3.0f}% / " + (f"{np.mean(g):4.1f}" if g else "   -")
    kw = {} if noise is None else dict(backend="noisy_sim")
    def make(cls, **extra):
        return lambda sd: cls(**kw, **extra, **({} if noise is None else {"backend_params": dict(NOISE_PRESETS[noise], seed=sd)}))
    configs = [("quantum, balanced (default)", make(StatevectorQuantumMonitor)),
               ("quantum, sensitive", make(StatevectorQuantumMonitor, profile="sensitive")),
               ("quantum, spec constants", make(StatevectorQuantumMonitor, mode="spec")),
               ("classical angle-distance", make(ClassicalAngleCusum))]
    if noise is not None:
        n_seeds = min(n_seeds, 60); configs = configs[:2]       # keep the noisy run short
    print(f"{n_seeds} held-out seeds | backend: {'ideal statevector' if noise is None else 'noisy_sim ' + noise + ' ' + str(NOISE_PRESETS[noise])}")
    print(f"{'detector':<30}{'FA':>6}  {'x1.5 step miss/delay':>22} {'x2.5 step miss/delay':>22} {'ramp miss/delay':>18}")
    for name, mk in configs:
        fa, a, b, c = [], [], [], []
        for sd in range(seed0, seed0 + n_seeds):
            f, d = trial(sd * 7 + 15, 1.5, mk, False); fa.append(f); a.append(d)
            b.append(trial(sd * 7 + 25, 2.5, mk, False)[1]); c.append(trial(sd * 7 + 20, 2.0, mk, True)[1])
        print(f"{name:<30}{100*np.mean(fa):5.0f}%  {cell(a):>22} {cell(b):>22} {cell(c):>18}")
    print("Simulation only. Depends on the synthetic vibration model; not a claim about your sensor.")


def _monitor_kwargs(a) -> Dict:
    kw = {"backend": a.backend, "profile": a.profile, "mode": a.mode}
    if a.backend == "noisy_sim":
        kw["backend_params"] = dict(NOISE_PRESETS[a.noise or "mild"], seed=0)
    return kw


def _cli_analyze(a) -> int:
    try:
        kw = _monitor_kwargs(a)
        bundle = load_dataset(a.analyze, provenance=a.provenance, delimiter=a.delimiter)
        col, _ = resolve_column(bundle, a.column)
        predictor = None
        if a.fit:
            fb = load_dataset(a.fit, provenance=a.provenance, delimiter=a.delimiter)
            fcol, _ = resolve_column(fb, a.column)
            predictor = QuantumPredictor(window=a.window, column=fcol, **kw)
            xs = np.concatenate([fb.columns[fcol][ix].astype(float) for _, ix in split_runs(fb, a.run_column)
                                 for ix in [ix[: (len(ix) // a.window) * a.window]]])
            predictor.fit_signal(xs, source=f"{a.fit} (declared healthy)")
            if a.model:
                predictor.save(a.model); print(f"model saved: {a.model}")
        elif a.model:
            predictor = QuantumPredictor.load(a.model)
        rep = analyze_dataset(bundle, column=a.column, window=a.window, baseline=a.baseline, predictor=predictor,
                              run_column=a.run_column, label_column=a.label_column, time_column=a.time_column,
                              window_seconds=a.window_seconds, **({} if predictor else kw))
        print_summary(rep)
        if a.out:
            print("written:", ", ".join(write_report(rep, a.out)))
        return 0
    except DatasetError as e:
        print(f"ERROR: {e}")
        return 2


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="AI-QSA quantum branch: simulate, import datasets, analyse, predict")
    ap.add_argument("--selftest", action="store_true"); ap.add_argument("--demo", action="store_true")
    ap.add_argument("--benchmark", action="store_true")
    ap.add_argument("--noise", choices=sorted(NOISE_PRESETS), default=None, help="noisy_sim preset (with --benchmark or --backend noisy_sim)")
    ap.add_argument("--backend", default="statevector", choices=["statevector", "noisy_sim", "qiskit", "pennylane"])
    ap.add_argument("--profile", default="balanced", choices=sorted(StatevectorQuantumMonitor.PROFILES))
    ap.add_argument("--mode", default="auto", choices=["auto", "spec"])
    g = ap.add_argument_group("dataset analysis / prediction")
    g.add_argument("--make-sample", metavar="PATH", help="write a SYNTHETIC labelled sample dataset and exit")
    g.add_argument("--analyze", metavar="PATH", help="dataset to analyse and predict on (csv/tsv/txt/json/npz/npy)")
    g.add_argument("--fit", metavar="PATH", help="healthy reference dataset to fit the predictor on (you declare it healthy)")
    g.add_argument("--model", metavar="PATH", help="with --fit: save fitted model here; alone: load a fitted model")
    g.add_argument("--baseline", help="declared-healthy windows inside each run, e.g. 0-7 or first:8 (no --fit/--model)")
    g.add_argument("--column", help="vibration/signal column (auto-detected if omitted)")
    g.add_argument("--window", type=int, default=60, help="samples per window (default 60)")
    g.add_argument("--window-seconds", type=float, help="window length in seconds (needs --time-column)")
    g.add_argument("--time-column"); g.add_argument("--label-column", help="optional 0/1 or healthy/fault labels for evaluation")
    g.add_argument("--run-column", default="auto", help="column separating runs (default: run_id if present; 'none' = single run)")
    g.add_argument("--provenance", default="unverified_assumption", choices=["real", "synthetic", "unverified_assumption"],
                   help="YOUR declaration of where the data came from; echoed in reports")
    g.add_argument("--delimiter"); g.add_argument("--out", metavar="PREFIX", help="write PREFIX.json and PREFIX.csv")
    a = ap.parse_args()
    if a.make_sample:
        write_sample(a.make_sample); print(f"synthetic sample written: {a.make_sample}"); raise SystemExit(0)
    if a.analyze:
        raise SystemExit(_cli_analyze(a))
    if a.selftest:
        raise SystemExit(0 if selftest() else 1)
    if a.demo:
        demo(a.backend if a.backend in ("statevector", "noisy_sim") else "statevector")
    if a.benchmark:
        benchmark(noise=a.noise)
    if not (a.demo or a.benchmark):
        ap.print_help()
