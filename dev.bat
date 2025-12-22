@echo off
REM Run Image Processor in development mode with auto-reload

echo Starting in development mode...

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Use venv Python directly if it exists
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe build.py --skip-frontend --skip-requirements --dev
) else (
    python build.py --skip-frontend --skip-requirements --dev
)

if errorlevel 1 (
    echo.
    echo Failed to start!
    pause
    exit /b 1
)
