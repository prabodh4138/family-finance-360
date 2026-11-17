@echo off
title Family Finance 360 - Production Launcher
echo ========================================================
echo         Family Finance 360 - Production Mode
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking backend virtual environment...
if not exist "backend\.venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    cd backend
    py -3.12 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    cd ..
)

echo [2/3] Checking and applying database migrations...
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
cd ..

echo [3/3] Starting Backend and Frontend Servers...
start "FF360 Backend (FastAPI)" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "FF360 Frontend (Vite Preview / Dev)" cmd /k "cd /d %~dp0frontend && npm run preview -- --host 127.0.0.1 --port 5173"

echo.
echo ========================================================
echo Services are running:
echo   - Web Application: http://127.0.0.1:5173
echo   - Backend API:     http://127.0.0.1:8000
echo   - Interactive API: http://127.0.0.1:8000/docs
echo ========================================================
echo Press any key to close this launcher window (servers will keep running in background).
pause >nul
