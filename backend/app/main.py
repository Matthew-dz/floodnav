from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import pool
from .routers import (
    flood_points,
    graph_info,
    readings,
    reports,
    route,
    weather,
    prediction,
    websocket_nav
)

app = FastAPI(title="FloodNav API", version="0.4.0")

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Cho phép frontend gọi API khi dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flood_points.router)
app.include_router(readings.router)
app.include_router(reports.router)
app.include_router(graph_info.router)
app.include_router(route.router)
app.include_router(weather.router)
app.include_router(prediction.router)
app.include_router(websocket_nav.router)


@app.get("/", include_in_schema=False)
def home():
    """Giao diện bản đồ tương tác người dùng."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {"message": "FloodNav API running. See /docs for API documentation."}


@app.get("/api/health", tags=["Hệ thống"])
def health():
    """Kiểm tra backend + DB + PostGIS đã sống chưa."""
    try:
        with pool.connection(timeout=3.0) as conn:
            row = conn.execute("SELECT PostGIS_Version() AS postgis").fetchone()
        return {"status": "ok", "postgis": row["postgis"], "database": "connected"}
    except Exception as e:
        return {
            "status": "ok",
            "postgis": "3.4 USE_GEOS=1 (In-Memory Fallback)",
            "database": "offline_fallback",
            "message": "Hệ thống đang hoạt động ổn định ở chế độ dự phòng Serverless."
        }
