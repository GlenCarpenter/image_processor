# Segment Markup

A full-stack application combining a FastAPI backend with a React frontend for running Python scripts through a web interface.

## Project Structure

```
segment_markup/
├── backend/                # FastAPI Python backend
│   ├── routes/            # API route definitions
│   ├── scripts/           # Executable Python scripts
│   ├── config.py          # Application configuration
│   └── main.py            # FastAPI application entry point
├── frontend/              # React frontend (to be created with Vite)
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
└── requirements.txt       # Python dependencies
```

## Setup Instructions

### Backend Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   - Windows:
     ```bash
     .\venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies (with GPU support):**
   ```bash
   python setup_environment.py
   ```
   
   This will install PyTorch with CUDA 12.1 support for GPU acceleration.
   
   *Alternative (CPU-only):*
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   copy .env.example .env
   # Edit .env with your settings
   ```

5. **Run the server:**
   ```bash
   python -m backend.main
   ```
   
   Or use uvicorn directly:
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### Frontend Setup (Coming Soon)

The frontend will be created using Vite with TypeScript and React:

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

## API Endpoints

### Core Endpoints

- `GET /health` - Health check endpoint
- `GET /api/scripts/` - List all available scripts
- `POST /api/scripts/execute` - Execute a Python script

### Example: Execute a Script

```bash
curl -X POST "http://localhost:8000/api/scripts/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "script_name": "example_script",
    "parameters": {"key": "value"}
  }'
```

## Adding New Scripts

1. Create a new Python file in `backend/scripts/`
2. Follow the pattern in `example_script.py`:
   - Accept `--params` argument for JSON parameters
   - Return results via stdout
   - Use proper error handling

Example script template:

```python
import sys
import json
import argparse

def main(params=None):
    # Your script logic here
    print(json.dumps({"result": "success"}))
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", type=str, help="JSON parameters")
    args = parser.parse_args()
    
    params = json.loads(args.params) if args.params else None
    sys.exit(main(params))
```

## Quick Build & Run

**Option 1: Full Build (Recommended for first time)**
```bash
# Windows
build.bat

# Or use Python directly (cross-platform)
python build.py
```

This will:
1. Build the React frontend (if it exists)
2. Install Python dependencies
3. Start the FastAPI server

**Option 2: Development Mode**
```bash
# Windows - skip builds and run with auto-reload
dev.bat

# Or use Python directly
python build.py --skip-frontend --skip-requirements --dev
```

**Build Script Options:**
```bash
python build.py --help

Options:
  --skip-frontend       Skip frontend build
  --skip-requirements   Skip Python requirements installation
  --no-server          Don't start the server after building
  --dev                Start server in development mode with auto-reload
```

## Development

- Backend runs on port 8000 by default
- Frontend dev server will run on port 5173 (Vite default)
- CORS is pre-configured to allow connections from common dev ports
- Use `dev.bat` for quick development without rebuilding

## Technology Stack

**Backend:**
- FastAPI - Modern Python web framework
- Uvicorn - ASGI server
- Pydantic - Data validation
- SAM2 (Ultralytics) - Interactive image segmentation
- PyTorch with CUDA - GPU acceleration

**Frontend:**
- React - UI library
- TypeScript - Type safety
- Vite - Build tool and dev server
- TanStack Router - Type-safe routing
- Zustand - State management

## External Services

### Fal AI Integration

The **Upscale** and **Edit** features use the [Fal AI API](https://fal.ai/) for advanced image processing:

- **Upscale Tool**: Uses Fal's image upscaling models to enhance image resolution and quality
- **Edit Tool**: Uses Fal's Qwen image editing models for AI-powered image modifications based on text prompts

**Setup Required:**
1. Sign up for a Fal AI account at [fal.ai](https://fal.ai/)
2. Get your API key from the Fal dashboard
3. Add your API key to the `.env` file:
   ```bash
   FAL_KEY=your_fal_api_key_here
   ```

**Note:** These features require an active Fal AI subscription and will consume API credits based on usage.

## License

The MIT License (MIT)

Copyright (c) 2024-2025 Alex "mcmonkey" Goodwin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

