"""
Image upscaling API routes using Fal AI
Handles image upscaling with configurable parameters
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional, Literal
from pathlib import Path
import asyncio

from backend.database import create_job
from backend.utils.fal_upscale import submit_upscale_image
from backend.utils.fal_utils import upload_bytes_to_fal, poll_fal_job
from backend.utils.image_processing import resize_image_bytes
from PIL import Image
from io import BytesIO

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@router.post("/upscale")
async def upscale_image(
    file: UploadFile = File(..., description="Image file to upscale"),
    upscale_mode: Optional[Literal["factor", "target"]] = Form(
        "factor", description="Upscale mode: 'factor' or 'target'"
    ),
    upscale_factor: Optional[float] = Form(
        2.0, description="Upscaling factor (used when mode is 'factor')"
    ),
    target_resolution: Optional[Literal["720p", "1080p", "1440p", "2160p"]] = Form(
        "1080p", description="Target resolution (used when mode is 'target')"
    ),
    noise_scale: Optional[float] = Form(
        0.1, description="Noise scale for generation process"
    ),
    output_format: Optional[Literal["png", "jpg", "webp"]] = Form(
        "jpg", description="Output image format"
    ),
    seed: Optional[int] = Form(
        None, description="Random seed for generation (optional)"
    ),
):
    """
    Upscale an image using Fal AI's upscaling service.
    Saves the output to disk and returns metadata with job ID.

    **Parameters:**
    - **file**: Image file to upscale
    - **upscale_mode**: 'factor' (use upscale_factor) or 'target' (use target_resolution)
    - **upscale_factor**: Multiply dimensions by this factor (default: 2.0)
    - **target_resolution**: Target resolution when mode is 'target' (default: 1080p)
    - **noise_scale**: Noise scale for generation (default: 0.1)
    - **output_format**: Output format - png, jpg, or webp (default: jpg)
    - **seed**: Optional random seed for reproducibility

    **Returns:** Job metadata with ID to retrieve the upscaled image
    """
    # Check if FAL_KEY is configured
    import os

    if not os.getenv("FAL_KEY"):
        raise HTTPException(
            status_code=500,
            detail="FAL_KEY not configured. Please set FAL_KEY environment variable in .env file",
        )

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image.",
        )

    # Validate upscale_factor
    if upscale_factor <= 0 or upscale_factor > 10:
        raise HTTPException(
            status_code=400, detail="Upscale factor must be between 0 and 10"
        )

    # Validate noise_scale
    if noise_scale < 0 or noise_scale > 1:
        raise HTTPException(
            status_code=400, detail="Noise scale must be between 0 and 1"
        )

    try:
        # Read the uploaded file
        image_bytes = await file.read()

        # Check image size and downscale if needed
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size
        total_pixels = width * height

        # Target pixels: 1024x1024 = 1,048,576
        target_pixels = 1024 * 1024

        # If image is larger than target, downscale it first
        if total_pixels > target_pixels:
            # Use resize_image_bytes to downscale
            downscaled_bytes, resize_info = resize_image_bytes(
                image_bytes,
                target_pixels=target_pixels,
                output_format="JPEG",
                quality=95,
            )
            image_bytes = downscaled_bytes

            # Log the downscaling for metadata
            downscale_info = f"Downscaled from {width}x{height} to {resize_info['target_size']['width']}x{resize_info['target_size']['height']} before upscaling"
        else:
            downscale_info = "No downscaling needed"

        # Upload to Fal storage
        image_url = upload_bytes_to_fal(image_bytes, file.filename or "image.jpg")

        # Submit async upscale job to Fal AI
        print(f"Submitting upscale job: mode={upscale_mode}, factor={upscale_factor}")
        request_id, endpoint = submit_upscale_image(
            image_url=image_url,
            upscale_mode=upscale_mode,
            upscale_factor=upscale_factor,
            target_resolution=target_resolution,
            noise_scale=noise_scale,
            output_format=output_format,
            seed=seed,
            webhook_url=None,  # Not supported for local apps
        )
        print(f"Upscale job submitted: request_id={request_id}, endpoint={endpoint}")

        # Create database record with pending status
        import json

        metadata = json.dumps(
            {
                "upscale_mode": upscale_mode,
                "upscale_factor": upscale_factor,
                "target_resolution": target_resolution,
                "noise_scale": noise_scale,
                "output_format": output_format,
                "downscale_info": downscale_info,
            }
        )
        job_id = create_job(
            job_type="upscale",
            input_filename=file.filename or "unknown",
            fal_request_id=request_id,
            job_status="pending",
            metadata=metadata,
        )

        # Start background polling task
        asyncio.create_task(poll_fal_job(job_id, request_id, endpoint, "upscale"))
        print(f"Started background polling for job {job_id}")

        # Return job metadata
        return {
            "success": True,
            "job_id": job_id,
            "request_id": request_id,
            "status": "pending",
            "message": "Image upscale job submitted successfully. Use /api/jobs/{job_id}/poll to check status.",
            "info": {
                "upscale_mode": upscale_mode,
                "upscale_factor": upscale_factor,
                "target_resolution": target_resolution,
                "output_format": output_format,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        print(f"Error upscaling image: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error upscaling image: {str(e)}")
