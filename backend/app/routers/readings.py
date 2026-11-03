"""Số đo mực nước (water_readings) – cảm biến gửi lên đây."""
from datetime import datetime, timezone
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import pool
from ..schemas import ReadingCreate
from .flood_points import DEFAULT_FLOOD_POINTS

log = logging.getLogger("floodnav.readings")
router = APIRouter(prefix="/api/readings", tags=["Số đo mực nước"])

# Bộ nhớ tạm in-memory khi chạy trên môi trường Serverless (Vercel) không có PostgreSQL
_IN_MEMORY_READINGS = []


@router.post("", status_code=201)
def create_reading(body: ReadingCreate):
    """Cảm biến (hoặc script giả lập) gửi mực nước. Có thể dùng point_id hoặc sensor_id."""
    try:
        with pool.connection(timeout=3.0) as conn:
            if body.point_id is not None:
                point = conn.execute(
                    "SELECT id, threshold_cm FROM flood_points WHERE id = %s", (body.point_id,)
                ).fetchone()
            else:
                point = conn.execute(
                    "SELECT id, threshold_cm FROM flood_points WHERE sensor_id = %s", (body.sensor_id,)
                ).fetchone()
            if point is None:
                raise HTTPException(404, "Không tìm thấy điểm ngập tương ứng")

            row = conn.execute(
                """INSERT INTO water_readings (point_id, depth_cm, source)
                   VALUES (%s, %s, %s::reading_source)
                   RETURNING id, point_id, depth_cm, source, recorded_at""",
                (point["id"], body.depth_cm, body.source),
            ).fetchone()

        row["depth_cm"] = float(row["depth_cm"])
        row["exceeds_threshold"] = row["depth_cm"] >= point["threshold_cm"]
        return row
    except Exception as e:
        log.warning("DB query failed in create_reading, using in-memory fallback: %s", e)
        # Fallback in-memory cho Vercel Serverless
        target_pt = None
        for p in DEFAULT_FLOOD_POINTS:
            if body.point_id is not None and p["id"] == body.point_id:
                target_pt = p
                break
            if body.sensor_id and p["sensor_id"] == body.sensor_id:
                target_pt = p
                break

        if target_pt is None:
            # Mặc định gán vào điểm 1 nếu không khớp
            target_pt = DEFAULT_FLOOD_POINTS[0]

        target_pt["depth_cm"] = float(body.depth_cm)
        rec = {
            "id": len(_IN_MEMORY_READINGS) + 1,
            "point_id": target_pt["id"],
            "depth_cm": float(body.depth_cm),
            "source": body.source,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "exceeds_threshold": float(body.depth_cm) >= target_pt["threshold_cm"]
        }
        _IN_MEMORY_READINGS.insert(0, rec)
        return rec


@router.get("")
def list_readings(
    point_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Lịch sử số đo, mới nhất trước. Lọc theo point_id nếu cần."""
    try:
        sql = "SELECT id, point_id, depth_cm, source, recorded_at FROM water_readings"
        params: list = []
        if point_id is not None:
            sql += " WHERE point_id = %s"
            params.append(point_id)
        sql += " ORDER BY recorded_at DESC LIMIT %s"
        params.append(limit)

        with pool.connection(timeout=3.0) as conn:
            rows = conn.execute(sql, params).fetchall()
        for r in rows:
            r["depth_cm"] = float(r["depth_cm"])
        return rows
    except Exception as e:
        log.warning("DB query failed in list_readings, using in-memory fallback: %s", e)
        res = _IN_MEMORY_READINGS
        if point_id is not None:
            res = [r for r in res if r["point_id"] == point_id]
        return res[:limit]
