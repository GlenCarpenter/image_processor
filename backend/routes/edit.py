"""
Image editing API routes using Fal AI Qwen
Handles image editing with configurable parameters
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional, Literal
from pathlib import Path
import asyncio

from backend.database import create_job
from backend.utils.fal_utils import upload_bytes_to_fal, poll_fal_job
from backend.utils.fal_edit import submit_edit_image
from backend.utils.image_processing import resize_image_bytes
from PIL import Image
from io import BytesIO

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@router.post("/edit")
async def edit_image(
    file: UploadFile = File(..., description="Image file to edit"),
    prompt: str = Form(
        "Remove all text from the image", description="Editing instruction for the AI"
    ),
    guidance_scale: Optional[float] = Form(
        4.0, description="How closely to follow the prompt (0.0-20.0)"
    ),
    num_inference_steps: Optional[int] = Form(
        50, description="Number of denoising steps (1-50)"
    ),
    acceleration: Optional[Literal["none", "regular"]] = Form(
        "regular", description="Generation speed mode"
    ),
    negative_prompt: Optional[str] = Form(
        " ", description="What to avoid in the output"
    ),
    enable_safety_checker: Optional[bool] = Form(
        True, description="Enable NSFW content filtering"
    ),
    output_format: Optional[Literal["png", "jpeg"]] = Form(
        "png", description="Output image format"
    ),
    seed: Optional[int] = Form(None, description="Random seed for reproducibility"),
):
    """
    Edit an image using Fal AI's Qwen image editing service.
    Saves the output to disk and returns metadata with job ID.

    **Parameters:**
    - **file**: Image file to edit
    - **prompt**: Editing instruction (e.g., "Remove all text from the image")
    - **guidance_scale**: How closely to follow the prompt (0.0-20.0, default: 4.0)
    - **num_inference_steps**: Number of denoising steps (1-50, default: 50)
    - **acceleration**: 'none' or 'regular' generation speed (default: 'regular')
    - **negative_prompt**: What to avoid in the output (default: " ")
    - **enable_safety_checker**: Enable NSFW filtering (default: True)
    - **output_format**: Output format - png or jpeg (default: png)
    - **seed**: Random seed for reproducibility (optional)

    **Returns:** Job metadata with ID to retrieve the edited image
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

    # Validate guidance_scale
    if guidance_scale < 0 or guidance_scale > 20:
        raise HTTPException(
            status_code=400, detail="Guidance scale must be between 0 and 20"
        )

    # Validate num_inference_steps
    if num_inference_steps < 1 or num_inference_steps > 50:
        raise HTTPException(
            status_code=400, detail="Number of inference steps must be between 1 and 50"
        )

    try:
        # Read the uploaded file
        image_bytes = await file.read()

        # Check image size and get dimensions
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size
        total_pixels = width * height

        # Store original dimensions for custom image_size parameter
        output_width = width
        output_height = height

        # Target pixels: 1024x1024 = 1,048,576
        target_pixels = 1024 * 1024

        # If image is larger than target, downscale it first
        if total_pixels > target_pixels:
            # Use resize_image_bytes to downscale
            downscaled_bytes, resize_info = resize_image_bytes(
                image_bytes, target_pixels=target_pixels
            )
            output_width = resize_info["target_size"]["width"]
            output_height = resize_info["target_size"]["height"]
            print(
                f"Downscaled image from {width}x{height} to {output_width}x{output_height}"
            )
            # Use the downscaled version
            image_bytes = downscaled_bytes

        # Upload to Fal storage
        print(f"Uploading image to Fal storage...")
        image_url = upload_bytes_to_fal(image_bytes, file.filename)
        print(f"Image uploaded: {image_url}")

        # Submit async job to Fal AI with custom image size matching source
        print(
            f"Submitting Fal AI edit job with prompt: '{prompt}' (guidance: {guidance_scale}, steps: {num_inference_steps}, size: {output_width}x{output_height})"
        )
        request_id, endpoint = submit_edit_image(
            image_url=image_url,
            prompt=prompt,
            image_width=output_width,
            image_height=output_height,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            acceleration=acceleration,
            negative_prompt=negative_prompt,
            enable_safety_checker=enable_safety_checker,
            output_format=output_format,
            num_images=1,
            seed=seed,
            webhook_url=None,  # Not supported for local apps
        )
        print(f"Job submitted with request_id: {request_id}")

        # Create database job record with pending status
        job_id = create_job(
            job_type="edit",
            input_filename=file.filename or "unknown",
            fal_request_id=request_id,
            job_status="pending",
        )
        print(f"Job created with ID: {job_id}")

        # Start background polling
        asyncio.create_task(poll_fal_job(job_id, request_id, endpoint, "edit"))
        print(f"Started background polling for job {job_id}")

        return {
            "success": True,
            "job_id": job_id,
            "request_id": request_id,
            "status": "pending",
            "message": "Image edit job submitted successfully. Use /api/jobs/{job_id}/poll to check status.",
        }

    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        print(f"Error during image editing: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error editing image: {str(e)}")
