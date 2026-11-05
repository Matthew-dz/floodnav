"""Báo cáo ngập của người dân (crowdsourcing) + logic xác nhận."""
from datetime import datetime, timedelta, timezone
import logging
from fastapi import APIRouter, HTTPException, Response

from ..db import pool
from ..schemas import ReportClear, ReportCreate
from ..fallback_storage import (
    save_fallback_report,
    get_fallback_reports,
    clear_fallback_reports,
    delete_fallback_report,
)

log = logging.getLogger("floodnav.reports")
router = APIRouter(prefix="/api/reports", tags=["Báo cáo của người dân"])

# --- Tham số quy tắc xác nhận ---
CONFIRM_RADIUS_M = 100       # bán kính gom các báo cáo gần nhau
CONFIRM_WINDOW_MIN = 15      # chỉ tính báo cáo trong 15 phút gần nhất
CONFIRM_MIN_REPORTS = 3      # đủ 3 báo cáo là xác nhận
SENSOR_MATCH_DEPTH_CM = 5    # cảm biến gần đó đo >= 5 cm thì coi là khớp
SENSOR_FRESH_MIN = 30        # số đo cảm biến phải mới trong 30 phút

# Mức người dân chọn -> độ sâu ước lượng (cm)
LEVEL_DEPTH_CM = {"light": 10, "medium": 25, "heavy": 40}

POINT = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography"

# Danh sách lưu tạm in-memory khi không có PostgreSQL (trên Vercel Serverless)
# Báo cáo dự phòng được chuyển sang lưu trữ bền vững tại fallback_storage.db


@router.post("", status_code=201)
def create_report(body: ReportCreate):
    try:
        with pool.connection(timeout=3.0) as conn:
            rep = conn.execute(
                """INSERT INTO reports (user_id, geom, level, photo_url)
                   VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s::report_level, %s)
                   RETURNING id, created_at, expires_at""",
                (body.user_id, body.lng, body.lat, body.level, body.photo_url),
            ).fetchone()

            # 1) Các báo cáo còn hiệu lực, gần nhau (kể cả báo cáo vừa gửi)
            nearby = conn.execute(
                f"""SELECT id FROM reports
                    WHERE expires_at > now()
                      AND created_at > now() - make_interval(mins => %s)
                      AND ST_DWithin(geom::geography, {POINT}, %s)""",
                (CONFIRM_WINDOW_MIN, body.lng, body.lat, CONFIRM_RADIUS_M),
            ).fetchall()
            nearby_ids = [r["id"] for r in nearby]

            # 2) Có cảm biến gần đó đang đo thấy nước không?
            sensor_match = conn.execute(
                f"""SELECT fp.id FROM flood_points fp
                    JOIN LATERAL (
                        SELECT depth_cm, recorded_at FROM water_readings
                        WHERE point_id = fp.id AND source = 'sensor'
                        ORDER BY recorded_at DESC LIMIT 1
                    ) r ON TRUE
                    WHERE ST_DWithin(fp.geom::geography, {POINT}, %s)
                      AND r.depth_cm >= %s
                      AND r.recorded_at > now() - make_interval(mins => %s)
                    LIMIT 1""",
                (body.lng, body.lat, CONFIRM_RADIUS_M, SENSOR_MATCH_DEPTH_CM, SENSOR_FRESH_MIN),
            ).fetchone()

            confirmed = len(nearby_ids) >= CONFIRM_MIN_REPORTS or sensor_match is not None
            if confirmed:
                conn.execute("UPDATE reports SET confirmed = TRUE WHERE id = ANY(%s)", (nearby_ids,))

                # 3) Nếu báo cáo nằm gần một điểm ngập -> ghi thêm số đo nguồn 'crowd'
                point = conn.execute(
                    f"""SELECT id FROM flood_points
                        WHERE ST_DWithin(geom::geography, {POINT}, %s)
                        ORDER BY ST_Distance(geom::geography, {POINT}) LIMIT 1""",
                    (body.lng, body.lat, CONFIRM_RADIUS_M, body.lng, body.lat),
                ).fetchone()
                if point:
                    conn.execute(
                        "INSERT INTO water_readings (point_id, depth_cm, source) VALUES (%s, %s, 'crowd')",
                        (point["id"], LEVEL_DEPTH_CM[body.level]),
                    )

        return {
            "id": rep["id"],
            "level": body.level,
            "confirmed": confirmed,
            "nearby_reports": len(nearby_ids),
            "need_more": 0 if confirmed else CONFIRM_MIN_REPORTS - len(nearby_ids),
            "expires_at": rep["expires_at"],
        }
    except Exception as e:
        log.warning("DB query failed in create_report, using persistent fallback: %s", e)
        return save_fallback_report(
            user_id=body.user_id,
            lng=body.lng,
            lat=body.lat,
            level=body.level,
            photo_url=body.photo_url,
        )


@router.get("")
def list_reports(only_confirmed: bool = False):
    """Báo cáo còn hiệu lực (GeoJSON). only_confirmed=true để chỉ lấy báo cáo đã xác nhận."""
    try:
        sql = """SELECT id, level, confirmed, created_at, expires_at,
                        ST_X(geom) AS lng, ST_Y(geom) AS lat
                 FROM reports WHERE expires_at > now()"""
        if only_confirmed:
            sql += " AND confirmed"
        sql += " ORDER BY created_at DESC"

        with pool.connection(timeout=3.0) as conn:
            rows = conn.execute(sql).fetchall()

        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
                    "properties": {
                        "id": r["id"],
                        "level": r["level"],
                        "estimated_depth_cm": LEVEL_DEPTH_CM[r["level"]],
                        "confirmed": r["confirmed"],
                        "created_at": r["created_at"],
                        "expires_at": r["expires_at"],
                    },
                }
                for r in rows
            ],
        }
    except Exception as e:
        log.warning("DB query failed in list_reports, using persistent fallback: %s", e)
        fb_reports = get_fallback_reports(only_confirmed=only_confirmed)
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
                "properties": {
                    "id": r["id"],
                    "level": r["level"],
                    "estimated_depth_cm": LEVEL_DEPTH_CM.get(r["level"], 15),
                    "confirmed": r.get("confirmed", True),
                    "created_at": r.get("created_at"),
                    "expires_at": r.get("expires_at"),
                },
            }
            for r in fb_reports
        ]
        return {
            "type": "FeatureCollection",
            "features": features,
        }


@router.post("/clear")
def clear_reports(body: ReportClear):
    """Người dân báo 'đã hết ngập': hết hạn mọi báo cáo còn hiệu lực trong bán kính 100 m."""
    try:
        with pool.connection(timeout=3.0) as conn:
            rows = conn.execute(
                f"""UPDATE reports SET expires_at = now()
                    WHERE expires_at > now()
                      AND ST_DWithin(geom::geography, {POINT}, %s)
                    RETURNING id""",
                (body.lng, body.lat, CONFIRM_RADIUS_M),
            ).fetchall()
        return {"cleared": len(rows)}
    except Exception as e:
        log.warning("DB query failed in clear_reports, using persistent fallback: %s", e)
        return {"cleared": clear_fallback_reports()}


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int):
    try:
        with pool.connection(timeout=3.0) as conn:
            row = conn.execute("DELETE FROM reports WHERE id = %s RETURNING id", (report_id,)).fetchone()
        if row is None:
            raise HTTPException(404, f"Không tìm thấy báo cáo id={report_id}")
        return Response(status_code=204)
    except Exception as e:
        log.warning("DB query failed in delete_report, using persistent fallback: %s", e)
        delete_fallback_report(report_id)
        return Response(status_code=204)
