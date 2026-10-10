from typing import Optional, Dict, Any

class AtomQSAError(Exception):
    def __init__(self, reason: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(reason)
        self.reason = reason
        self.details = details or {}

class ValidationError(AtomQSAError):
    pass

class ConfigurationError(AtomQSAError):
    pass

class PluginError(AtomQSAError):
    pass

class CalibrationError(AtomQSAError):
    pass

class ProvenanceError(AtomQSAError):
    pass

class InvalidInputError(AtomQSAError):
    def __init__(self, reason: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(f"INVALID_INPUT: {reason}", details)

class UnavailableError(AtomQSAError):
    def __init__(self, reason: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(f"UNAVAILABLE: {reason}", details)

class PipelineError(AtomQSAError):
    pass
