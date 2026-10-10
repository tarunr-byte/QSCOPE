import os
from dataclasses import dataclass, field
from typing import List

def _get_default_db_path() -> str:
    if os.environ.get("VERCEL"):
        return "/tmp/atom_qsa.db"
    return os.environ.get("DATABASE_PATH", "atom_qsa.db")

@dataclass
class AppConfig:
    mode: str = 'synthetic'
    window_size: int = 60
    baseline_windows: int = 8
    measurement_p0: float = 0.5
    measurement_amplitude: float = 0.5
    measurement_contrast: float = 0.88
    measurement_phi0: float = 0.0
    uncertainty_profile: str = 'wide'
    threshold: float = 0.067349
    cusum_k: float = 0.002
    cusum_h: float = 0.05
    atom_count_default: int = 2000
    shots: int = 2000
    seed: int = 42
    database_path: str = field(default_factory=_get_default_db_path)
    log_level: str = 'INFO'
    cors_origins: List[str] = field(default_factory=lambda: ['http://localhost:3000'])
    max_upload_size_mb: int = 50
    quantum_enabled: bool = False
    quantum_backend: str = 'auto'
