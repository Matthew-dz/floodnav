from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import pool
from .routers import flood_points, graph_info, readings, reports, route, weather, prediction

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


@app.get("/", include_in_schema=False)
def home():
    """Giao diện bản đồ tương tác người dùng."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "FloodNav API running. See /docs for API documentation."}


@app.get("/api/health", tags=["Hệ thống"])
def health():
    """Kiểm tra backend + DB + PostGIS đã sống chưa."""
    with pool.connection() as conn:
        row = conn.execute("SELECT PostGIS_Version() AS postgis").fetchone()
    return {"status": "ok", "postgis": row["postgis"]}
