#!/bin/bash
# Build Image Processor project (create venv, install requirements and build frontend)
# Works on macOS and Linux

set -e  # Exit on error

echo "Starting build process..."

# Check if venv exists, create it if not
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "[OK] Virtual environment created!"
else
    echo "[OK] Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

echo ""
echo "Using Python: $(which python)"
echo "Python version: $(python --version)"

# Run the build script using the venv python directly
python build.py --no-server "$@"

if [ $? -ne 0 ]; then
    echo ""
    echo "Build failed!"
    exit 1
fi

echo ""
echo "[OK] Build complete!"
echo ""
echo "To start the server in development mode, run: source venv/bin/activate && python build.py --dev"
echo "To start the server in production mode, run: source venv/bin/activate && python -m backend.main"
