# Cross-Platform Build Instructions

This project now supports building on **Windows**, **macOS**, and **Linux**.

## Quick Start

### Windows
```bash
build.bat
```

### macOS / Linux
```bash
chmod +x build.sh
./build.sh
```

## Detailed Setup

### Prerequisites
- **Python 3.10+** (required for code syntax compatibility)
- **Node.js 16+** (for frontend build)
- **pip** (comes with Python)

### Windows

#### Step 1: Run the Build Script
```cmd
build.bat
```

This script will:
1. Create a Python virtual environment (`venv/`)
2. Install Python dependencies using `setup_environment.py`
3. Build the React frontend
4. Exit (ready for you to run the server)

#### Step 2: Start the Server
```cmd
REM Development mode (with auto-reload)
dev.bat

REM Or production mode
Windows_Start_App.bat
```

---

### macOS / Linux

#### Step 1: Make the Script Executable
```bash
chmod +x build.sh
```

#### Step 2: Run the Build Script
```bash
./build.sh
```

This script will:
1. Create a Python virtual environment (`venv/`)
2. Install Python dependencies using `setup_environment.py`
3. Build the React frontend
4. Exit (ready for you to run the server)

#### Step 3: Activate Virtual Environment
```bash
source venv/bin/activate
```

#### Step 4: Start the Server
```bash
# Development mode (with auto-reload)
python build.py --dev

# Or production mode
python -m backend.main
```

---

## Troubleshooting

### macOS Pydantic Issues

If you encounter pydantic-related errors on macOS:

**Problem**: `ImportError: cannot import name 'ValidationError'` or version conflicts

**Solution**: The build system now handles this automatically by:
1. Upgrading pip, setuptools, and wheel first
2. Using version ranges instead of exact versions
3. Installing PyTorch from the CPU index for macOS compatibility

If you still have issues, manually clean and rebuild:
```bash
rm -rf venv
./build.sh
```

### ImportError with ultralytics/sam

If you see `ModuleNotFoundError: No module named 'ultralytics'`:

```bash
source venv/bin/activate
pip install ultralytics
python build.py --skip-frontend --skip-requirements
```

### PyTorch Not Detected

To check if PyTorch is installed correctly:
```bash
source venv/bin/activate
python -c "import torch; print(torch.__version__)"
```

On macOS, PyTorch is installed without CUDA. This is normal and the app will work fine using CPU.

### Node.js Not Found

If the frontend build fails with "Node.js not found":

**macOS with Homebrew**:
```bash
brew install node
```

**Ubuntu/Debian**:
```bash
sudo apt-get install nodejs npm
```

**Other Systems**: Download from https://nodejs.org/

---

## Environment Details

### PyTorch Installation by OS

| OS | GPU Support | Index URL |
|----|-------------|-----------|
| Windows | NVIDIA CUDA 12.1 | `https://download.pytorch.org/whl/cu121` |
| Linux | NVIDIA CUDA 12.1 | `https://download.pytorch.org/whl/cu121` |
| macOS | CPU/Metal | `https://download.pytorch.org/whl/cpu` |

For macOS with Apple Silicon, the CPU version includes Metal acceleration automatically.

---

## Development Commands

```bash
# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Start server with auto-reload
python build.py --dev

# Format Python code
python build.py --format

# Skip frontend rebuild (faster for backend-only changes)
python build.py --skip-frontend --dev

# Install only requirements (skip frontend and server)
python build.py --no-server --skip-frontend
```

---

## Virtual Environment Structure

After building, you'll have:

```
image_processor/
├── venv/                 # Python virtual environment
├── build.bat            # Windows build script
├── build.sh             # macOS/Linux build script
├── build.py             # Python build orchestrator
├── setup_environment.py # Dependency installer with GPU support
├── frontend/            # React TypeScript frontend
├── backend/             # FastAPI backend
└── requirements.txt     # Python dependencies
```

---

## Caching & Performance

- **First build**: ~5-10 minutes (installs all dependencies and builds frontend)
- **Subsequent builds**: <1 minute (skipping certain steps)

To speed up development:
```bash
# Skip frontend build if you're only changing backend
python build.py --skip-frontend --dev
```

---

## Multi-platform CI/CD

For automated builds in CI/CD:

```bash
#!/bin/bash
# Detect OS and run appropriate build
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    build.bat
else
    chmod +x build.sh
    ./build.sh
fi
```
