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

3. **Install dependencies:**
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

## Development

- Backend runs on port 8000 by default
- Frontend dev server will run on port 5173 (Vite default)
- CORS is pre-configured to allow connections from common dev ports

## Technology Stack

**Backend:**
- FastAPI - Modern Python web framework
- Uvicorn - ASGI server
- Pydantic - Data validation

**Frontend (Planned):**
- React - UI library
- TypeScript - Type safety
- Vite - Build tool and dev server

## License

[Add your license here]
