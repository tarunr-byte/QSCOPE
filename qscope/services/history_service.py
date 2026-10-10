class HistoryService:
    def __init__(self, repository):
        self.repository = repository

    def get_history(self, page: int, limit: int, run_id: str = None) -> dict:
        offset = (page - 1) * limit
        items = self.repository.get_analyses(limit, offset, run_id)
        total = self.repository.get_analyses_count(run_id)
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit
        }
