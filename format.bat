@echo off
REM Format Python code with black

echo Formatting Python code with black...
python -m black backend
python -m black *.py

echo.
echo ✅ Python code formatted!
pause
