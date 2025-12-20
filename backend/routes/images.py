"""
Image processing API routes
Handles image resizing and manipulation
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List
from pathlib import Path
from datetime import datetime
import uuid
import zipfile
from io import BytesIO

from backend.utils.image_processing import resize_image_bytes, extract_exif_data
from backend.database import create_job, get_job, get_recent_jobs

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# Temporary directory for EXIF extraction
TEMP_DIR = Path(__file__).parent.parent.parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)


@router.post("/upload-temp")
async def upload_temp_for_exif(
    file: UploadFile = File(..., description="Image file to extract EXIF from")
):
    """
    Temporarily upload an image to extract EXIF metadata
    
    **Parameters:**
    - **file**: Image file
    
    **Returns:** EXIF metadata
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image.",
        )
    
    try:
        # Read the uploaded file
        image_bytes = await file.read()
        
        # Generate temporary filename
        temp_id = str(uuid.uuid4())
        temp_path = TEMP_DIR / f"exif_{temp_id}.tmp"
        
        # Save temporarily
        with open(temp_path, "wb") as f:
            f.write(image_bytes)
        
        # Extract EXIF data
        exif_data = extract_exif_data(str(temp_path))
        
        # Delete the temporary file immediately
        temp_path.unlink()
        
        return {
            "success": True,
            "exif": exif_data,
            "has_exif": len(exif_data) > 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting EXIF: {str(e)}")


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

    return FileResponse(
        path=str(file_path),
        media_type="image/jpeg",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@router.get("/output/{filename}/exif")
async def get_image_exif(filename: str):
    """
    Extract and return EXIF metadata from an output image
    
    **Parameters:**
    - **filename**: The output filename from a previous job
    
    **Returns:** EXIF metadata organized by category
    """
    file_path = OUTPUTS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Security check: ensure the file is within outputs directory
    try:
        file_path.resolve().relative_to(OUTPUTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    exif_data = extract_exif_data(str(file_path))
    
    return {
        "success": True,
        "filename": filename,
        "exif": exif_data,
        "has_exif": len(exif_data) > 0
    }


@router.get("/output/{filename}/download")
async def download_output_image(filename: str):
    """
    Download a processed output image by filename (forces download)

    **Parameters:**
    - **filename**: The output filename from a previous job

    **Returns:** The image file with Content-Disposition: attachment
    """
    file_path = OUTPUTS_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    # Security check: ensure the file is within outputs directory
    try:
        file_path.resolve().relative_to(OUTPUTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(file_path),
        media_type="image/jpeg",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


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
async def list_recent_jobs(limit: int = 50, offset: int = 0, job_type: Optional[str] = None):
    """
    List recent jobs, optionally filtered by type

    **Parameters:**
    - **limit**: Maximum number of jobs to return (default: 50, max: 200)
    - **offset**: Number of jobs to skip for pagination (default: 0)
    - **job_type**: Filter by job type (e.g., 'resize')

    **Returns:** List of jobs with pagination info
    """
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 200")
    
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset must be non-negative")

    jobs = get_recent_jobs(limit=limit, offset=offset, job_type=job_type)

    return {
        "success": True, 
        "jobs": jobs, 
        "count": len(jobs),
        "limit": limit,
        "offset": offset,
        "has_more": len(jobs) == limit  # If we got a full page, there might be more
    }


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


@router.post("/batch-download")
async def batch_download_images(filenames: List[str] = Body(..., description="List of filenames to download")):
    """
    Download multiple images as a zip file

    **Parameters:**
    - **filenames**: List of output filenames to include in the zip

    **Returns:** A zip file containing the requested images
    """
    if not filenames:
        raise HTTPException(status_code=400, detail="No filenames provided")
    
    if len(filenames) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files can be downloaded at once")

    # Create zip file in memory
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for filename in filenames:
            file_path = OUTPUTS_DIR / filename
            
            # Security check: ensure the file is within outputs directory
            try:
                file_path.resolve().relative_to(OUTPUTS_DIR.resolve())
            except ValueError:
                # Skip files outside outputs directory
                continue
            
            if file_path.exists():
                # Add file to zip
                zip_file.write(file_path, arcname=filename)
    
    # Check if any files were added
    zip_buffer.seek(0)
    if zip_buffer.getbuffer().nbytes == 0:
        raise HTTPException(status_code=404, detail="No valid files found")
    
    # Generate zip filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"images_{timestamp}.zip"
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    )
