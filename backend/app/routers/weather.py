"""
Router lấy dữ liệu thời tiết & dự báo lượng mưa Hà Nội từ Open-Meteo API.
Phụ trách chính: Thành viên 2 (Senior Backend)
Giấy phép Open-Meteo: GNU AGPL v3 (OSI-Approved, Hoàn toàn miễn phí, không cần API Key)
"""
import urllib.request
import json
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/weather", tags=["Thời tiết & Lượng mưa"])
log = logging.getLogger("floodnav.weather")

# Tọa độ trung tâm Hà Nội (Cầu Giấy / Ba Đình)
HANOI_LAT = 21.0285
HANOI_LNG = 105.8030

OPEN_METEO_URL = (
    f"https://api.open-meteo.com/v1/forecast?"
    f"latitude={HANOI_LAT}&longitude={HANOI_LNG}&"
    f"hourly=precipitation,rain,weather_code&"
    f"timezone=Asia%2FBangkok&forecast_days=1"
)

@router.get("/hanoi")
def get_hanoi_weather():
    """
    Lấy dự báo lượng mưa theo từng giờ trong ngày của Hà Nội.
    Dữ liệu được dùng để làm đầu vào cho mô hình AI dự báo ngập nước.
    """
    try:
        req = urllib.request.Request(
            OPEN_METEO_URL,
            headers={"User-Agent": "FloodNav-OpenSource-Research/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])[:24]
        precip = hourly.get("precipitation", [])[:24]
        
        return {
            "status": "ok",
            "city": "Hà Nội",
            "coordinates": {"lat": HANOI_LAT, "lng": HANOI_LNG},
            "hourly_forecast": [
                {"time": t, "precipitation_mm": p}
                for t, p in zip(times, precip)
            ]
        }
    except Exception as e:
        log.warning("Không thể kết nối Open-Meteo API: %s", e)
        # Trả về fallback dữ liệu giả định nếu máy offline khi demo
        return {
            "status": "fallback",
            "city": "Hà Nội",
            "hourly_forecast": [
                {"time": f"2026-11-02T{h:02d}:00", "precipitation_mm": 5.2 if 14 <= h <= 18 else 0.0}
                for h in range(24)
            ]
        }
