"""
Edit presets API routes
Handles saving, loading, and managing user-defined edit configurations
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel

from backend.database import (
    create_edit_preset,
    get_edit_preset,
    get_all_edit_presets,
    update_edit_preset,
    delete_edit_preset,
)

router = APIRouter()


class EditPresetCreate(BaseModel):
    """Request model for creating a new preset"""
    name: str
    prompt: str
    num_inference_steps: int = 6
    negative_prompt: Optional[str] = None
    enable_safety_checker: bool = True
    output_format: str = "png"
    seed: Optional[int] = None


class EditPresetUpdate(BaseModel):
    """Request model for updating a preset"""
    name: Optional[str] = None
    prompt: Optional[str] = None
    num_inference_steps: Optional[int] = None
    negative_prompt: Optional[str] = None
    enable_safety_checker: Optional[bool] = None
    output_format: Optional[str] = None
    seed: Optional[int] = None


class EditPresetResponse(BaseModel):
    """Response model for a preset"""
    id: int
    name: str
    prompt: str
    num_inference_steps: int
    negative_prompt: Optional[str]
    enable_safety_checker: bool
    output_format: str
    seed: Optional[int]
    created_at: str
    updated_at: str


@router.get("", response_model=List[EditPresetResponse])
async def list_presets():
    """
    Get all edit presets

    **Returns:** List of all saved edit presets ordered by name
    """
    presets = get_all_edit_presets()
    return presets


@router.get("/{preset_id}", response_model=EditPresetResponse)
async def get_preset(preset_id: int):
    """
    Get a specific edit preset by ID

    **Parameters:**
    - **preset_id**: ID of the preset to retrieve

    **Returns:** The preset details
    """
    preset = get_edit_preset(preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset


@router.post("", response_model=EditPresetResponse)
async def create_preset(preset: EditPresetCreate):
    """
    Create a new edit preset

    **Parameters:**
    - **name**: Unique name for the preset
    - **prompt**: The editing prompt
    - **num_inference_steps**: Number of inference steps (1-50)
    - **negative_prompt**: What to avoid in the output (optional)
    - **enable_safety_checker**: Enable NSFW filtering (default: true)
    - **output_format**: Output format - png or jpeg (default: png)
    - **seed**: Random seed for reproducibility (optional)

    **Returns:** The created preset with ID
    """
    try:
        preset_id = create_edit_preset(
            name=preset.name,
            prompt=preset.prompt,
            num_inference_steps=preset.num_inference_steps,
            negative_prompt=preset.negative_prompt,
            enable_safety_checker=preset.enable_safety_checker,
            output_format=preset.output_format,
            seed=preset.seed,
        )
        created_preset = get_edit_preset(preset_id)
        if not created_preset:
            raise HTTPException(status_code=500, detail="Failed to create preset")
        return created_preset
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=400,
                detail=f"A preset with the name '{preset.name}' already exists"
            )
        raise HTTPException(status_code=500, detail=f"Error creating preset: {str(e)}")


@router.put("/{preset_id}", response_model=EditPresetResponse)
async def update_preset(preset_id: int, preset: EditPresetUpdate):
    """
    Update an edit preset

    **Parameters:**
    - **preset_id**: ID of the preset to update
    - **name**: Unique name for the preset (optional)
    - **prompt**: The editing prompt (optional)
    - **num_inference_steps**: Number of inference steps (optional)
    - **negative_prompt**: What to avoid in the output (optional)
    - **enable_safety_checker**: Enable NSFW filtering (optional)
    - **output_format**: Output format (optional)
    - **seed**: Random seed (optional)

    **Returns:** The updated preset
    """
    success = update_edit_preset(
        preset_id=preset_id,
        name=preset.name,
        prompt=preset.prompt,
        num_inference_steps=preset.num_inference_steps,
        negative_prompt=preset.negative_prompt,
        enable_safety_checker=preset.enable_safety_checker,
        output_format=preset.output_format,
        seed=preset.seed,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Preset not found")

    updated_preset = get_edit_preset(preset_id)
    if not updated_preset:
        raise HTTPException(status_code=500, detail="Failed to update preset")
    return updated_preset


@router.delete("/{preset_id}")
async def delete_preset(preset_id: int):
    """
    Delete an edit preset

    **Parameters:**
    - **preset_id**: ID of the preset to delete

    **Returns:** Confirmation message
    """
    success = delete_edit_preset(preset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"success": True, "message": f"Preset {preset_id} deleted successfully"}
