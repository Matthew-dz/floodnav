"""
Cơ chế lưu trữ bền vững dự phòng (Persistent Fallback Storage) khi PostgreSQL không hoạt động.
Sử dụng SQLite với cơ chế khoá file và WAL để đảm bảo:
- Đồng bộ dữ liệu quan trắc giữa nhiều tiến trình (workers) và các phiên Serverless
- Dữ liệu số đo (readings) và báo cáo (reports) được lưu bền vững vào đĩa thay vì chỉ lưu tạm trên RAM
- Tách biệt hoàn toàn số đo quan trắc khỏi danh mục trạm ngập mặc định (DEFAULT_FLOOD_POINTS)
"""
import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import tempfile

log = logging.getLogger("floodnav.fallback_storage")

ROOT = Path(__file__).resolve().parents[2]


def _get_db_path() -> Path:
    """Xác định đường dẫn file SQLite an toàn (ưu tiên thư mục data/ của dự án, fallback sang tempdir nếu read-only)."""
    data_dir = ROOT / "data"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        test_file = data_dir / ".write_test"
        test_file.write_text("ok")
        test_file.unlink()
        return data_dir / "fallback_storage.db"
    except Exception:
        pass
    temp_dir = Path(tempfile.gettempdir()) / "floodnav"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir / "fallback_storage.db"


DB_PATH = _get_db_path()


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
    except Exception:
        pass
    return conn


def init_fallback_db():
    """Khởi tạo bảng lưu trữ bền vững nếu chưa tồn tại."""
    try:
        with _get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS fallback_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    point_id INTEGER NOT NULL,
                    sensor_id TEXT,
                    depth_cm REAL NOT NULL,
                    source TEXT DEFAULT 'sensor',
                    recorded_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_fb_readings_point ON fallback_readings(point_id, id DESC);

                CREATE TABLE IF NOT EXISTS fallback_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    lng REAL NOT NULL,
                    lat REAL NOT NULL,
                    level TEXT NOT NULL,
                    photo_url TEXT,
                    confirmed INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_fb_reports_exp ON fallback_reports(expires_at);
            """)
    except Exception as e:
        log.warning("Không thể khởi tạo fallback database SQLite: %s", e)


init_fallback_db()


def save_fallback_reading(
    point_id: int,
    sensor_id: Optional[str],
    depth_cm: float,
    source: str = "sensor",
    threshold_cm: float = 20.0
) -> dict:
    """Lưu số đo mới vào cơ chế lưu trữ bền vững thay vì gán trực tiếp vào DEFAULT_FLOOD_POINTS."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with _get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO fallback_readings (point_id, sensor_id, depth_cm, source, recorded_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (point_id, sensor_id, float(depth_cm), source, now_iso)
            )
            rec_id = cursor.lastrowid
            conn.commit()
    except Exception as e:
        log.warning("Lỗi ghi fallback_readings: %s", e)
        rec_id = int(datetime.now().timestamp() * 1000)

    return {
        "id": rec_id,
        "point_id": point_id,
        "depth_cm": float(depth_cm),
        "source": source,
        "recorded_at": now_iso,
        "exceeds_threshold": float(depth_cm) >= float(threshold_cm)
    }


