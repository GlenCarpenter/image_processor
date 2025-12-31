#!/bin/bash
# Development launcher for Image Processor (macOS/Linux)
# Starts the server with auto-reload

set -e

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "[ERROR] Virtual environment not found!"
    echo "Please run: ./build.sh"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

echo ""
echo "============================================================"
echo "Starting Image Processor in Development Mode"
echo "============================================================"
echo ""
echo "Backend API:     http://localhost:8000"
echo "API Docs:        http://localhost:8000/docs"
echo "Frontend:        http://localhost:3000 (if running separately)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "============================================================"
echo ""

# Start the server with auto-reload
python build.py --dev
