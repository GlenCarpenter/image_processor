# macOS Setup Guide

This guide helps resolve common issues when setting up the Image Processor on macOS.

## Quick Start

```bash
chmod +x build.sh
./build.sh
```

If you encounter any issues below, follow the specific troubleshooting section.

---

## Common Issues & Solutions

### 1. Pydantic / ImportError on macOS

**Symptoms**:
- `ImportError: cannot import name 'ValidationError'`
- `ModuleNotFoundError: No module named 'pydantic'`
- Version conflicts between pydantic and pydantic-settings

**Root Cause**: 
macOS sometimes has issues with exact pinned versions. The build system now uses version ranges to allow flexibility.

**Fix**:
```bash
# Clean previous attempts
rm -rf venv

# Run the build script (it now handles this automatically)
./build.sh

# If still failing, manually clean everything
rm -rf venv build frontend/node_modules
./build.sh
```

---

### 2. Python Version Issues (TypeError: unsupported operand type)

**Symptoms**:
- `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`
- Code uses Python 3.10+ syntax with Python 3.9

**Root Cause**: 
The code uses `str | None` type union syntax, which requires Python 3.10+. Python 3.9 and earlier need `Optional[str]` instead.

**Solution**: Use Python 3.10 or later

```bash
# Check your Python version
python3 --version

# If you have Python 3.9 or earlier, upgrade to 3.10+
# Using Homebrew:
brew install python@3.11
brew unlink python@3.9
brew link python@3.11

# Or if using system Python, install from python.org
# https://www.python.org/downloads/
```

**Note**: The project now supports Python 3.9+ but the code uses modern syntax. Python 3.10+ is recommended.

---

### 3. Apple Silicon (M1/M2/M3) Issues

**Symptoms**:
- Architecture mismatch errors
- Native module compilation failures

**Solution**:
The build script automatically handles this. However, if you have mixed Intel/ARM versions:

```bash
# Ensure you're using native Python (not Rosetta emulation)
# Check architecture:
python3 -c "import platform; print(platform.machine())"
# Should print: arm64 (for native M-series), x86_64 (for Intel)

# If x86_64, you're running under Rosetta. Reinstall Python natively:
arch  # Check current architecture
# If i386, you're in Rosetta. Uninstall and reinstall
brew uninstall python@3.11
brew install python@3.11
```

---

### 4. Node.js / Frontend Build Issues

**Symptoms**:
- `npm: command not found`
- Node version errors

**Solution**:

```bash
# Install Node.js with Homebrew
brew install node

# Or using nvm (Node Version Manager) - recommended
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

---

### 5. Permission Denied Errors

**Symptoms**:
- `Permission denied: ./build.sh`
- Can't write to directories

**Solution**:
```bash
# Make script executable
chmod +x build.sh

# Run build
./build.sh
```

---

### 6. Virtual Environment Issues

**Symptoms**:
- `venv: command not found`
- Virtual environment won't activate

**Solution**:

```bash
# Ensure venv module is available
python3 -m venv --help

# If that fails, install it
brew install python@3.11
python3 -m pip install --upgrade pip

# Try building again
rm -rf venv
./build.sh
```

---

### 7. PyTorch / Torch Issues

**Symptoms**:
- `ModuleNotFoundError: No module named 'torch'`
- Slow performance (using CPU when GPU expected)

**Solution**:

On macOS, PyTorch runs on CPU/Metal (which is fine - no CUDA support on Apple chips).

```bash
# Verify PyTorch installation
source venv/bin/activate
python -c "import torch; print(torch.__version__); print(f'MPS available: {torch.backends.mps.is_available()}')"

# If torch is missing, reinstall
source venv/bin/activate
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

---

### 8. Frontend Build Fails

**Symptoms**:
- npm install fails
- Missing dependencies warnings
- node-gyp errors

**Solution**:

```bash
# Clean and rebuild frontend
rm -rf frontend/node_modules frontend/dist

# Rebuild
chmod +x build.sh
./build.sh

# Or manually rebuild frontend
cd frontend
npm install
npm run build
cd ..
```

---

### 9. Disk Space Issues

The build requires ~5GB of disk space:
- Python packages: ~2GB
- Node modules: ~1.5GB
- Models (optional): ~2GB

```bash
# Check available space
df -h

# If space is low, clean up
rm -rf ~/Library/Caches/pip
rm -rf ~/Library/Caches/Homebrew
brew cleanup
```

---

### 10. Port Already in Use

**Symptoms**:
- `Address already in use port 8000`

**Solution**:

```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use a different port
source venv/bin/activate
python -m uvicorn backend.main:app --port 8001 --reload
```

---

## Manual Installation (if build script fails)

If the build script fails completely, try manual setup:

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Upgrade pip
pip install --upgrade pip setuptools wheel

# 3. Install PyTorch (CPU for macOS)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# 4. Install other requirements (excluding torch entries)
pip install fastapi uvicorn pydantic pydantic-settings python-multipart
pip install python-dotenv pillow tqdm black fal-client requests
pip install diffusers transformers accelerate huggingface-hub peft ultralytics

# 5. Build frontend
cd frontend
npm install
npm run build
cd ..

# 6. Start server
python -m backend.main
```

---

## Verification Checklist

After successful setup:

```bash
# 1. Check Python
source venv/bin/activate
python --version  # Should be 3.10+
which python       # Should show venv path

# 2. Check PyTorch
python -c "import torch; print(f'PyTorch: {torch.__version__}')"

# 3. Check FastAPI
python -c "import fastapi; print(f'FastAPI: {fastapi.__version__}')"

# 4. Check Node
node --version     # Should be 16+
npm --version      # Should be 8+

# 5. Check frontend build
ls frontend/dist   # Should exist if built successfully

# 6. Start server
python -m backend.main
# Should see: Uvicorn running on http://127.0.0.1:8000
```

---

## Getting Help

If you're still having issues:

1. **Check error messages carefully** - they often indicate the exact problem
2. **Clean and rebuild**:
   ```bash
   rm -rf venv frontend/node_modules frontend/dist
   ./build.sh
   ```
3. **Verify prerequisites**:
   ```bash
   python3 --version  # 3.10+
   node --version     # 16+
   npm --version      # 8+
   ```
4. **Check available disk space**: `df -h`
5. **Review this guide** for your specific error message

---

## Next Steps

Once setup is complete:

1. **Start development server**:
   ```bash
   source venv/bin/activate
   python build.py --dev
   ```

2. **Open in browser**: http://localhost:3000 (frontend) or http://localhost:8000 (API docs)

3. **Start developing**: Make changes to backend or frontend code - changes auto-reload!

Happy developing! 🚀
