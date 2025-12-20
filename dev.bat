@echo off
REM Run Segment Markup in development mode with auto-reload

echo Starting in development mode...

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

python build.py --skip-frontend --skip-requirements --dev

if errorlevel 1 (
    echo.
    echo Failed to start!
    pause
    exit /b 1
)
