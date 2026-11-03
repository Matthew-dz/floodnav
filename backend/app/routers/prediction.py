"""
Router dự báo mực nước bằng mô hình AI (Scikit-learn Gradient Boosting).
Phụ trách chính: Thành viên 2 (Senior Backend)
"""
import logging
from pathlib import Path
import numpy as np
import joblib
from fastapi import APIRouter
from ..db import pool
from .flood_points import DEFAULT_FLOOD_POINTS

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

@router.get("")
def get_ai_predictions():
    """
    Trả về kết quả dự báo mực nước sau 30 và 60 phút cho toàn bộ 8 điểm ngập.
    Sử dụng mô hình Scikit-learn Gradient Boosting đã huấn luyện.
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
        points = [
            {
                "id": p["id"],
                "name": p["name"],
                "threshold_cm": p["threshold_cm"],
                "current_depth": p.get("depth_cm", 0.0)
            }
            for p in DEFAULT_FLOOD_POINTS
        ]

    results = []
    for pt in points:
        d = float(pt["current_depth"])
        # Giả định lượng mưa 1h và 3h ước tính dựa trên mực nước hiện tại
        rain_1h = max(5.0, d * 0.8)
        rain_3h = rain_1h * 1.5
        slope = 1.2 # Hệ số trũng trung bình đô thị
        
        features = np.array([[d, rain_1h, rain_3h, slope]])
        
        pred_30 = float(m30.predict(features)[0]) if m30 else round(d * 1.25, 1)
        pred_60 = float(m60.predict(features)[0]) if m60 else round(d * 1.5, 1)
        
        pred_30 = max(0.0, round(pred_30, 1))
        pred_60 = max(0.0, round(pred_60, 1))

        # Risk score từ 0.0 đến 1.0
        risk_30 = min(1.0, round(pred_30 / float(pt["threshold_cm"]), 2))
        risk_60 = min(1.0, round(pred_60 / float(pt["threshold_cm"]), 2))

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