def get_fallback_readings(point_id: Optional[int] = None, limit: int = 50) -> List[dict]:
    """Truy vấn lịch sử số đo từ bộ nhớ lưu trữ bền vững."""
    try:
        with _get_connection() as conn:
            if point_id is not None:
                rows = conn.execute(
                    """SELECT id, point_id, depth_cm, source, recorded_at
                       FROM fallback_readings
                       WHERE point_id = ?
                       ORDER BY id DESC LIMIT ?""",
                    (point_id, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT id, point_id, depth_cm, source, recorded_at
                       FROM fallback_readings
                       ORDER BY id DESC LIMIT ?""",
                    (limit,)
                ).fetchall()
            return [
                {
                    "id": r["id"],
                    "point_id": r["point_id"],
                    "depth_cm": float(r["depth_cm"]),
                    "source": r["source"],
                    "recorded_at": r["recorded_at"]
                }
                for r in rows
            ]
    except Exception as e:
        log.warning("Lỗi đọc fallback_readings: %s", e)
        return []


def get_latest_readings_map() -> Dict[int, dict]:
    """
    Trả về dictionary {point_id: {"depth_cm": float, "recorded_at": str, "source": str}}
    chứa số đo quan trắc mới nhất của từng trạm đo.
    """
    try:
        with _get_connection() as conn:
            rows = conn.execute("""
                SELECT point_id, depth_cm, source, recorded_at
                FROM fallback_readings
                WHERE id IN (
                    SELECT MAX(id) FROM fallback_readings GROUP BY point_id
                )
            """).fetchall()
            return {
                r["point_id"]: {
                    "depth_cm": float(r["depth_cm"]),
                    "source": r["source"],
                    "recorded_at": r["recorded_at"]
                }
                for r in rows
            }
    except Exception as e:
        log.warning("Lỗi đọc latest readings map: %s", e)
        return {}


def save_fallback_report(
    user_id: Optional[int],
    lng: float,
    lat: float,
    level: str,
    photo_url: Optional[str]
) -> dict:
    """Lưu báo cáo ngập từ người dân vào bộ nhớ bền vững."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=45)
    now_iso = now.isoformat()
    exp_iso = exp.isoformat()
    try:
        with _get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO fallback_reports (user_id, lng, lat, level, photo_url, confirmed, created_at, expires_at)
                   VALUES (?, ?, ?, ?, ?, 1, ?, ?)""",
                (user_id, lng, lat, level, photo_url, now_iso, exp_iso)
            )
            rep_id = cursor.lastrowid
            conn.commit()
    except Exception as e:
        log.warning("Lỗi ghi fallback_reports: %s", e)
        rep_id = int(datetime.now().timestamp() * 1000)

    return {
        "id": rep_id,
        "level": level,
        "confirmed": True,
        "nearby_reports": 1,
        "need_more": 0,
        "expires_at": exp_iso,
    }


def get_fallback_reports(only_confirmed: bool = False) -> List[dict]:
    """Lấy danh sách các báo cáo ngập còn hiệu lực từ bộ nhớ bền vững."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with _get_connection() as conn:
            sql = "SELECT id, level, confirmed, created_at, expires_at, lng, lat FROM fallback_reports WHERE expires_at > ?"
            params = [now_iso]
            if only_confirmed:
                sql += " AND confirmed = 1"
            sql += " ORDER BY id DESC"
            rows = conn.execute(sql, params).fetchall()
            return [
                {
                    "id": r["id"],
                    "level": r["level"],
                    "confirmed": bool(r["confirmed"]),
                    "created_at": r["created_at"],
                    "expires_at": r["expires_at"],
                    "lng": float(r["lng"]),
                    "lat": float(r["lat"])
                }
                for r in rows
            ]
    except Exception as e:
        log.warning("Lỗi đọc fallback_reports: %s", e)
        return []


def clear_fallback_reports() -> int:
    """Xóa tất cả các báo cáo ngập tạm thời."""
    try:
        with _get_connection() as conn:
            res = conn.execute("DELETE FROM fallback_reports")
            conn.commit()
            return res.rowcount
    except Exception as e:
        log.warning("Lỗi clear fallback_reports: %s", e)
        return 0


def delete_fallback_report(report_id: int) -> bool:
    """Xóa một báo cáo ngập theo id."""
    try:
        with _get_connection() as conn:
            res = conn.execute("DELETE FROM fallback_reports WHERE id = ?", (report_id,))
            conn.commit()
            return res.rowcount > 0
    except Exception as e:
        log.warning("Lỗi delete fallback_report: %s", e)
        return False
