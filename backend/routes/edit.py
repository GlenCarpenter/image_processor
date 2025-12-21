"""
Image editing API routes using Fal AI Qwen
Handles image editing with configurable parameters
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional, Literal
from pathlib import Path
from datetime import datetime
import uuid

from backend.database import create_job
from backend.utils.fal_upscale import upload_bytes_to_fal, download_from_url
from backend.utils.fal_edit import edit_image_with_fal
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
        "Remove all text from the image",
        description="Editing instruction for the AI"
    ),
    guidance_scale: Optional[float] = Form(
        1.0, description="How closely to follow the prompt (0.0-20.0)"
    ),
    num_inference_steps: Optional[int] = Form(
        6, description="Number of denoising steps (1-50)"
    ),
    acceleration: Optional[Literal["regular", "fast"]] = Form(
        "regular", description="Generation speed mode"
    ),
    negative_prompt: Optional[str] = Form(
        " ", description="What to avoid in the output"
    ),
    enable_safety_checker: Optional[bool] = Form(
        False, description="Enable NSFW content filtering"
    ),
    output_format: Optional[Literal["png", "jpg", "webp"]] = Form(
        "png", description="Output image format"
    ),
    lora_scale: Optional[float] = Form(
        1.0, description="LoRA strength (0.0-1.0)"
    ),
):
    """
    Edit an image using Fal AI's Qwen image editing service.
    Saves the output to disk and returns metadata with job ID.

    **Parameters:**
    - **file**: Image file to edit
    - **prompt**: Editing instruction (e.g., "Remove all text from the image")
    - **guidance_scale**: How closely to follow the prompt (default: 1.0)
    - **num_inference_steps**: Number of denoising steps (default: 6)
    - **acceleration**: 'regular' or 'fast' generation speed (default: 'regular')
    - **negative_prompt**: What to avoid in the output (default: " ")
    - **enable_safety_checker**: Enable NSFW filtering (default: False)
    - **output_format**: Output format - png, jpg, or webp (default: png)
    - **lora_scale**: LoRA strength 0.0-1.0 (default: 1.0)

    **Returns:** Job metadata with ID to retrieve the edited image
    """
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

    # Validate lora_scale
    if lora_scale < 0 or lora_scale > 1:
        raise HTTPException(
            status_code=400, detail="LoRA scale must be between 0 and 1"
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
                image_bytes, target_size=1024
            )
            print(
                f"Downscaled image from {width}x{height} to {resize_info['target_width']}x{resize_info['target_height']}"
            )
            # Use the downscaled version
            image_bytes = downscaled_bytes

        # Upload to Fal storage
        print(f"Uploading image to Fal storage...")
        image_url = upload_bytes_to_fal(image_bytes, file.filename)
        print(f"Image uploaded: {image_url}")

        # Call Fal AI edit service
        print(
            f"Calling Fal AI edit service with prompt: '{prompt}' (guidance: {guidance_scale}, steps: {num_inference_steps})"
        )
        result = edit_image_with_fal(
            image_url=image_url,
            prompt=prompt,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            acceleration=acceleration,
            negative_prompt=negative_prompt,
            enable_safety_checker=enable_safety_checker,
            output_format=output_format,
            num_images=1,
            lora_scale=lora_scale,
            with_logs=True,
        )

        # Get the result image URL
        result_image_url = result["images"][0]["url"]
        print(f"Edit completed, result URL: {result_image_url}")

        # Generate output filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"edited_{timestamp}_{uuid.uuid4().hex[:8]}.{output_format}"
        output_path = OUTPUTS_DIR / output_filename

        # Download the result
        print(f"Downloading result to {output_path}")
        download_from_url(result_image_url, str(output_path))

        # Get output image dimensions
        output_img = Image.open(output_path)
        output_width, output_height = output_img.size

        # Create a database job record
        job_id = create_job(
            job_type="edit",
            original_filename=file.filename or "unknown",
            output_filename=output_filename,
            output_path=str(output_path),
            output_width=output_width,
            output_height=output_height,
            output_pixels=output_width * output_height,
            metadata=f"prompt:{prompt},guidance:{guidance_scale},steps:{num_inference_steps},acceleration:{acceleration},format:{output_format}",
        )
        print(f"Job created with ID: {job_id}")

        return {
            "success": True,
            "job_id": job_id,
            "output_filename": output_filename,
            "output_width": output_width,
            "output_height": output_height,
            "message": "Image edited successfully",
        }

    except Exception as e:
        print(f"Error during image editing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error editing image: {str(e)}")
