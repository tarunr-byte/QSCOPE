import pytest
from fastapi.testclient import TestClient
from app.main import app
import math

client = TestClient(app)

def test_root_and_health():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "ATOM-QSA"
    
    response = client.get("/health")
    assert response.status_code == 200
    assert "Statevector Quantum Monitor" in response.json()["quantum_engine_status"]

def test_quantum_status():
    response = client.get("/quantum/status")
    assert response.status_code == 200
    data = response.json()
    assert data["qubits"] == 4
    assert data["status"] == "active"
    assert "Statevector Quantum Monitor" in data["engine"]
    assert data["backend"] == "statevector"

def test_quantum_monitor_single_window():
    # Pass 60 telemetry samples (e.g. sine wave)
    signal = [math.sin(i * 0.1) for i in range(60)]
    response = client.post("/quantum/monitor-window", json={"signal": signal})
    assert response.status_code == 200
    data = response.json()
    assert "statistic" in data
    assert "alert" in data
    assert "threshold" in data
    assert "fidelity" in data
    assert "features" in data
    assert 0.0 <= data["fidelity"] <= 1.0

def test_quantum_stream_processing():
    # Pass a continuous live stream (120 points)
    signal = [math.sin(i * 0.1) for i in range(120)]
    response = client.post("/quantum/stream", json={"signal": signal, "window_size": 30, "stride": 15})
    assert response.status_code == 200
    data = response.json()
    assert data["total_windows"] > 0
    assert "stream_trajectory" in data

def test_analyze_window_includes_quantum():
    # Test analyze-window with synthetic telemetry
    response = client.post("/analyze-window", json={
        "window_id": "0",
        "phase_signal": [0.1 * i for i in range(60)],
        "population": [0.5 + 0.1 * math.sin(i) for i in range(60)]
    })
    assert response.status_code == 200
    data = response.json()
    assert "phase_result" in data
    assert "risk_certificate" in data
    assert "decision_result" in data
    assert "health_record" in data
    assert "cusum_score" in data["health_record"]
