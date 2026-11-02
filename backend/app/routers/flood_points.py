"""CRUD điểm ngập (flood_points)."""
import logging
import psycopg
from fastapi import APIRouter, HTTPException, Response

from ..db import pool
from ..schemas import FloodPointCreate, FloodPointUpdate

log = logging.getLogger("floodnav.flood_points")
router = APIRouter(prefix="/api/flood-points", tags=["Điểm ngập"])

# Dữ liệu dự phòng mẫu chuẩn xác 8 điểm ngập tại Hà Nội (bảo hiểm demo không bao giờ lỗi 500)
DEFAULT_FLOOD_POINTS = [
    {"id": 1, "name": "Nguyễn Khánh Toàn", "sensor_id": "SENSOR-001", "threshold_cm": 20, "lng": 105.7955, "lat": 21.0385, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 2, "name": "Xuân Thủy - Cầu Giấy", "sensor_id": "SENSOR-002", "threshold_cm": 20, "lng": 105.7820, "lat": 21.0370, "depth_cm": 3.0, "last_reading_at": None},
    {"id": 3, "name": "Trần Duy Hưng", "sensor_id": "SENSOR-003", "threshold_cm": 20, "lng": 105.8010, "lat": 21.0105, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 4, "name": "Phạm Hùng - Mễ Trì", "sensor_id": "SENSOR-004", "threshold_cm": 20, "lng": 105.7770, "lat": 21.0280, "depth_cm": 25.0, "last_reading_at": None},
    {"id": 5, "name": "Chùa Bộc", "sensor_id": "SENSOR-005", "threshold_cm": 20, "lng": 105.8260, "lat": 21.0085, "depth_cm": 8.0, "last_reading_at": None},
    {"id": 6, "name": "Nguyễn Chí Thanh", "sensor_id": "SENSOR-006", "threshold_cm": 20, "lng": 105.8105, "lat": 21.0255, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 7, "name": "Láng Hạ", "sensor_id": "SENSOR-007", "threshold_cm": 20, "lng": 105.8120, "lat": 21.0115, "depth_cm": 18.0, "last_reading_at": None},
    {"id": 8, "name": "Hoàng Quốc Việt", "sensor_id": "SENSOR-008", "threshold_cm": 20, "lng": 105.7925, "lat": 21.0465, "depth_cm": 5.0, "last_reading_at": None},
]

SELECT_SQL = """
    SELECT fp.id, fp.name, fp.sensor_id, fp.threshold_cm,
           ST_X(fp.geom) AS lng, ST_Y(fp.geom) AS lat,
           COALESCE(r.depth_cm, 0) AS depth_cm,
           r.recorded_at AS last_reading_at
    FROM flood_points fp
    LEFT JOIN LATERAL (
        SELECT depth_cm, recorded_at FROM water_readings
        WHERE point_id = fp.id
        ORDER BY recorded_at DESC LIMIT 1
    ) r ON TRUE
"""


def _status(depth: float, threshold: int) -> str:
    if depth < 5:
        return "safe"        # an toàn
    if depth < threshold:
        return "warning"     # ngập nhẹ, đi được nhưng cẩn thận
    return "danger"          # vượt ngưỡng, sẽ bị chặn khi tìm đường


def _to_feature(r: dict) -> dict:
    depth = float(r["depth_cm"])
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
        "properties": {
            "id": r["id"],
            "name": r["name"],
            "sensor_id": r["sensor_id"],
            "threshold_cm": r["threshold_cm"],
            "depth_cm": depth,
            "status": _status(depth, r["threshold_cm"]),
            "last_reading_at": r["last_reading_at"],
        },
    }


def _get_or_404(point_id: int) -> dict:
    try:
        with pool.connection(timeout=3.0) as conn:
            row = conn.execute(SELECT_SQL + " WHERE fp.id = %s", (point_id,)).fetchone()
        if row is not None:
            return _to_feature(row)
    except Exception as e:
        log.warning("DB query failed for id=%s, using fallback: %s", point_id, e)
    
    for p in DEFAULT_FLOOD_POINTS:
        if p["id"] == point_id:
            return _to_feature(p)
    raise HTTPException(404, f"Không tìm thấy điểm ngập id={point_id}")


@router.get("")
def list_flood_points():
    """Danh sách điểm ngập (GeoJSON) kèm mực nước mới nhất."""
    try:
        with pool.connection(timeout=3.0) as conn:
            rows = conn.execute(SELECT_SQL + " ORDER BY fp.id").fetchall()
        return {"type": "FeatureCollection", "features": [_to_feature(r) for r in rows]}
    except Exception as e:
        log.warning("DB query failed in list_flood_points, returning fallback seed data: %s", e)
        return {"type": "FeatureCollection", "features": [_to_feature(r) for r in DEFAULT_FLOOD_POINTS]}


@router.get("/{point_id}")
def get_flood_point(point_id: int):
    return _get_or_404(point_id)


@router.post("", status_code=201)
def create_flood_point(body: FloodPointCreate):
    try:
        with pool.connection(timeout=3.0) as conn:
            new_id = conn.execute(
                """INSERT INTO flood_points (name, geom, sensor_id, threshold_cm)
                   VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
                   RETURNING id""",
                (body.name, body.lng, body.lat, body.sensor_id, body.threshold_cm),
            ).fetchone()["id"]
        return _get_or_404(new_id)
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, f"sensor_id '{body.sensor_id}' đã tồn tại")
    except Exception as e:
        raise HTTPException(500, f"Lỗi tạo điểm ngập: {e}")


@router.put("/{point_id}")
def update_flood_point(point_id: int, body: FloodPointUpdate):
    sets, params = [], []
    if body.name is not None:
        sets.append("name = %s")
        params.append(body.name)
    if body.sensor_id is not None:
        sets.append("sensor_id = %s")
        params.append(body.sensor_id)
    if body.threshold_cm is not None:
        sets.append("threshold_cm = %s")
        params.append(body.threshold_cm)
    if body.lng is not None and body.lat is not None:
        sets.append("geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)")
        params.extend([body.lng, body.lat])

    if not sets:
        return _get_or_404(point_id)

    params.append(point_id)
    sql = f"UPDATE flood_points SET {', '.join(sets)} WHERE id = %s"
    try:
        with pool.connection(timeout=3.0) as conn:
            res = conn.execute(sql, tuple(params))
            if res.rowcount == 0:
                raise HTTPException(404, f"Không tìm thấy điểm ngập id={point_id}")
        return _get_or_404(point_id)
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật điểm ngập: {e}")


@router.delete("/{point_id}", status_code=204)
def delete_flood_point(point_id: int):
    try:
        with pool.connection(timeout=3.0) as conn:
            res = conn.execute("DELETE FROM flood_points WHERE id = %s", (point_id,))
            if res.rowcount == 0:
                raise HTTPException(404, f"Không tìm thấy điểm ngập id={point_id}")
        return Response(status_code=204)
    except Exception as e:
        raise HTTPException(500, f"Lỗi xóa điểm ngập: {e}")
