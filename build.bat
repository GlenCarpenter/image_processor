@echo off
REM Build and run Segment Markup project

echo Starting build process...
python build.py %*

if errorlevel 1 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)
