@echo off
REM Build Image Processor project (create venv, install requirements and build frontend)

echo Starting build process...

REM Check if venv exists, create it if not
if not exist "venv\" (
    echo.
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created!
) else (
    echo [OK] Virtual environment already exists
)

REM Use venv python directly instead of relying on activation
set VENV_PYTHON=venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo.
    echo [ERROR] Virtual environment Python not found at %VENV_PYTHON%!
    pause
    exit /b 1
)

echo.
echo Using Python: %VENV_PYTHON%

REM Run the build script using the venv python directly
"%VENV_PYTHON%" build.py --no-server %*

if errorlevel 1 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Build complete!
echo.
echo To start the server, run: dev.bat (development) or Windows_Start_App.bat (production)
pause