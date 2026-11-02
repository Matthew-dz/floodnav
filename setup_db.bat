@echo off
chcp 65001 > nul
echo ========================================================
echo [FloodNav] Cài đặt cơ sở dữ liệu (Database Setup)
echo ========================================================
.\venv\Scripts\python db\setup_db.py
echo.
pause

