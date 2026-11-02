import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

log = logging.getLogger("floodnav.db")

# Đọc file .env nằm ở thư mục gốc dự án (floodnav/.env)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:floodnav_2026@localhost:5432/floodnav"
)

# Cấu hình pool tối ưu cho Serverless (Vercel): min_size=0 (không mở kết nối ngầm gây treo), timeout=5s
pool = ConnectionPool(
    DATABASE_URL,
    min_size=0,
    max_size=5,
    timeout=5.0,
    kwargs={"row_factory": dict_row},
    open=True,
)
