"""
Generative fill API routes using SDXL models
Handles inpainting with configurable parameters and model selection
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
from pathlib import Path
import uuid
import json
from datetime import datetime
from io import BytesIO
from PIL import Image

from backend.database import create_job, create_output, update_job_status
from backend.utils.generative_fill import (
    detect_sdxl_models,
    perform_generative_fill,
    create_simple_mask_from_polygon,
)
from backend.utils.image_processing import resize_image_bytes

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@router.get("/models")
async def get_available_models():
    """
    Get list of available SDXL models detected in the sdxl directory

    **Returns:** List of model objects with name and path
    """
    try:
        models = detect_sdxl_models()
        if not models:
            return {
                "success": False,
                "models": [],
                "message": "No SDXL models found in sdxl directory",
            }

        return {
            "success": True,
            "models": models,
            "count": len(models),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting models: {str(e)}")


@router.post("/fill")
async def generative_fill(
    file: UploadFile = File(..., description="Image file to fill"),
    mask: UploadFile = File(..., description="Mask file (white = fill, black = keep)"),
    prompt: str = Form(..., description="Prompt describing what to generate"),
    model_name: str = Form(..., description="Name of SDXL model to use"),
    negative_prompt: Optional[str] = Form(
        "", description="What to avoid in the output"
    ),
    num_inference_steps: Optional[int] = Form(
        30, description="Number of denoising steps (20-50)"
    ),
    guidance_scale: Optional[float] = Form(
        7.5, description="How closely to follow the prompt (7-15)"
    ),
    strength: Optional[float] = Form(
        1.0, description="Inpaint strength (0-1, where 1 = full inpaint)"
    ),
    seed: Optional[int] = Form(None, description="Random seed for reproducibility"),
):
    """
    Perform generative fill on an image using SDXL model.
    Fills masked regions with content generated from the prompt.

    **Parameters:**
    - **file**: Original image file
    - **mask**: Mask image (white areas = fill, black areas = preserve)
    - **prompt**: Description of what to generate
    - **model_name**: SDXL model name to use
    - **negative_prompt**: What to avoid (default: "")
    - **num_inference_steps**: Denoising steps, 20-50 recommended (default: 30)
    - **guidance_scale**: Prompt guidance strength, 7-15 recommended (default: 7.5)
    - **strength**: Inpaint strength 0-1 (default: 1.0)
    - **seed**: Random seed for reproducibility (optional)

    **Returns:** Output image and job metadata
    """
    # Validate file types
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image.",
        )

    if not mask.content_type or not mask.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mask type: {mask.content_type}. Must be an image.",
        )

    # Validate parameters
    if num_inference_steps < 20 or num_inference_steps > 50:
        raise HTTPException(
            status_code=400,
            detail="Number of inference steps must be between 20 and 50",
        )

    if guidance_scale < 1 or guidance_scale > 20:
        raise HTTPException(
            status_code=400, detail="Guidance scale must be between 1 and 20"
        )

    if strength < 0 or strength > 1:
        raise HTTPException(status_code=400, detail="Strength must be between 0 and 1")

    try:
        # Check if model exists
        available_models = detect_sdxl_models()
        model_info = next(
            (m for m in available_models if m["name"] == model_name), None
        )

        if not model_info:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model_name}' not found. Available models: {[m['name'] for m in available_models]}",
            )

        # Read uploaded files
        image_bytes = await file.read()
        mask_bytes = await mask.read()

        # Validate images can be opened
        try:
            img = Image.open(BytesIO(image_bytes))
            mask_img = Image.open(BytesIO(mask_bytes))
            width, height = img.size
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

        print(
            f"Performing generative fill: {model_name}, prompt='{prompt}', size={width}x{height}"
        )

        # Perform generative fill
        output_bytes = perform_generative_fill(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
            prompt=prompt,
            model_path=model_info["path"],
            negative_prompt=negative_prompt or "",
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            strength=strength,
            seed=seed,
            device="cuda",  # Use CUDA if available, falls back to CPU
            target_width=width,  # Preserve original dimensions
            target_height=height,
        )

        # Save output
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"fill_{timestamp}_{unique_id}.png"
        output_path = OUTPUTS_DIR / output_filename

        with open(output_path, "wb") as f:
            f.write(output_bytes)

        # Add metadata to the output image
        fill_metadata = {
            "prompt": prompt,
            "negative_prompt": negative_prompt or "",
            "model": model_name,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
            "seed": seed,
            "original_filename": file.filename or "unknown",
        }
        
        from backend.utils.image_processing import add_metadata_to_image
        add_metadata_to_image(str(output_path), fill_metadata, format='png')

        # Get output image dimensions
        output_img = Image.open(BytesIO(output_bytes))
        output_width, output_height = output_img.size
        output_pixels = output_width * output_height

        # Create output record
        output_id = create_output(
            filename=output_filename,
            file_path=str(output_path),
            operation_type="generative_fill",
            original_filename=file.filename or "unknown",
            width=output_width,
            height=output_height,
            pixels=output_pixels,
            metadata=json.dumps(fill_metadata),
        )

        # Create job record (marked as completed immediately since it's synchronous)
        job_id = create_job(
            job_type="generative_fill",
            input_filename=file.filename or "unknown",
            fal_request_id=None,  # Local processing, no Fal request
            job_status="completed",
            metadata=json.dumps(fill_metadata),
        )

        # Update job with output information
        update_job_status(
            job_id=job_id,
            job_status="completed",
            output_filename=output_filename,
            output_width=output_width,
            output_height=output_height,
            output_pixels=output_pixels,
            output_id=output_id,
        )

        print(
            f"Generative fill completed: {output_filename} (job_id: {job_id}, output_id: {output_id})"
        )

        return {
            "success": True,
            "job_id": job_id,
            "output_id": output_id,
            "filename": output_filename,
            "status": "completed",
            "width": output_width,
            "height": output_height,
            "message": "Generative fill completed successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        print(f"Error during generative fill: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(
            status_code=500, detail=f"Error performing generative fill: {str(e)}"
        )
