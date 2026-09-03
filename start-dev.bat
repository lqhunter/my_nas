@echo off
chcp 65001 >nul
cd /d "%~dp0"

set MEDIA_ROOT=%~dp0media
set CONFIG_DIR=%~dp0config

if not exist "%MEDIA_ROOT%" mkdir "%MEDIA_ROOT%"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] .venv not found. Create it first:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

echo =========================================
echo   Media Server local dev
echo   URL: http://localhost:8000
echo   Media: %MEDIA_ROOT%
echo   Ctrl+C to stop
echo =========================================

.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload