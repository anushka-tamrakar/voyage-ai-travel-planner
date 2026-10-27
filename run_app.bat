@echo off
title VoyageAI Travel Planner Launcher
echo ========================================================
echo  Personalized Travel Itinerary Planner - VoyageAI
echo ========================================================
echo.

echo Starting FastAPI Backend on http://localhost:8000 ...
start "VoyageAI - Backend (Port 8000)" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo Starting Vite Frontend on http://localhost:5173 ...
start "VoyageAI - Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo  All services launched successfully!
echo   - Web App UI:     http://localhost:5173
echo   - Backend API:    http://localhost:8000
echo   - API Swagger UI: http://localhost:8000/docs
echo ========================================================
pause
