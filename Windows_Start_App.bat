@echo off
REM Windows Start App Script - Build (if needed) and start Segment Markup

echo ========================================
echo Image Processor - Start Application
echo ========================================
echo.

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo.
)

REM Check if app has been built (check for frontend dist folder)
if not exist "frontend\dist" (
    echo App has not been built yet. Running build script...
    echo.
    call build.bat
    if errorlevel 1 (
        echo.
        echo Build failed!
        pause
        exit /b 1
    )
) else (
    echo App already built. Skipping build step.
    echo.
)

REM Start the server in the background
echo Starting server on http://localhost:8000
echo.
start "Image Processor Server" python build.py --skip-frontend --skip-requirements

REM Wait a moment for server to start
timeout /t 3 /nobreak >nul

REM Open browser to the app
echo Opening app in browser...
start http://localhost:8000

echo.
echo Application started!
echo.
echo The server is running in a separate window.
echo To stop the server, close the "Image Processor Server" window.
echo.

pause
