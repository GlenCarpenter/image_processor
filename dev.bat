@echo off
REM Run Segment Markup in development mode with auto-reload

echo Starting in development mode...
python build.py --skip-frontend --skip-requirements --dev

if errorlevel 1 (
    echo.
    echo Failed to start!
    pause
    exit /b 1
)
