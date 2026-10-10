import pytest
import math
import numpy as np
from modules.quantum_simulation.qiskit_fringe_demo import QiskitFringeDemo
from modules.quantum_simulation.pennylane_state_encoder import PennyLaneStateEncoder
from modules.quantum_simulation.state_fidelity import compute_fidelity
from core.contracts import PhaseResult, WindowData
from modules.uncertainty.residual_uncertainty import ResidualUncertainty
from core.config import AppConfig

# Test the newly integrated Statevector Quantum Monitor & Components
from modules.quantum_simulation.quantum_monitor import (
    extract_features,
    BaselineNormalizer,
    StatevectorBackend,
    NoisyShotBackend,
    fringe_estimate,
    state_fidelity,
    StatevectorQuantumMonitor,
    QuantumPredictor,
)

def test_quantum_fringe_demo_analytic():
    """Test the quantum fringe probability fallback logic."""
    demo = QiskitFringeDemo()
    prob, backend = demo.compute_probability(0.0)
    assert math.isclose(prob, 1.0, abs_tol=1e-5)
    prob, backend = demo.compute_probability(math.pi)
    assert math.isclose(prob, 0.0, abs_tol=1e-5)

def test_quantum_state_encoder_analytic():
    """Test the built-in statevector fallback matches expected sizes."""
    encoder = PennyLaneStateEncoder()
    angles = [0.1, 0.2, 0.3, 0.4]
    state, backend = encoder.encode(angles)
    assert len(state) == 16
    total_prob = sum(abs(amp)**2 for amp in state)
    assert math.isclose(total_prob, 1.0, abs_tol=1e-5)

def test_state_fidelity():
    """Test quantum state fidelity comparisons."""
    ref_state = [1.0, 0.0, 0.0, 0.0]
    live_state = [1.0, 0.0, 0.0, 0.0]
    orthogonal_state = [0.0, 1.0, 0.0, 0.0]
    assert math.isclose(compute_fidelity(ref_state, live_state), 1.0)
    assert math.isclose(compute_fidelity(ref_state, orthogonal_state), 0.0)

def test_residual_uncertainty():
    """Test that uncertainty bounding logic respects profiles."""
    estimator = ResidualUncertainty()
    cfg = AppConfig(uncertainty_profile='narrow')
    pr = PhaseResult(
        phase_mean_rad=0.5,
        phase_spread_rad=0.1,
        residual_uncertainty_rad=0.01,
        method="test",
        valid=True
    )
    envelope = estimator.estimate(pr, config=cfg)
    assert math.isclose(envelope.phase_mean_range[0], 0.35)
    assert math.isclose(envelope.phase_mean_range[1], 0.65)

def test_quantum_feature_extraction():
    """Test feature extraction (mean, std, slope, abs_diff_mean)."""
    sig = [1.0, 2.0, 3.0, 4.0, 5.0]
    feats = extract_features(sig)
    assert feats["mean"] == 3.0
    assert math.isclose(feats["slope"], 1.0, abs_tol=1e-5)
    assert feats["abs_diff_mean"] == 1.0
    assert feats["std"] > 0

def test_statevector_backend_and_fringe():
    """Test StatevectorBackend circuit encoding and virtual shot fringe estimation."""
    backend = StatevectorBackend()
    angles = [0.1, 0.2, 0.3, 0.4]
    psi = backend.encoder_state(angles)
    # 4-qubit tensor product shape (2,2,2,2) or flattened length 16
    norm = np.linalg.norm(psi)
    assert math.isclose(norm, 1.0, abs_tol=1e-5)

    fringe = fringe_estimate(0.0, backend=backend, shots=2000)
    assert math.isclose(fringe["p0_exact"], 1.0, abs_tol=1e-5)
    assert 0.95 <= fringe["p0_shots"] <= 1.0

def test_baseline_normalizer():
    """Test baseline feature normalization into [0, pi] angles."""
    normalizer = BaselineNormalizer(spread_mult=4.0)
    cal_data = [
        {"mean": 0.5 + 0.01 * i, "std": 0.1, "slope": 0.0, "abs_diff_mean": 0.05}
        for i in range(10)
    ]
    normalizer.fit(cal_data)
    test_feats = {"mean": 0.55, "std": 0.1, "slope": 0.0, "abs_diff_mean": 0.05}
    angles = normalizer.angles(test_feats)
    assert len(angles) == 4
    for a in angles:
        assert 0.0 <= a <= math.pi

def test_statevector_quantum_monitor_cusum():
    """Test StatevectorQuantumMonitor calibration, fidelity overlap, and CUSUM alerting."""
    mon = StatevectorQuantumMonitor(mode="auto", k=0.01, h=0.05)
    key = "sensor_run_1"
    
    # 1. Calibrate on 8 healthy baseline windows
    healthy_feats = [
        {"mean": 0.5 + 0.005 * i, "std": 0.1, "slope": 0.0, "abs_diff_mean": 0.05}
        for i in range(8)
    ]
    cal_ok = mon.calibrate(key, healthy_feats)
    assert cal_ok is True
    assert key in mon.norm

    # 2. Update with healthy telemetry -> fidelity ~ 1, no alert
    res1 = mon.update(key, healthy_feats[0])
    assert res1.alert is False
    assert res1.statistic <= res1.threshold

    # 3. Feed anomalous/drifted features -> CUSUM accumulates and latches alert
    anomalous_feats = {"mean": 10.0, "std": 5.0, "slope": 2.0, "abs_diff_mean": 4.0}
    for _ in range(10):
        res = mon.update(key, anomalous_feats)
    
    assert res.alert is True
    assert mon.latched[key] is True
    assert res.statistic > res.threshold

    # 4. Reset clears latched alert
    mon.reset(key)
    assert mon.latched[key] is False
    assert mon.S[key] == 0.0

def test_noisy_shot_backend():
    """Test NoisyShotBackend with depolarization and readout noise."""
    backend = NoisyShotBackend(shots=500, p1=0.001, p2=0.01, readout=0.02, seed=42)
    ref_angles = [0.1, 0.2, 0.3, 0.4]
    live_angles = [0.1, 0.2, 0.3, 0.4]
    fid = backend.fidelity(ref_angles, live_angles)
    assert 0.8 <= fid <= 1.0
