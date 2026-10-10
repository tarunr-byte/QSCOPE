from typing import List, Dict, Any, Tuple
from core.contracts import DataSource, QualityReport, ProvenanceRecord
from core.exceptions import UnavailableError

class EinsteinElevatorAdapter(DataSource):
    """
    Adapter for reading data directly from the Einstein Elevator system.
    """
    
    def __init__(self):
        pass

    def load(self, source: Any) -> Tuple[List[Dict[str, Any]], QualityReport, ProvenanceRecord]:
        """
        Load data from the Einstein Elevator.
        Raises UnavailableError as this is a stub requiring hardware/dataset configuration.
        """
        raise UnavailableError(
            'Einstein Elevator adapter requires dataset-specific configuration and '
            'column mapping. Provide dataset path and mapping configuration.'
        )
