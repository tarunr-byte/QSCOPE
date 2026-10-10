import json
import csv
from io import StringIO
from typing import List, Dict, Any

class ExportService:
    def __init__(self, repository):
        self.repository = repository

    def _get_data(self) -> List[Dict[str, Any]]:
        # Fetch all for export or a large limit
        return self.repository.get_analyses(limit=10000, offset=0)

    def export_json(self) -> str:
        data = self._get_data()
        return json.dumps(data, indent=2)

    def export_csv(self) -> str:
        data = self._get_data()
        output = StringIO()
        if not data:
            return ""
            
        writer = csv.writer(output)
        writer.writerow(["id", "run_id", "window_id", "timestamp", "config_version", "state", "next_action"])
        
        for item in data:
            result = item.get("result", {})
            decision = result.get("decision_result", {})
            state = decision.get("state", "") if decision else ""
            action = decision.get("next_action", "") if decision else ""
            
            writer.writerow([
                item["id"],
                item["run_id"],
                item["window_id"],
                item["timestamp"],
                item["config_version"],
                state,
                action
            ])
            
        return output.getvalue()
