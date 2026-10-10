import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from .repository import Repository

class SQLiteRepository(Repository):
    def __init__(self, db_path: str = "atom_qsa.db"):
        self.db_path = db_path

    def _get_connection(self):
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def initialize(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS analyses (
                    id TEXT PRIMARY KEY,
                    run_id TEXT,
                    window_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    config_version TEXT,
                    result_json TEXT
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    analysis_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    details_json TEXT
                )
            ''')
            conn.commit()

    def ping(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()

    def save_analysis(self, analysis_id: str, run_id: str, window_id: str, config_version: str, result: Dict[str, Any]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO analyses (id, run_id, window_id, config_version, result_json) VALUES (?, ?, ?, ?, ?)",
                (analysis_id, run_id, window_id, config_version, json.dumps(result))
            )
            conn.commit()

    def get_analyses(self, limit: int, offset: int, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, run_id, window_id, timestamp, config_version, result_json FROM analyses"
            params = []
            if run_id:
                query += " WHERE run_id = ?"
                params.append(run_id)
            query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            
            return [
                {
                    "id": row[0],
                    "run_id": row[1],
                    "window_id": row[2],
                    "timestamp": row[3],
                    "config_version": row[4],
                    "result": json.loads(row[5])
                } for row in rows
            ]

    def get_analyses_count(self, run_id: Optional[str] = None) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT COUNT(*) FROM analyses"
            params = []
            if run_id:
                query += " WHERE run_id = ?"
                params.append(run_id)
            cursor.execute(query, tuple(params))
            return cursor.fetchone()[0]

    def save_audit_log(self, log_id: str, analysis_id: str, event_type: str, details: Dict[str, Any]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO audit_log (id, analysis_id, event_type, details_json) VALUES (?, ?, ?, ?)",
                (log_id, analysis_id, event_type, json.dumps(details))
            )
            conn.commit()

    def get_all_audit_logs(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, analysis_id, timestamp, event_type, details_json FROM audit_log ORDER BY timestamp DESC")
            rows = cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "analysis_id": row[1],
                    "timestamp": row[2],
                    "event_type": row[3],
                    "details": json.loads(row[4])
                } for row in rows
            ]
