from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class Repository(ABC):
    @abstractmethod
    def initialize(self):
        pass

    @abstractmethod
    def ping(self):
        pass

    @abstractmethod
    def save_analysis(self, analysis_id: str, run_id: str, window_id: str, config_version: str, result: Dict[str, Any]):
        pass

    @abstractmethod
    def get_analyses(self, limit: int, offset: int, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_analyses_count(self, run_id: Optional[str] = None) -> int:
        pass

    @abstractmethod
    def save_audit_log(self, log_id: str, analysis_id: str, event_type: str, details: Dict[str, Any]):
        pass

    @abstractmethod
    def get_all_audit_logs(self) -> List[Dict[str, Any]]:
        pass
