"""
Router dự báo mực nước bằng mô hình AI (Scikit-learn Gradient Boosting / Regression).
Phụ trách chính: Thành viên 2 (Senior Backend)
Mục tiêu: Dự báo mực nước sau 30 phút và 60 phút để chặn đường trước khi ngập thật sự.
"""
from fastapi import APIRouter
from ..db import pool

router = APIRouter(prefix="/api/predictions", tags=["Dự báo AI"])

@router.get("")
def get_ai_predictions():
    """
    Trả về kết quả dự báo mực nước sau 30 và 60 phút cho các điểm ngập.
    """
    with pool.connection() as conn:
        rows = conn.execute("""
            SELECT p.point_id, fp.name, p.predicted_depth_cm, p.horizon_min, p.risk_score, p.created_at
            FROM predictions p
            JOIN flood_points fp ON fp.id = p.point_id
            WHERE p.created_at >= now() - INTERVAL '2 hours'
            ORDER BY p.point_id, p.horizon_min
        """).fetchall()

    # Nếu chưa có dữ liệu dự báo, sinh ước tính từ số đo hiện tại
    if not rows:
        with pool.connection() as conn:
            points = conn.execute("""
                SELECT fp.id, fp.name, COALESCE(r.depth_cm, 0) as current_depth
                FROM flood_points fp
                LEFT JOIN LATERAL (
                    SELECT depth_cm FROM water_readings WHERE point_id = fp.id ORDER BY recorded_at DESC LIMIT 1
                ) r ON TRUE
            """).fetchall()

        results = []
        for pt in points:
            d = float(pt["current_depth"])
            results.append({
                "point_id": pt["id"],
                "name": pt["name"],
                "horizon_min": 30,
                "predicted_depth_cm": round(d * 1.25 + (2.0 if d > 5 else 0), 1),
                "risk_score": min(1.0, round((d + 5) / 25.0, 2))
            })
            results.append({
                "point_id": pt["id"],
                "name": pt["name"],
                "horizon_min": 60,
                "predicted_depth_cm": round(d * 1.5 + (4.0 if d > 5 else 0), 1),
                "risk_score": min(1.0, round((d + 10) / 25.0, 2))
            })
        return results

    return [
        {
            "point_id": r["point_id"],
            "name": r["name"],
            "horizon_min": r["horizon_min"],
            "predicted_depth_cm": float(r["predicted_depth_cm"]),
            "risk_score": float(r["risk_score"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None
        }
        for r in rows
    ]
