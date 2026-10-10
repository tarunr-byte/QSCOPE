from fastapi import Request
from core.config import AppConfig
from core.registry import PluginRegistry
from storage.sqlite_repository import SQLiteRepository

def get_app_config(request: Request) -> AppConfig:
    if not hasattr(request.app.state, "config") or request.app.state.config is None:
        request.app.state.config = AppConfig()
    return request.app.state.config

def get_plugin_registry(request: Request) -> PluginRegistry:
    if not hasattr(request.app.state, "registry") or request.app.state.registry is None:
        from app.main import _register_defaults
        registry = PluginRegistry()
        _register_defaults(registry)
        request.app.state.registry = registry
    return request.app.state.registry

def get_repository(request: Request) -> SQLiteRepository:
    if not hasattr(request.app.state, "repository") or request.app.state.repository is None:
        config = get_app_config(request)
        repo = SQLiteRepository(config.database_path)
        if hasattr(repo, "initialize"):
            repo.initialize()
        request.app.state.repository = repo
    return request.app.state.repository
