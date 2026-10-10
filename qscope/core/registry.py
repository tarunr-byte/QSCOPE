import threading
from typing import Dict, Any, Type, Optional

class PluginRegistry:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(PluginRegistry, cls).__new__(cls)
                cls._instance._plugins = {}
                cls._instance._instances = {}
            return cls._instance

    @classmethod
    def reset(cls):
        with cls._lock:
            if cls._instance is not None:
                cls._instance._plugins = {}
                cls._instance._instances = {}

    def register(self, category: str, name: str, plugin: Any):
        if category not in self._plugins:
            self._plugins[category] = {}
            self._instances[category] = {}
        
        if isinstance(plugin, type):
            self._plugins[category][name] = plugin
        else:
            self._plugins[category][name] = type(plugin)
            self._instances[category][name] = plugin

    def get(self, category: str, name: str, **kwargs) -> Any:
        if category not in self._plugins or name not in self._plugins[category]:
            raise ValueError(f"Plugin {name} not found in category {category}")
        
        if name in self._instances.get(category, {}):
            return self._instances[category][name]
        
        plugin_class = self._plugins[category][name]
        return plugin_class(**kwargs)
