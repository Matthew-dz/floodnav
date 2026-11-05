"""
Router dự báo mực nước bằng mô hình AI (Scikit-learn Gradient Boosting).
Phụ trách chính: Thành viên 2 (Senior Backend)
Tích hợp:
- Dữ liệu khí tượng lượng mưa thực tế theo thời gian từ Open-Meteo API
- Mô hình thủy văn đô thị & hệ số trũng địa hình theo từng điểm ngập
"""
import logging
from pathlib import Path
import numpy as np
import joblib
from fastapi import APIRouter
from ..db import pool
from .flood_points import DEFAULT_FLOOD_POINTS
from .weather import get_hanoi_weather

log = logging.getLogger("floodnav.prediction")
router = APIRouter(prefix="/api/predictions", tags=["Dự báo AI"])

AI_DIR = Path(__file__).resolve().parent.parent / "ai"
MODEL_30_PATH = AI_DIR / "model_30m.joblib"
MODEL_60_PATH = AI_DIR / "model_60m.joblib"

_model_30m = None
_model_60m = None

def get_models():
    global _model_30m, _model_60m
    if _model_30m is None and MODEL_30_PATH.exists():
        _model_30m = joblib.load(MODEL_30_PATH)
    if _model_60m is None and MODEL_60_PATH.exists():
        _model_60m = joblib.load(MODEL_60_PATH)
    return _model_30m, _model_60m

def get_open_meteo_rainfall() -> tuple[float, float]:
    """
    Trích xuất lượng mưa thực tế (mm/h) từ API thời tiết Open-Meteo:
    - rain_1h: Lượng mưa dự báo trong 1 giờ tới
    - rain_3h: Tổng lượng mưa dự báo trong 3 giờ tới
    """
    try:
        weather_data = get_hanoi_weather()
        forecast = weather_data.get("hourly_forecast", [])
        if forecast:
            rain_1h = float(forecast[0].get("precipitation_mm", 0.0))
            rain_3h = sum(float(item.get("precipitation_mm", 0.0)) for item in forecast[:3])
            return rain_1h, rain_3h
    except Exception as e:
        log.warning("Không thể lấy dữ liệu lượng mưa từ Open-Meteo, dùng giá trị mặc định: %s", e)
    return 0.0, 0.0

def get_point_slope(point_name: str, threshold_cm: float) -> float:
    """
    Xác định hệ số độ dốc / trũng địa hình (slope/depression factor) cho từng điểm:
    - Hầm chui: Hệ số cao nhất (~2.2) do dốc dồn nước từ 2 đầu cầu.
    - Vùng trũng ngoại thành, ven sông Tô Lịch/Nhuệ/Đáy: ~1.8 - 2.0.
    - Điểm trũng nội đô: ~1.4 - 1.6.
    - Vùng cốt nền cao (Hoàn Kiếm, Tây Hồ): ~0.85 - 1.0.
    """
    name_lower = point_name.lower()
    if "hầm chui" in name_lower:
        return 2.2
    if any(k in name_lower for k in ["đê tả bùi", "hoa bằng", "cấn hữu", "suối yến", "bến đục", "nam phương tiến", "tân triều"]):
        return 1.9
    if any(k in name_lower for k in ["triều khúc", "định công", "nguyễn khánh toàn", "chùa bộc", "thái hà", "nguyễn trãi", "pháp vân"]):
        return 1.6
    if any(k in name_lower for k in ["bờ hồ", "hoàn kiếm", "tây hồ", "quảng an"]):
        return 0.85
    if threshold_cm >= 25:
        return 1.5
    return 1.2

@router.get("")
def get_ai_predictions():
    """
    Trả về kết quả dự báo mực nước sau 30 và 60 phút cho toàn bộ các điểm ngập.
    Sử dụng mô hình Scikit-learn Gradient Boosting kết hợp dữ liệu khí tượng Open-Meteo thực tế.
    """
    m30, m60 = get_models()

    points = []
    try:
        with pool.connection(timeout=3.0) as conn:
            points = conn.execute("""
                SELECT fp.id, fp.name, fp.threshold_cm, COALESCE(r.depth_cm, 0) as current_depth
                FROM flood_points fp
                LEFT JOIN LATERAL (
                    SELECT depth_cm FROM water_readings WHERE point_id = fp.id ORDER BY recorded_at DESC LIMIT 1
                ) r ON TRUE
                ORDER BY fp.id
            """).fetchall()
    except Exception as e:
        log.warning("DB query failed in get_ai_predictions, using fallback data: %s", e)
        from .flood_points import get_fallback_flood_points
        fb_pts = get_fallback_flood_points()
        points = [
            {
                "id": p["id"],
                "name": p["name"],
                "threshold_cm": p["threshold_cm"],
                "current_depth": p.get("depth_cm", 0.0)
            }
            for p in fb_pts
        ]

    # Lấy lượng mưa thực tế từ Open-Meteo API
    real_rain_1h, real_rain_3h = get_open_meteo_rainfall()

    results = []
    for pt in points:
        d = float(pt["current_depth"])
        slope = get_point_slope(pt["name"], float(pt["threshold_cm"]))
        
        # Đầu vào của mô hình AI: [Mực nước hiện tại, Mưa 1h tới, Mưa dồn 3h, Hệ số trũng địa hình]
        features = np.array([[d, real_rain_1h, real_rain_3h, slope]])
        
        if m30:
            pred_30 = float(m30.predict(features)[0])
        else:
            # Fallback thủy văn nếu chưa load được joblib
            excess = max(0.0, real_rain_1h - 18.0) * 0.45 * slope
            pred_30 = max(0.0, d * 0.90 + excess)
            
        if m60:
            pred_60 = float(m60.predict(features)[0])
        else:
            excess = max(0.0, real_rain_1h - 18.0) * 0.70 * slope
            pred_60 = max(0.0, d * 0.82 + excess)
        
        pred_30 = max(0.0, round(pred_30, 1))
        pred_60 = max(0.0, round(pred_60, 1))

        # Risk score từ 0.0 đến 1.0 chuẩn hóa theo ngưỡng ngập từng trạm
        threshold = float(pt["threshold_cm"])
        risk_30 = min(1.0, round(pred_30 / threshold, 2)) if threshold > 0 else 0.0
        risk_60 = min(1.0, round(pred_60 / threshold, 2)) if threshold > 0 else 0.0

        results.append({
            "point_id": pt["id"],
            "name": pt["name"],
            "current_depth_cm": d,
            "threshold_cm": pt["threshold_cm"],
            "forecast_30m": {
                "predicted_depth_cm": pred_30,
                "risk_score": risk_30,
                "exceeds_threshold": pred_30 >= pt["threshold_cm"]
            },
            "forecast_60m": {
                "predicted_depth_cm": pred_60,
                "risk_score": risk_60,
                "exceeds_threshold": pred_60 >= pt["threshold_cm"]
            }
        })

    return results
