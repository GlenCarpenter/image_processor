# macOS/Linux Build Verification Checklist

After running `./build.sh`, use this checklist to verify everything is working correctly.

## ✅ Pre-Build Checklist

- [ ] You have Python 3.10 or later (`python3 --version`)
- [ ] You have Node.js 16+ (`node --version`)
- [ ] You have npm 8+ (`npm --version`)
- [ ] You have at least 5GB of free disk space (`df -h`)
- [ ] You made the script executable (`chmod +x build.sh`)

## ✅ Build Completion Checklist

After `./build.sh` completes:

- [ ] Virtual environment created: `ls venv/bin/python`
- [ ] Python dependencies installed: `venv/bin/python -c "import fastapi"`
- [ ] Frontend built: `ls frontend/dist/index.html`
- [ ] Node modules installed: `ls frontend/node_modules` has entries
- [ ] No error messages at the end

## ✅ Post-Build Verification

### Test Virtual Environment
```bash
source venv/bin/activate
which python          # Should show path to venv/bin/python
python --version      # Should be 3.10+
```
**Verification:**
- [ ] Python path contains "venv/bin"
- [ ] Python version is 3.10+

### Test Pydantic (This was the main issue!)
```bash
source venv/bin/activate
python -c "
import pydantic
from pydantic import BaseModel, ValidationError
print(f'✓ Pydantic {pydantic.__version__}')
print(f'✓ BaseModel: {BaseModel}')
print(f'✓ ValidationError: {ValidationError}')
"
```
**Verification:**
- [ ] Shows pydantic version without errors
- [ ] Shows BaseModel class
- [ ] Shows ValidationError class

### Test PyTorch
```bash
source venv/bin/activate
python -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'MPS available: {torch.backends.mps.is_available()}')
"
```
**Verification (any one of these is OK):**
- [ ] Shows PyTorch version
- [ ] CUDA available = True (Linux/Windows with GPU)
- [ ] CUDA available = False (macOS - normal, uses Metal)
- [ ] MPS available = True (Apple Silicon)

### Test FastAPI
```bash
source venv/bin/activate
python -c "
import fastapi
import uvicorn
print(f'✓ FastAPI {fastapi.__version__}')
print(f'✓ Uvicorn {uvicorn.__version__}')
"
```
**Verification:**
- [ ] Shows FastAPI version
- [ ] Shows Uvicorn version

### Test Frontend Build
```bash
ls -la frontend/dist/index.html
```
**Verification:**
- [ ] File exists and has size > 1KB

### Test Node
```bash
node --version  # Should be 16+
npm --version   # Should be 8+
```
**Verification:**
- [ ] Node version is 16 or higher
- [ ] npm version is 8 or higher

## ✅ Start Server Test

### Start the Server
```bash
source venv/bin/activate
python build.py --dev
```

**Look for these messages:**
- [ ] `Uvicorn running on http://127.0.0.1:8000`
- [ ] `Application startup complete`
- [ ] No errors in output

### Access the Server

**Option 1: In another terminal**
```bash
curl http://localhost:8000/docs
```
- [ ] Should return HTML (not 404 or connection error)

**Option 2: In browser**
- [ ] Open: http://localhost:8000/docs
- [ ] [ ] Page loads (showing Swagger UI)
- [ ] [ ] No "connection refused" error

**Option 3: Check API health**
```bash
source venv/bin/activate
python -c "
import requests
response = requests.get('http://localhost:8000/')
print(f'Status: {response.status_code}')
print(f'Response: {response.json()}')
"
```
- [ ] Status code is 200

## ✅ Troubleshooting Flow

If something failed above:

1. **Pydantic import error?**
   - See: [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md#1-pydantic--importerror-on-macos)

2. **PyTorch not installed?**
   - See: [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md#7-pytorch--torch-issues)

3. **Frontend build failed?**
   - See: [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md#8-frontend-build-fails)

4. **Node/npm not found?**
   - See: [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md#4-nodejs--frontend-build-issues)

5. **Still stuck?**
   - Try: `rm -rf venv frontend/node_modules && ./build.sh`
   - See full guide: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)

## ✅ All Tests Passed!

If all checkboxes above are checked:

### 🎉 You're Ready!

You can now:

1. **Start development**:
   ```bash
   chmod +x dev.sh
   ./dev.sh
   ```

2. **Make changes**:
   - Edit backend code in `backend/`
   - Edit frontend code in `frontend/src/`
   - Changes auto-reload (no restart needed)

3. **Access the app**:
   - API docs: http://localhost:8000/docs
   - Frontend: http://localhost:3000 (if running separately)

---

## Quick Commands Reference

```bash
# Activate virtual environment
source venv/bin/activate

# Start development server (with auto-reload)
python build.py --dev

# Format Python code
python build.py --format

# Full rebuild
rm -rf venv frontend/node_modules
./build.sh

# Deactivate virtual environment
deactivate
```

---

Happy developing! 🚀
