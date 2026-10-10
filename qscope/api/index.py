import sys
import os

# Add parent directory to sys.path so app, core, modules, storage, services are discoverable by Vercel's Python runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.main import app
