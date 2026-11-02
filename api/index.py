import sys
from pathlib import Path

# Đảm bảo đường dẫn import tương thích với môi trường Vercel Serverless
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from backend.app.main import app
