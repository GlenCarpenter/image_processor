@echo off
REM Build Segment Markup project (create venv, install requirements and build frontend)

echo Starting build process...

REM Check if venv exists, create it if not
if not exist "venv\" (
    echo.
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo ❌ Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo ✅ Virtual environment created!
) else (
    echo ✓ Virtual environment already exists
)

REM Activate the virtual environment
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

if errorlevel 1 (
    echo.
    echo ❌ Failed to activate virtual environment!
    pause
    exit /b 1
)

REM Run the build script from within the venv
python build.py --no-server %*

if errorlevel 1 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Build complete!
echo.
echo To start the server, run: dev.bat (development) or Windows_Start_App.bat (production)
pause
