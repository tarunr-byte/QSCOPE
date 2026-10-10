import uuid
from typing import Dict, Any

class AuditWriter:
    def __init__(self, repository):
        self.repository = repository

    def log_event(self, analysis_id: str, event_type: str, details: Dict[str, Any]):
        log_id = str(uuid.uuid4())
        self.repository.save_audit_log(log_id, analysis_id, event_type, details)
