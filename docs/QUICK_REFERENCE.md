# Quick Reference - Building Image Processor

## Requirements
- **Python 3.10+** (Python 3.9 may have compatibility issues)
- **Node.js 16+**
- **npm 8+**

## TL;DR - Just Build It!

### Windows
```cmd
build.bat
```

### macOS
```bash
chmod +x build.sh
./build.sh
```

### Linux
```bash
chmod +x build.sh
./build.sh
```

---

## After Build Completes

### Start Development Server

**Windows:**
```cmd
dev.bat
```

**macOS/Linux:**
```bash
chmod +x dev.sh
./dev.sh
```

Or manually:
```bash
source venv/bin/activate  # macOS/Linux
python build.py --dev
```

### Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

---

## Common Commands

```bash
# Activate virtual environment
source venv/bin/activate          # macOS/Linux
venv\Scripts\activate             # Windows

# Start development server (with auto-reload)
python build.py --dev

# Skip frontend rebuild (faster for backend changes)
python build.py --skip-frontend --dev

# Format Python code
python build.py --format

# Rebuild everything
rm -rf venv
./build.sh                         # macOS/Linux
# or
build.bat                          # Windows
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Permission denied: ./build.sh` | `chmod +x build.sh` |
| Pydantic errors on macOS | See `MACOS_SETUP_GUIDE.md` |
| Port 8000 already in use | `kill -9 $(lsof -t -i :8000)` |
| Node.js not found | `brew install node` (macOS) or `apt install nodejs` (Linux) |
| Virtual env not found | `chmod +x build.sh && ./build.sh` to rebuild |
| PyTorch not installed | Build should handle this automatically |

---

## More Information

- **Full Setup Guide**: See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- **macOS Specific Issues**: See [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md)
- **Build System Details**: See [CROSS_PLATFORM_BUILD_SUMMARY.md](CROSS_PLATFORM_BUILD_SUMMARY.md)

---

## What Gets Installed

```
✓ Python virtual environment
✓ Python dependencies (FastAPI, PyTorch, etc.)
✓ React frontend + dependencies
✓ Node.js packages
```

**Total Time**: 5-10 minutes (first build), <1 minute (subsequent)
**Disk Space**: ~5GB required

---

## Still Having Issues?

1. **Read the error message carefully** - it usually explains what's wrong
2. **Check the specific guide**:
   - Windows: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
   - macOS: [MACOS_SETUP_GUIDE.md](MACOS_SETUP_GUIDE.md)
   - Linux: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
3. **Try a clean rebuild**:
   ```bash
   rm -rf venv frontend/node_modules frontend/dist
   ./build.sh  # or build.bat on Windows
   ```
4. **Check prerequisites**: Python 3.10+, Node.js 16+

---

Happy building! 🚀
