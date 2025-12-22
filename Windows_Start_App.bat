@echo off
REM Windows Start App Script - Build (if needed) and start Image Processor

echo ========================================
echo Image Processor - Start Application
echo ========================================
echo.

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo.
    echo Using Python from:
    where python
    echo.
) else (
    echo WARNING: No virtual environment found!
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

REM Start the server (will show output in this terminal)
echo Starting server on http://localhost:8000
echo.

REM Use venv Python directly if it exists, otherwise use system Python
if exist venv\Scripts\python.exe (
    start /b "" venv\Scripts\python.exe build.py --skip-frontend --skip-requirements
) else (
    start /b "" python build.py --skip-frontend --skip-requirements
)

REM Wait for server to be ready by polling the health endpoint
echo Waiting for server to start...
set ATTEMPT=0

:wait_loop
set /a ATTEMPT+=1
if %ATTEMPT% GTR 30 (
    echo.
    echo Warning: Server did not respond after 30 seconds.
    echo Opening browser anyway...
    goto open_browser
)

REM Try to connect to the health endpoint using curl (built-in to Windows 10+)
curl -s -f -o nul http://localhost:8000/health 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Server is ready!
    echo.
    goto open_browser
)

REM Server not ready yet, wait and retry
timeout /t 1 /nobreak >nul
goto wait_loop

:open_browser
REM Open browser to the app
echo Opening app in browser...
start http://localhost:8000

echo.
echo Application started!
echo.
echo Server is running in the background. Server logs will appear below:
echo Press Ctrl+C to stop the server.
echo.
echo ========================================
echo.

REM Wait to let server output appear
timeout /t 1 /nobreak >nul

REM Keep the script running so we can see server output
:keep_alive
timeout /t 60 /nobreak >nul
goto keep_alive

pause
