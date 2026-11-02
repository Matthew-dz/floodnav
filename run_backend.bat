@echo off
chcp 65001 > nul
echo ========================================================
echo [FloodNav] Khởi chạy Backend FastAPI (Uvicorn Server)
echo ========================================================
echo Swagger UI: http://localhost:8000/docs
echo Health Check: http://localhost:8000/api/health
echo ========================================================
cd backend
..\venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause

