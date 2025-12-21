"""
Image upscaling API routes using Fal AI
Handles image upscaling with configurable parameters
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from typing import Optional, Literal
from pathlib import Path
from datetime import datetime
import uuid
import asyncio

from backend.database import create_job, update_job_status
from backend.utils.fal_upscale import (
    upload_bytes_to_fal,
    submit_upscale_image,
    download_from_url,
)
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
        job_id = create_job(
            job_type="upscale",
            original_filename=file.filename or "unknown",
            fal_request_id=request_id,
            job_status="pending",
            original_width=width,
            original_height=height,
            original_pixels=total_pixels,
            metadata=f"mode:{upscale_mode},factor:{upscale_factor},resolution:{target_resolution},noise:{noise_scale},format:{output_format}|{downscale_info}|endpoint:{endpoint}",
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


async def poll_fal_job(job_id: int, request_id: str, endpoint: str, job_type: str):
    """
    Background task to poll Fal API for job completion
    Updates database with status changes and downloads result when complete
    """
    import fal_client
    from fal_client.client import Queued, InProgress, Completed

    max_retries = 180  # 15 minutes maximum (180 * 5 seconds)
    retry_count = 0
    poll_interval = 5  # seconds

    try:
        print(f"[Job {job_id}] Starting background polling for {job_type} job")

        while retry_count < max_retries:
            try:
                # Check status with Fal
                status_obj = fal_client.status(endpoint, request_id, with_logs=False)

                print(f"[Job {job_id}] Fal status: {type(status_obj).__name__}")

                # Update database based on status type
                if isinstance(status_obj, Queued):
                    update_job_status(job_id, "queued")
                elif isinstance(status_obj, InProgress):
                    update_job_status(job_id, "processing")
                elif isinstance(status_obj, Completed):
                    # Get the result
                    result = fal_client.result(endpoint, request_id)
                    print(f"[Job {job_id}] Job completed, processing result")

                    # Process and download the result
                    await process_fal_result(job_id, job_type, result)
                    return  # Exit polling loop
                else:
                    # Unknown status or error
                    error_msg = f"Unknown status type: {type(status_obj).__name__}"
                    update_job_status(job_id, "failed", error_message=error_msg)
                    print(f"[Job {job_id}] {error_msg}")
                    return

                # Wait before next poll
                await asyncio.sleep(poll_interval)
                retry_count += 1

            except Exception as e:
                print(f"[Job {job_id}] Error polling Fal: {str(e)}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(poll_interval)
                retry_count += 1

        # Timeout
        update_job_status(
            job_id, "failed", error_message="Job polling timeout after 15 minutes"
        )
        print(f"[Job {job_id}] Polling timeout")

    except Exception as e:
        print(f"[Job {job_id}] Fatal error in polling task: {str(e)}")
        update_job_status(job_id, "failed", error_message=f"Polling error: {str(e)}")


async def process_fal_result(job_id: int, job_type: str, result: dict):
    """
    Process completed Fal job result
    Downloads the image and updates the database
    """
    try:
        # Extract result URL based on job type
        if job_type == "edit":
            if "images" in result and len(result["images"]) > 0:
                result_url = result["images"][0]["url"]
                result_width = result["images"][0].get("width")
                result_height = result["images"][0].get("height")
            else:
                raise Exception("No images in edit result")
        elif job_type == "upscale":
            if "image" in result:
                result_url = result["image"]["url"]
                result_width = result["image"].get("width")
                result_height = result["image"].get("height")
            else:
                raise Exception("No image in upscale result")
        else:
            raise Exception(f"Unknown job type: {job_type}")

        # Generate output filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]

        # Determine extension from result URL
        if result_url.endswith(".png"):
            extension = ".png"
        elif result_url.endswith(".webp"):
            extension = ".webp"
        else:
            extension = ".jpg"

        output_filename = f"{job_type}_{timestamp}_{unique_id}{extension}"
        output_path = OUTPUTS_DIR / output_filename

        print(f"[Job {job_id}] Downloading result to {output_filename}")

        # Download the result
        download_from_url(result_url, str(output_path))

        # Calculate output pixels
        output_pixels = None
        if result_width and result_height:
            output_pixels = result_width * result_height

        # Update job status
        update_job_status(
            job_id,
            "completed",
            output_filename=output_filename,
            output_path=str(output_path),
            output_width=result_width,
            output_height=result_height,
            output_pixels=output_pixels,
        )

        print(f"[Job {job_id}] Completed successfully: {output_filename}")

    except Exception as e:
        print(f"[Job {job_id}] Error processing result: {str(e)}")
        update_job_status(job_id, "failed", error_message=str(e))
