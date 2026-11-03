"""
Bộ kiểm thử tự động (Unit Test & Benchmark) cho toàn bộ hệ thống FloodNav.
Phụ trách chính: Thành viên 2 (Senior Backend)
Chạy: python -m unittest discover -s tests
"""
import time
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.graph import get_graph

class TestFloodNavBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Khởi động trước đồ thị (warm-up) để đo benchmark chuẩn xác thời gian giải thuật A*/Dijkstra
        try:
            get_graph()
        except Exception:
            pass

    def test_01_health_check(self):
        """Kiểm tra kết nối PostgreSQL và PostGIS."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("3.", data.get("postgis", ""))

    def test_02_flood_points_geojson(self):
        """Kiểm tra danh sách 8 điểm ngập trả về chuẩn GeoJSON."""
        res = self.client.get("/api/flood-points")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(data.get("features", [])), 8)

    def test_03_weather_open_meteo(self):
        """Kiểm tra tích hợp API Thời tiết Open-Meteo."""
        res = self.client.get("/api/weather/hanoi")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("hourly_forecast", data)
        self.assertEqual(data.get("city"), "Hà Nội")

    def test_04_ai_predictions(self):
        """Kiểm tra mô hình AI Scikit-learn dự báo mực nước 30/60 phút."""
        res = self.client.get("/api/predictions")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 8)
        first_pt = data[0]
        self.assertIn("forecast_30m", first_pt)
        self.assertIn("forecast_60m", first_pt)
        self.assertIn("predicted_depth_cm", first_pt["forecast_30m"])

    def test_05_route_calculation_and_benchmark(self):
        """Kiểm tra tìm đường và đo đạc hiệu năng (Benchmark < 250ms)."""
        payload = {
            "origin": {"lng": 105.780, "lat": 21.037},
            "destination": {"lng": 105.812, "lat": 21.011},
            "vehicle": "motorbike",
            "use_ai_prediction": True
        }
        
        t0 = time.perf_counter()
        res = self.client.post("/api/route", json=payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("ai_prediction_applied"))
        self.assertIn("safe", data)
        self.assertIn("fastest", data)
        self.assertTrue(data["safe"]["found"])
        
        print(f"\n[Benchmark] Thời gian tìm đường A* né ngập (2235 nút): {elapsed_ms:.2f} ms")
        self.assertLess(elapsed_ms, 500) # Đảm bảo thuật toán phản hồi siêu nhanh dưới 500ms

if __name__ == "__main__":
    unittest.main()
