from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router
from core.registry import PluginRegistry
from storage.sqlite_repository import SQLiteRepository
from core.config import AppConfig

# Import core plugins
from modules.data_sources.synthetic_source import SyntheticDataSource
from modules.data_sources.csv_source import CSVDataSource
from modules.preprocessing.validator import DataValidator
from modules.phase_reconstruction.simulated_reconstructor import SimulatedReconstructor
from modules.uncertainty.residual_uncertainty import ResidualUncertainty
from modules.measurement_models.fringe_model import FringeModel
from modules.estimators.ekf_estimator import EKFEstimator
from modules.estimators.phase_grid_estimator import PhaseGridEstimator
from modules.risk_certificates.dmean_certificate import DMeanCertificate
from modules.decision_policies.three_state_policy import ThreeStatePolicy
from modules.monitoring.cusum_monitor import CUSUMMonitor

# Import Quantum Engine
from modules.quantum_simulation.quantum_monitor import StatevectorQuantumMonitor, get_quantum_monitor


def _register_defaults(registry: PluginRegistry):
    registry.register("DataSource", "synthetic", SyntheticDataSource)
    registry.register("DataSource", "csv_source", CSVDataSource)
    registry.register("Preprocessor", "default", DataValidator)
    registry.register("PhaseReconstructor", "simulated", SimulatedReconstructor)
    registry.register("UncertaintyEstimator", "default", ResidualUncertainty)
    registry.register("MeasurementModel", "fringe_model_v1", FringeModel)
    registry.register("StateEstimator", "ekf_v1", EKFEstimator)
    registry.register("StateEstimator", "phase_grid_v1", PhaseGridEstimator)
    registry.register("RiskCertificatePlugin", "dmean_v1", DMeanCertificate)
    registry.register("DecisionPolicy", "three_state_v1", ThreeStatePolicy)
    registry.register("HealthMonitor", "cusum_v1", CUSUMMonitor)
    # Register the new quantum engine
    registry.register("HealthMonitor", "quantum_monitor", StatevectorQuantumMonitor)
    registry.register("QuantumMonitor", "statevector_v1", StatevectorQuantumMonitor)


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = AppConfig()
    app.state.config = config
    
    registry = PluginRegistry()
    _register_defaults(registry)
    app.state.registry = registry
    
    # Live quantum monitor instance
    app.state.quantum_monitor = get_quantum_monitor()
    
    repository = SQLiteRepository(config.database_path)
    if hasattr(repository, "initialize"):
        repository.initialize()
    app.state.repository = repository
    yield


app = FastAPI(
    title="QSCOPE — Quantum Sensor Condition Observation & Prognostics Engine",
    version="2.1.0",
    description="Quantum Sensor Observation with Q-SCOPE Risk Certificate & Statevector Quantum Health Monitor",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app.main:app', host='0.0.0.0', port=8000, reload=True)
