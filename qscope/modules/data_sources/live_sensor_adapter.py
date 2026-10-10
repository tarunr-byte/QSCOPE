from typing import List, Dict, Any, Tuple
from core.contracts import DataSource, QualityReport, ProvenanceRecord
from core.exceptions import UnavailableError

class LiveSensorAdapter(DataSource):
    """
    Adapter for connecting to a live physical instrument.
    """
    
    def __init__(self):
        pass

    def load(self, source: Any) -> Tuple[List[Dict[str, Any]], QualityReport, ProvenanceRecord]:
        """
        Connect and stream data from a live sensor.
        Raises UnavailableError as this requires a physical hardware connection.
        """
        raise UnavailableError(
            'Live sensor adapter requires physical instrument connection and calibration. '
            'No hardware interface is configured.'
        )
