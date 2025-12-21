@echo off
REM Build Segment Markup project (install requirements and build frontend)

echo Starting build process...
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
