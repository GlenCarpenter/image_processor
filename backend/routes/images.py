"""
Image processing API routes
Handles image resizing and manipulation
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path
from datetime import datetime
import uuid

from backend.utils.image_processing import resize_image_bytes
from backend.database import create_job, get_job, get_recent_jobs

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@router.post("/resize")
async def resize_image(
    file: UploadFile = File(..., description="Image file to resize"),
    target_pixels: Optional[int] = Form(
        1048576, description="Target pixel count (default: 1024x1024 = 1,048,576)"
    ),
    size: Optional[int] = Form(
        None, description="Alternative: specify size root (pixels = size²)"
    ),
    quality: Optional[int] = Form(95, description="JPEG quality 1-100"),
):
    """
    Resize an image to match a target pixel count while maintaining aspect ratio.
    Saves the output to disk and returns metadata with job ID.

    The image will be resized to the closest matching standard aspect ratio and
    scaled to match the target pixel count.

    **Parameters:**
    - **file**: Image file (JPEG, PNG, BMP, WEBP, TIFF)
    - **target_pixels**: Total pixel count (e.g., 1048576 for 1024x1024)
    - **size**: Alternative to target_pixels - specify root size (e.g., 1024 for 1024²)
    - **quality**: JPEG output quality (1-100, default 95)

    **Returns:** Job metadata with ID to retrieve the image
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image.",
        )

    # Calculate target pixels from size if provided
    if size is not None:
        if size <= 0:
            raise HTTPException(
                status_code=400, detail="Size must be a positive integer"
            )
        target_pixels = size * size

    # Validate target_pixels
    if target_pixels <= 0:
        raise HTTPException(
            status_code=400, detail="Target pixels must be a positive integer"
        )

    if target_pixels > 100_000_000:  # 100 megapixels max
        raise HTTPException(
            status_code=400, detail="Target pixels too large (max 100,000,000)"
        )

    # Validate quality
    if quality < 1 or quality > 100:
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 100")

    try:
        # Read the uploaded file
        image_bytes = await file.read()

        # Resize the image
        resized_bytes, info = resize_image_bytes(
            image_bytes, target_pixels=target_pixels, quality=quality
        )

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        original_name = Path(file.filename).stem if file.filename else "image"
        output_filename = f"resized_{original_name}_{timestamp}_{unique_id}.jpg"
        output_path = OUTPUTS_DIR / output_filename

        # Save to disk
        with open(output_path, "wb") as f:
            f.write(resized_bytes)

        # Create database record
        job_id = create_job(
            job_type="resize",
            original_filename=file.filename or "unknown",
            output_filename=output_filename,
            output_path=str(output_path),
            original_width=info["original_size"]["width"],
            original_height=info["original_size"]["height"],
            original_pixels=info["original_pixels"],
            output_width=info["target_size"]["width"],
            output_height=info["target_size"]["height"],
            output_pixels=info["actual_pixels"],
            aspect_ratio=info["ratio_name"],
            quality=quality,
            target_pixels=target_pixels,
        )

        # Return job metadata
        return {
            "success": True,
            "job_id": job_id,
            "output_filename": output_filename,
            "info": info,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@router.post("/resize-info")
async def get_resize_info(
    file: UploadFile = File(..., description="Image file to analyze"),
    target_pixels: Optional[int] = Form(1048576, description="Target pixel count"),
    size: Optional[int] = Form(None, description="Alternative: specify size root"),
):
    """
    Get information about how an image would be resized without actually resizing it.

    Useful for previewing resize operations before committing.

    **Returns:** JSON with resize information
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image.",
        )

    # Calculate target pixels from size if provided
    if size is not None:
        if size <= 0:
            raise HTTPException(
                status_code=400, detail="Size must be a positive integer"
            )
        target_pixels = size * size

    # Validate target_pixels
    if target_pixels <= 0:
        raise HTTPException(
            status_code=400, detail="Target pixels must be a positive integer"
        )

    try:
        # Read the uploaded file
        image_bytes = await file.read()

        # Resize to get info (we'll discard the image)
        _, info = resize_image_bytes(image_bytes, target_pixels=target_pixels)

        return {"success": True, "info": info}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")


@router.get("/output/{filename}")
async def get_output_image(filename: str):
    """
    Serve a processed output image by filename

    **Parameters:**
    - **filename**: The output filename from a previous job

    **Returns:** The image file
    """
    file_path = OUTPUTS_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    # Security check: ensure the file is within outputs directory
    try:
        file_path.resolve().relative_to(OUTPUTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(path=str(file_path), media_type="image/jpeg")


@router.get("/job/{job_id}")
async def get_job_info(job_id: int):
    """
    Get information about a specific job

    **Parameters:**
    - **job_id**: The job ID

    **Returns:** Job metadata
    """
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"success": True, "job": job}


@router.get("/jobs")
async def list_recent_jobs(limit: int = 50, job_type: Optional[str] = None):
    """
    List recent jobs, optionally filtered by type

    **Parameters:**
    - **limit**: Maximum number of jobs to return (default: 50)
    - **job_type**: Filter by job type (e.g., 'resize')

    **Returns:** List of jobs
    """
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 200")

    jobs = get_recent_jobs(limit=limit, job_type=job_type)

    return {"success": True, "jobs": jobs, "count": len(jobs)}


@router.delete("/job/{job_id}")
async def delete_job_endpoint(job_id: int):
    """
    Delete a job and its associated output file
    
    **Parameters:**
    - **job_id**: The job ID to delete
    
    **Returns:** Success status
    """
    from backend.database import delete_job
    
    # Get job info before deleting to find the file
    job = get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete the output file if it exists
    output_path = Path(job["output_path"])
    if output_path.exists():
        try:
            output_path.unlink()
        except Exception as e:
            # Log error but continue with database deletion
            print(f"Warning: Could not delete file {output_path}: {e}")
    
    # Delete from database
    deleted = delete_job(job_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"success": True, "message": "Job and file deleted successfully"}

