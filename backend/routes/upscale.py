"""
Image upscaling API routes using Fal AI
Handles image upscaling with configurable parameters
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional, Literal
from pathlib import Path
from datetime import datetime
import uuid

from backend.database import create_job
from backend.utils.fal_upscale import (
    upload_bytes_to_fal,
    upscale_image_with_fal,
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

        # Call Fal AI upscale API
        result = upscale_image_with_fal(
            image_url=image_url,
            upscale_mode=upscale_mode,
            upscale_factor=upscale_factor,
            target_resolution=target_resolution,
            noise_scale=noise_scale,
            output_format=output_format,
            seed=seed,
            with_logs=False,
        )

        # Get result image info
        result_image = result["image"]
        result_url = result_image["url"]
        result_width = result_image.get("width")
        result_height = result_image.get("height")

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        original_name = Path(file.filename).stem if file.filename else "image"

        # Use the requested output format for extension
        ext_map = {"jpg": ".jpg", "png": ".png", "webp": ".webp"}
        extension = ext_map.get(output_format, ".jpg")

        output_filename = f"upscaled_{original_name}_{timestamp}_{unique_id}{extension}"
        output_path = OUTPUTS_DIR / output_filename

        # Download the upscaled image
        download_from_url(result_url, str(output_path))

        # Get file size
        output_size = output_path.stat().st_size

        # Create database record
        job_id = create_job(
            job_type="upscale",
            original_filename=file.filename or "unknown",
            output_filename=output_filename,
            output_path=str(output_path),
            output_width=result_width,
            output_height=result_height,
            output_pixels=(
                result_width * result_height if result_width and result_height else None
            ),
            metadata=f"mode:{upscale_mode},factor:{upscale_factor},resolution:{target_resolution},noise:{noise_scale},format:{output_format}|{downscale_info}",
        )

        # Return job metadata
        return {
            "success": True,
            "job_id": job_id,
            "output_filename": output_filename,
            "info": {
                "output_width": result_width,
                "output_height": result_height,
                "output_pixels": (
                    result_width * result_height
                    if result_width and result_height
                    else None
                ),
                "file_size": output_size,
                "upscale_mode": upscale_mode,
                "upscale_factor": upscale_factor,
                "target_resolution": target_resolution,
                "output_format": output_format,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error upscaling image: {str(e)}")
