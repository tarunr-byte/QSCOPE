import hashlib
import json
from datetime import datetime, timezone
from core.contracts import ProvenanceRecord
from core.config import AppConfig

SOFTWARE_VERSION = '1.0.0'

def get_software_version() -> str:
    return SOFTWARE_VERSION

def get_config_version(config: AppConfig) -> str:
    config_dict = config.__dict__
    config_str = json.dumps(config_dict, sort_keys=True)
    return hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:8]

def create_provenance(source_type: str, source_id: str, description: str, **kwargs) -> ProvenanceRecord:
    timestamp = datetime.now(timezone.utc).isoformat()
    return ProvenanceRecord(
        source_type=source_type,
        source_id=source_id,
        timestamp=timestamp,
        description=description,
        model_version=kwargs.get('model_version', SOFTWARE_VERSION),
        config_version=kwargs.get('config_version', ''),
        warnings=kwargs.get('warnings', ())
    )

def validate_provenance(record: ProvenanceRecord) -> bool:
    if not record.source_type or not record.source_id or not record.timestamp:
        return False
    return True
