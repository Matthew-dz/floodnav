"""CRUD điểm ngập (flood_points)."""
import logging
import psycopg
from fastapi import APIRouter, HTTPException, Response

from ..db import pool
from ..schemas import FloodPointCreate, FloodPointUpdate

log = logging.getLogger("floodnav.flood_points")
router = APIRouter(prefix="/api/flood-points", tags=["Điểm ngập"])

# Dữ liệu dự phòng mẫu chuẩn xác 75 điểm ngập trọng điểm trên toàn địa bàn Hà Nội
DEFAULT_FLOOD_POINTS = [
    # --- Cầu Giấy ---
    {"id": 1, "name": "Nguyễn Khánh Toàn (Cầu Giấy)", "sensor_id": "SENSOR-001", "threshold_cm": 20, "lng": 105.7955, "lat": 21.0385, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 2, "name": "Xuân Thủy - Cầu Giấy", "sensor_id": "SENSOR-002", "threshold_cm": 20, "lng": 105.7820, "lat": 21.0370, "depth_cm": 3.0, "last_reading_at": None},
    {"id": 3, "name": "Trần Duy Hưng (Cầu Giấy)", "sensor_id": "SENSOR-003", "threshold_cm": 20, "lng": 105.8010, "lat": 21.0105, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 4, "name": "Hoàng Quốc Việt (Cầu Giấy)", "sensor_id": "SENSOR-004", "threshold_cm": 20, "lng": 105.7925, "lat": 21.0465, "depth_cm": 5.0, "last_reading_at": None},
    {"id": 5, "name": "Duy Tân (Khu CNTT Cầu Giấy)", "sensor_id": "SENSOR-005", "threshold_cm": 20, "lng": 105.7830, "lat": 21.0310, "depth_cm": 15.0, "last_reading_at": None},
    {"id": 6, "name": "Hoa Bằng - Yên Hòa (Cầu Giấy)", "sensor_id": "SENSOR-006", "threshold_cm": 20, "lng": 105.7950, "lat": 21.0220, "depth_cm": 27.0, "last_reading_at": None},
    {"id": 7, "name": "Trung Kính - Mạc Thái Tổ", "sensor_id": "SENSOR-007", "threshold_cm": 20, "lng": 105.7915, "lat": 21.0160, "depth_cm": 9.0, "last_reading_at": None},

    # --- Đống Đa ---
    {"id": 8, "name": "Chùa Bộc (Đống Đa)", "sensor_id": "SENSOR-008", "threshold_cm": 20, "lng": 105.8260, "lat": 21.0085, "depth_cm": 8.0, "last_reading_at": None},
    {"id": 9, "name": "Nguyễn Chí Thanh (Đống Đa)", "sensor_id": "SENSOR-009", "threshold_cm": 20, "lng": 105.8105, "lat": 21.0255, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 10, "name": "Láng Hạ (Đống Đa)", "sensor_id": "SENSOR-010", "threshold_cm": 20, "lng": 105.8120, "lat": 21.0115, "depth_cm": 18.0, "last_reading_at": None},
    {"id": 11, "name": "Thái Hà - Tây Sơn (Đống Đa)", "sensor_id": "SENSOR-011", "threshold_cm": 20, "lng": 105.8190, "lat": 21.0145, "depth_cm": 16.0, "last_reading_at": None},
    {"id": 12, "name": "Tôn Đức Thắng (Văn Miếu)", "sensor_id": "SENSOR-012", "threshold_cm": 20, "lng": 105.8320, "lat": 21.0250, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 13, "name": "Trường Chinh (BV Không Quân)", "sensor_id": "SENSOR-013", "threshold_cm": 20, "lng": 105.8285, "lat": 21.0015, "depth_cm": 14.0, "last_reading_at": None},
    {"id": 14, "name": "Khâm Thiên - Lê Duẩn", "sensor_id": "SENSOR-014", "threshold_cm": 20, "lng": 105.8385, "lat": 21.0185, "depth_cm": 4.0, "last_reading_at": None},
    {"id": 15, "name": "Huỳnh Thúc Kháng - Nguyên Hồng", "sensor_id": "SENSOR-015", "threshold_cm": 20, "lng": 105.8100, "lat": 21.0175, "depth_cm": 9.0, "last_reading_at": None},

    # --- Ba Đình ---
    {"id": 16, "name": "Đội Cấn (Cống ngõ 209 Đội Cấn)", "sensor_id": "SENSOR-016", "threshold_cm": 20, "lng": 105.8235, "lat": 21.0362, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 17, "name": "Liễu Giai - Vạn Phúc", "sensor_id": "SENSOR-017", "threshold_cm": 20, "lng": 105.8152, "lat": 21.0340, "depth_cm": 6.0, "last_reading_at": None},
    {"id": 18, "name": "Cao Bá Quát (Cty Môi Trường ĐT)", "sensor_id": "SENSOR-018", "threshold_cm": 20, "lng": 105.8390, "lat": 21.0315, "depth_cm": 22.0, "last_reading_at": None},
    {"id": 19, "name": "Ngọc Khánh (BV Phụ Sản)", "sensor_id": "SENSOR-019", "threshold_cm": 20, "lng": 105.8115, "lat": 21.0298, "depth_cm": 8.0, "last_reading_at": None},
    {"id": 20, "name": "Quán Thánh - Cửa Bắc", "sensor_id": "SENSOR-020", "threshold_cm": 20, "lng": 105.8420, "lat": 21.0415, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 21, "name": "Nguyễn Trường Tộ - Hàng Than", "sensor_id": "SENSOR-021", "threshold_cm": 20, "lng": 105.8435, "lat": 21.0440, "depth_cm": 10.0, "last_reading_at": None},

    # --- Hoàn Kiếm ---
    {"id": 22, "name": "Tràng Tiền - Đinh Tiên Hoàng (Bờ Hồ)", "sensor_id": "SENSOR-022", "threshold_cm": 20, "lng": 105.8540, "lat": 21.0255, "depth_cm": 0.0, "last_reading_at": None},
    {"id": 23, "name": "Phùng Hưng - Bát Đàn (Phố Cổ)", "sensor_id": "SENSOR-023", "threshold_cm": 20, "lng": 105.8465, "lat": 21.0345, "depth_cm": 14.0, "last_reading_at": None},
    {"id": 24, "name": "Lý Thường Kiệt - Phan Bội Châu", "sensor_id": "SENSOR-024", "threshold_cm": 20, "lng": 105.8435, "lat": 21.0260, "depth_cm": 7.0, "last_reading_at": None},
    {"id": 25, "name": "Đường Thành - Ngõ Trạm", "sensor_id": "SENSOR-025", "threshold_cm": 20, "lng": 105.8460, "lat": 21.0322, "depth_cm": 16.0, "last_reading_at": None},
    {"id": 26, "name": "Tạ Hiện - Lương Ngọc Quyến", "sensor_id": "SENSOR-026", "threshold_cm": 20, "lng": 105.8525, "lat": 21.0350, "depth_cm": 4.0, "last_reading_at": None},
    {"id": 27, "name": "Thợ Nhuộm - Hai Bà Trưng", "sensor_id": "SENSOR-027", "threshold_cm": 20, "lng": 105.8450, "lat": 21.0245, "depth_cm": 0.0, "last_reading_at": None},

    # --- Hai Bà Trưng ---
    {"id": 28, "name": "Minh Khai (Chân cầu Vĩnh Tuy - Time City)", "sensor_id": "SENSOR-028", "threshold_cm": 20, "lng": 105.8670, "lat": 20.9995, "depth_cm": 28.0, "last_reading_at": None},
    {"id": 29, "name": "Lạc Trung (Cổng TH Hà Nội)", "sensor_id": "SENSOR-029", "threshold_cm": 20, "lng": 105.8635, "lat": 21.0040, "depth_cm": 22.0, "last_reading_at": None},
    {"id": 30, "name": "Nguyễn Khoái (Dốc Vĩnh Tuy)", "sensor_id": "SENSOR-030", "threshold_cm": 20, "lng": 105.8725, "lat": 21.0020, "depth_cm": 15.0, "last_reading_at": None},
    {"id": 31, "name": "Thanh Nhàn (BV Thanh Nhàn)", "sensor_id": "SENSOR-031", "threshold_cm": 20, "lng": 105.8545, "lat": 21.0065, "depth_cm": 8.0, "last_reading_at": None},
    {"id": 32, "name": "Đại La - Trần Đại Nghĩa", "sensor_id": "SENSOR-032", "threshold_cm": 20, "lng": 105.8440, "lat": 20.9985, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 33, "name": "Phố Huế - Nguyễn Công Trứ", "sensor_id": "SENSOR-033", "threshold_cm": 20, "lng": 105.8530, "lat": 21.0145, "depth_cm": 0.0, "last_reading_at": None},

    # --- Thanh Xuân ---
    {"id": 34, "name": "Nguyễn Trãi (Trước ĐHKHTN)", "sensor_id": "SENSOR-034", "threshold_cm": 20, "lng": 105.8080, "lat": 20.9965, "depth_cm": 26.0, "last_reading_at": None},
    {"id": 35, "name": "Vương Thừa Vũ - Tô Vĩnh Diện", "sensor_id": "SENSOR-035", "threshold_cm": 20, "lng": 105.8205, "lat": 21.0005, "depth_cm": 15.0, "last_reading_at": None},
    {"id": 36, "name": "Triều Khúc - Tân Triều", "sensor_id": "SENSOR-036", "threshold_cm": 20, "lng": 105.7975, "lat": 20.9840, "depth_cm": 22.0, "last_reading_at": None},
    {"id": 37, "name": "Lê Văn Lương - Hoàng Đạo Thúy", "sensor_id": "SENSOR-037", "threshold_cm": 20, "lng": 105.8035, "lat": 21.0070, "depth_cm": 10.0, "last_reading_at": None},
    {"id": 38, "name": "Quan Nhân - Nhân Chính", "sensor_id": "SENSOR-038", "threshold_cm": 20, "lng": 105.8095, "lat": 21.0045, "depth_cm": 18.0, "last_reading_at": None},

    # --- Nam Từ Liêm ---
    {"id": 39, "name": "Phạm Hùng - Mễ Trì", "sensor_id": "SENSOR-039", "threshold_cm": 20, "lng": 105.7770, "lat": 21.0280, "depth_cm": 25.0, "last_reading_at": None},
    {"id": 40, "name": "Lê Đức Thọ (SVĐ Mỹ Đình)", "sensor_id": "SENSOR-040", "threshold_cm": 20, "lng": 105.7665, "lat": 21.0210, "depth_cm": 21.0, "last_reading_at": None},
    {"id": 41, "name": "Mễ Trì (The Garden - Keangnam)", "sensor_id": "SENSOR-041", "threshold_cm": 20, "lng": 105.7760, "lat": 21.0135, "depth_cm": 16.0, "last_reading_at": None},
    {"id": 42, "name": "Hầm chui Thăng Long (An Khánh)", "sensor_id": "SENSOR-042", "threshold_cm": 25, "lng": 105.7485, "lat": 21.0010, "depth_cm": 32.0, "last_reading_at": None},
    {"id": 43, "name": "Tố Hữu - Lương Thế Vinh", "sensor_id": "SENSOR-043", "threshold_cm": 20, "lng": 105.7905, "lat": 20.9985, "depth_cm": 19.0, "last_reading_at": None},

    # --- Hoàng Mai ---
    {"id": 44, "name": "Giải Phóng (Trước BX Giáp Bát)", "sensor_id": "SENSOR-044", "threshold_cm": 20, "lng": 105.8425, "lat": 20.9785, "depth_cm": 28.0, "last_reading_at": None},
    {"id": 45, "name": "Định Công (Cầu Định Công qua Sông Lừ)", "sensor_id": "SENSOR-045", "threshold_cm": 20, "lng": 105.8340, "lat": 20.9875, "depth_cm": 24.0, "last_reading_at": None},
    {"id": 46, "name": "Tân Mai (Chợ Tân Mai)", "sensor_id": "SENSOR-046", "threshold_cm": 20, "lng": 105.8520, "lat": 20.9890, "depth_cm": 17.0, "last_reading_at": None},
    {"id": 47, "name": "Thịnh Liệt - Trương Định", "sensor_id": "SENSOR-047", "threshold_cm": 20, "lng": 105.8490, "lat": 20.9820, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 48, "name": "Nguyễn Xiển (Kim Văn Kim Lũ)", "sensor_id": "SENSOR-048", "threshold_cm": 20, "lng": 105.8150, "lat": 20.9760, "depth_cm": 20.0, "last_reading_at": None},

    # --- Tây Hồ ---
    {"id": 49, "name": "Thụy Khuê (Dốc Tam Đa)", "sensor_id": "SENSOR-049", "threshold_cm": 20, "lng": 105.8210, "lat": 21.0440, "depth_cm": 18.0, "last_reading_at": None},
    {"id": 50, "name": "Trích Sài (Ven Hồ Tây)", "sensor_id": "SENSOR-050", "threshold_cm": 20, "lng": 105.8270, "lat": 21.0475, "depth_cm": 7.0, "last_reading_at": None},
    {"id": 51, "name": "Võ Chí Công (Chân cầu Nhật Tân)", "sensor_id": "SENSOR-051", "threshold_cm": 20, "lng": 105.8070, "lat": 21.0720, "depth_cm": 4.0, "last_reading_at": None},

    # --- Long Biên ---
    {"id": 52, "name": "Nguyễn Văn Cừ - Ngọc Lâm (Long Biên)", "sensor_id": "SENSOR-052", "threshold_cm": 20, "lng": 105.8710, "lat": 21.0450, "depth_cm": 10.0, "last_reading_at": None},
    {"id": 53, "name": "Cổ Linh (Chân cầu Vĩnh Tuy - Long Biên)", "sensor_id": "SENSOR-053", "threshold_cm": 20, "lng": 105.8920, "lat": 21.0180, "depth_cm": 14.0, "last_reading_at": None},

    # --- Hà Đông ---
    {"id": 54, "name": "Quang Trung - Ga La Khê (Hà Đông)", "sensor_id": "SENSOR-054", "threshold_cm": 20, "lng": 105.7650, "lat": 20.9650, "depth_cm": 24.0, "last_reading_at": None},
    {"id": 55, "name": "Yên Nghĩa (Bến xe Yên Nghĩa)", "sensor_id": "SENSOR-055", "threshold_cm": 20, "lng": 105.7480, "lat": 20.9520, "depth_cm": 12.0, "last_reading_at": None},

    # --- Thanh Trì ---
    {"id": 56, "name": "Ngọc Hồi - Cầu Ngọc Hồi (Thanh Trì)", "sensor_id": "SENSOR-056", "threshold_cm": 20, "lng": 105.8570, "lat": 20.9320, "depth_cm": 22.0, "last_reading_at": None},
    {"id": 57, "name": "Phan Trọng Tuệ - Cầu Bươu (Thanh Trì)", "sensor_id": "SENSOR-057", "threshold_cm": 20, "lng": 105.8285, "lat": 20.9575, "depth_cm": 24.0, "last_reading_at": None},
    {"id": 58, "name": "Vĩnh Quỳnh - Đường 70 (Thanh Trì)", "sensor_id": "SENSOR-058", "threshold_cm": 20, "lng": 105.8450, "lat": 20.9420, "depth_cm": 16.0, "last_reading_at": None},
    {"id": 59, "name": "Tả Thanh Oai - Ven Sông Nhuệ", "sensor_id": "SENSOR-059", "threshold_cm": 20, "lng": 105.8050, "lat": 20.9480, "depth_cm": 18.0, "last_reading_at": None},

    # --- Thường Tín ---
    {"id": 60, "name": "Thị trấn Thường Tín (Quốc lộ 1A)", "sensor_id": "SENSOR-060", "threshold_cm": 20, "lng": 105.8640, "lat": 20.8710, "depth_cm": 15.0, "last_reading_at": None},
    {"id": 61, "name": "Quán Gánh - Duyên Thái (Thường Tín)", "sensor_id": "SENSOR-061", "threshold_cm": 20, "lng": 105.8600, "lat": 20.9020, "depth_cm": 21.0, "last_reading_at": None},

    # --- Thanh Oai ---
    {"id": 62, "name": "Thị trấn Kim Bài (Thanh Oai - QL 21B)", "sensor_id": "SENSOR-062", "threshold_cm": 20, "lng": 105.7750, "lat": 20.8700, "depth_cm": 10.0, "last_reading_at": None},
    {"id": 63, "name": "Cầu Đen - Bình Minh (Thanh Oai)", "sensor_id": "SENSOR-063", "threshold_cm": 20, "lng": 105.7820, "lat": 20.9120, "depth_cm": 14.0, "last_reading_at": None},

    # --- Hoài Đức ---
    {"id": 64, "name": "Trạm Trôi (Hoài Đức - Quốc lộ 32)", "sensor_id": "SENSOR-064", "threshold_cm": 20, "lng": 105.7150, "lat": 21.0650, "depth_cm": 16.0, "last_reading_at": None},
    {"id": 65, "name": "Nam An Khánh - Bảo Sơn (Hoài Đức)", "sensor_id": "SENSOR-065", "threshold_cm": 25, "lng": 105.7320, "lat": 20.9980, "depth_cm": 26.0, "last_reading_at": None},
    {"id": 66, "name": "Vân Canh - Đường 70 (Hoài Đức)", "sensor_id": "SENSOR-066", "threshold_cm": 20, "lng": 105.7350, "lat": 21.0320, "depth_cm": 12.0, "last_reading_at": None},

    # --- Gia Lâm ---
    {"id": 67, "name": "Trâu Quỳ (Gia Lâm - HV Nông Nghiệp)", "sensor_id": "SENSOR-067", "threshold_cm": 20, "lng": 105.9320, "lat": 21.0080, "depth_cm": 18.0, "last_reading_at": None},
    {"id": 68, "name": "Ninh Hiệp - Dốc Lã (Gia Lâm)", "sensor_id": "SENSOR-068", "threshold_cm": 20, "lng": 105.9380, "lat": 21.0850, "depth_cm": 12.0, "last_reading_at": None},
    {"id": 69, "name": "Đặng Xá - Quốc lộ 5 (Gia Lâm)", "sensor_id": "SENSOR-069", "threshold_cm": 20, "lng": 105.9520, "lat": 21.0250, "depth_cm": 15.0, "last_reading_at": None},

    # --- Đông Anh ---
    {"id": 70, "name": "Thị trấn Đông Anh (Ngã tư Quốc lộ 3)", "sensor_id": "SENSOR-070", "threshold_cm": 20, "lng": 105.8500, "lat": 21.1420, "depth_cm": 14.0, "last_reading_at": None},
    {"id": 71, "name": "Cầu Đôi - Hải Bối (Đông Anh)", "sensor_id": "SENSOR-071", "threshold_cm": 20, "lng": 105.8150, "lat": 21.1050, "depth_cm": 9.0, "last_reading_at": None},
    {"id": 72, "name": "Tiên Dương - Cầu Nhật Tân nối dài", "sensor_id": "SENSOR-072", "threshold_cm": 20, "lng": 105.8250, "lat": 21.1350, "depth_cm": 0.0, "last_reading_at": None},

    # --- Bắc Từ Liêm ---
    {"id": 73, "name": "Nhổn - ĐH Công Nghiệp (Bắc Từ Liêm)", "sensor_id": "SENSOR-073", "threshold_cm": 20, "lng": 105.7360, "lat": 21.0540, "depth_cm": 25.0, "last_reading_at": None},
    {"id": 74, "name": "Cổ Nhuế (Ngõ 145 Cổ Nhuế - BTL)", "sensor_id": "SENSOR-074", "threshold_cm": 20, "lng": 105.7830, "lat": 21.0680, "depth_cm": 20.0, "last_reading_at": None},
    {"id": 75, "name": "Cầu Diễn (Đường 32 qua sông Nhuệ)", "sensor_id": "SENSOR-075", "threshold_cm": 20, "lng": 105.7580, "lat": 21.0420, "depth_cm": 17.0, "last_reading_at": None},
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
