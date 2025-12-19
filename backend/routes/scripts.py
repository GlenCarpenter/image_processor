"""
Scripts API Routes
Endpoints for executing and managing Python scripts
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import subprocess
import json
from pathlib import Path

from backend.config import settings

router = APIRouter()


class ScriptRequest(BaseModel):
    """Request model for script execution"""
    script_name: str
    parameters: Optional[Dict[str, Any]] = None


class ScriptResponse(BaseModel):
    """Response model for script execution"""
    success: bool
    output: str
    error: Optional[str] = None


@router.get("/")
async def list_scripts():
    """List all available scripts"""
    scripts_dir = Path(settings.SCRIPTS_DIR)
    if not scripts_dir.exists():
        return {"scripts": []}
    
    scripts = [
        {"name": f.stem, "path": str(f)}
        for f in scripts_dir.glob("*.py")
        if f.stem != "__init__"
    ]
    return {"scripts": scripts}


@router.post("/execute", response_model=ScriptResponse)
async def execute_script(request: ScriptRequest):
    """Execute a Python script with optional parameters"""
    scripts_dir = Path(settings.SCRIPTS_DIR)
    script_path = scripts_dir / f"{request.script_name}.py"
    
    if not script_path.exists():
        raise HTTPException(status_code=404, detail=f"Script '{request.script_name}' not found")
    
    try:
        # Prepare command with parameters as JSON
        cmd = ["python", str(script_path)]
        if request.parameters:
            cmd.extend(["--params", json.dumps(request.parameters)])
        
        # Execute script
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.MAX_SCRIPT_TIMEOUT
        )
        
        return ScriptResponse(
            success=result.returncode == 0,
            output=result.stdout,
            error=result.stderr if result.returncode != 0 else None
        )
    
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Script execution timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing script: {str(e)}")
