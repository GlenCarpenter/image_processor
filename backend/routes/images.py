"""
Image processing API routes
Handles image resizing and manipulation
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from typing import Optional
import io

from backend.utils.image_processing import resize_image_bytes

router = APIRouter()


@router.post("/resize")
async def resize_image(
    file: UploadFile = File(..., description="Image file to resize"),
    target_pixels: Optional[int] = Form(1048576, description="Target pixel count (default: 1024x1024 = 1,048,576)"),
    size: Optional[int] = Form(None, description="Alternative: specify size root (pixels = size²)"),
    quality: Optional[int] = Form(95, description="JPEG quality 1-100"),
):
    """
    Resize an image to match a target pixel count while maintaining aspect ratio.
    
    The image will be resized to the closest matching standard aspect ratio and
    scaled to match the target pixel count.
    
    **Parameters:**
    - **file**: Image file (JPEG, PNG, BMP, WEBP, TIFF)
    - **target_pixels**: Total pixel count (e.g., 1048576 for 1024x1024)
    - **size**: Alternative to target_pixels - specify root size (e.g., 1024 for 1024²)
    - **quality**: JPEG output quality (1-100, default 95)
    
    **Returns:** Resized JPEG image
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be an image."
        )
    
    # Calculate target pixels from size if provided
    if size is not None:
        if size <= 0:
            raise HTTPException(status_code=400, detail="Size must be a positive integer")
        target_pixels = size * size
    
    # Validate target_pixels
    if target_pixels <= 0:
        raise HTTPException(status_code=400, detail="Target pixels must be a positive integer")
    
    if target_pixels > 100_000_000:  # 100 megapixels max
        raise HTTPException(
            status_code=400,
            detail="Target pixels too large (max 100,000,000)"
        )
    
    # Validate quality
    if quality < 1 or quality > 100:
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 100")
    
    try:
        # Read the uploaded file
        image_bytes = await file.read()
        
        # Resize the image
        resized_bytes, info = resize_image_bytes(
            image_bytes,
            target_pixels=target_pixels,
            quality=quality
        )
        
        # Prepare response headers with metadata
        headers = {
            "X-Original-Width": str(info["original_size"]["width"]),
            "X-Original-Height": str(info["original_size"]["height"]),
            "X-Target-Width": str(info["target_size"]["width"]),
            "X-Target-Height": str(info["target_size"]["height"]),
            "X-Aspect-Ratio": info["ratio_name"],
            "X-Original-Pixels": str(info["original_pixels"]),
            "X-Actual-Pixels": str(info["actual_pixels"]),
        }
        
        # Return the resized image
        return StreamingResponse(
            io.BytesIO(resized_bytes),
            media_type="image/jpeg",
            headers=headers
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        )


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
            detail=f"Invalid file type: {file.content_type}. Must be an image."
        )
    
    # Calculate target pixels from size if provided
    if size is not None:
        if size <= 0:
            raise HTTPException(status_code=400, detail="Size must be a positive integer")
        target_pixels = size * size
    
    # Validate target_pixels
    if target_pixels <= 0:
        raise HTTPException(status_code=400, detail="Target pixels must be a positive integer")
    
    try:
        # Read the uploaded file
        image_bytes = await file.read()
        
        # Resize to get info (we'll discard the image)
        _, info = resize_image_bytes(image_bytes, target_pixels=target_pixels)
        
        return {
            "success": True,
            "info": info
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing image: {str(e)}"
        )
