"""
Image segmentation API routes using SAM 2
Handles interactive segmentation with point prompts
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
from pathlib import Path
from datetime import datetime
import uuid
import numpy as np
import base64
import logging
from io import BytesIO
from PIL import Image

from backend.database import create_job, create_output
from backend.utils.sam_segmentation import (
    predict_mask_from_points,
    crop_image_with_mask,
    remove_background,
)
from backend.utils.image_processing import ASPECT_RATIOS

logger = logging.getLogger(__name__)

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# Temporary storage for uploaded images during segmentation session
TEMP_DIR = Path(__file__).parent.parent.parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_for_segmentation(
    file: UploadFile = File(..., description="Image file to segment")
):
    """
    Upload an image for segmentation and return a session ID

    **Parameters:**
    - **file**: Image file

    **Returns:** Session ID and image dimensions
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

        # Get image dimensions
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size

        # Generate session ID
        session_id = str(uuid.uuid4())

        # Save to temp directory
        temp_path = TEMP_DIR / f"{session_id}.jpg"
        with open(temp_path, "wb") as f:
            f.write(image_bytes)

        return {
            "success": True,
            "session_id": session_id,
            "width": width,
            "height": height,
            "original_filename": file.filename,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")


@router.post("/predict")
async def predict_segmentation(
    session_id: str = Form(..., description="Session ID from upload"),
    points: Optional[str] = Form(
        None, description="JSON array of [x, y] point coordinates"
    ),
    labels: Optional[str] = Form(
        None, description="JSON array of labels (1=foreground, 0=background)"
    ),
    bboxes: Optional[str] = Form(
        None, description="JSON array [x1, y1, x2, y2] for bounding box"
    ),
    model: str = Form("sam2_b.pt", description="SAM model to use"),
):
    """
    Generate segmentation mask from point prompts or bounding box

    **Parameters:**
    - **session_id**: Session ID from upload
    - **points**: JSON string of [[x1, y1], [x2, y2], ...] coordinates (optional)
    - **labels**: JSON string of [1, 1, 0, ...] labels (optional)
    - **bboxes**: JSON string of [x1, y1, x2, y2] bounding box (optional)
    - **model**: SAM model name (sam2_b.pt, sam2_l.pt, sam2_s.pt, sam2_t.pt)

    **Returns:** Base64-encoded mask image (PNG)
    """
    temp_path = TEMP_DIR / f"{session_id}.jpg"

    if not temp_path.exists():
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        # Parse points and labels
        import json

        # Read image
        with open(temp_path, "rb") as f:
            image_bytes = f.read()

        # Get mask prediction - handle both points and bboxes
        if bboxes:
            # Use bounding box prompt
            bbox_list = json.loads(bboxes)
            from backend.utils.sam_segmentation import predict_mask_from_bboxes

            mask = predict_mask_from_bboxes(
                image_bytes, bboxes=bbox_list, model_name=model
            )
        elif points and labels:
            # Use point prompts
            points_list = json.loads(points)
            labels_list = json.loads(labels)
            mask = predict_mask_from_points(
                image_bytes, points=points_list, labels=labels_list, model_name=model
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Either points/labels or bboxes must be provided",
            )

        # Convert mask to PNG image
        mask_img = Image.fromarray(mask, mode="L")
        buffer = BytesIO()
        mask_img.save(buffer, format="PNG")
        buffer.seek(0)

        # Encode as base64
        mask_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "success": True,
            "mask": mask_base64,
            "width": mask.shape[1],
            "height": mask.shape[0],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error predicting mask: {str(e)}")


@router.post("/crop")
async def crop_to_selection(
    session_id: str = Form(..., description="Session ID from upload"),
    mask: str = Form(..., description="Base64-encoded mask PNG"),
    padding: Optional[float] = Form(10.0, description="Padding percentage"),
    aspect_ratio: Optional[str] = Form(None, description="Target aspect ratio name"),
):
    """
    Crop image to masked selection with padding and aspect ratio

    **Parameters:**
    - **session_id**: Session ID from upload
    - **mask**: Base64-encoded mask image
    - **padding**: Padding as percentage (default: 10%)
    - **aspect_ratio**: Target aspect ratio name from predefined list

    **Returns:** Job metadata with cropped image
    """
    temp_path = TEMP_DIR / f"{session_id}.jpg"

    if not temp_path.exists():
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        # Read original image
        with open(temp_path, "rb") as f:
            image_bytes = f.read()

        # Decode mask from base64
        mask_bytes = base64.b64decode(mask)
        mask_img = Image.open(BytesIO(mask_bytes))
        mask_array = np.array(mask_img)

        # Get target aspect ratio value
        target_ratio = None
        if aspect_ratio and aspect_ratio in ASPECT_RATIOS:
            target_ratio = ASPECT_RATIOS[aspect_ratio]

        # Crop image
        cropped_bytes, info = crop_image_with_mask(
            image_bytes,
            mask_array,
            padding_percent=padding,
            target_aspect_ratio=target_ratio,
        )

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"segmented_{timestamp}_{unique_id}.jpg"
        output_path = OUTPUTS_DIR / output_filename

        # Save to disk
        with open(output_path, "wb") as f:
            f.write(cropped_bytes)

        # Get file size
        output_size = output_path.stat().st_size

        # Get original filename from session
        original_filename = "unknown"
        # Try to get from temp file or session data

        # Create output record
        output_id = create_output(
            filename=output_filename,
            operation_type="segment",
            original_filename=original_filename,
            file_path=str(output_path),
            width=info.get("width"),
            height=info.get("height"),
            pixels=(
                info.get("width", 0) * info.get("height", 0)
                if info.get("width") and info.get("height")
                else None
            ),
            aspect_ratio=aspect_ratio,
        )

        # Clean up temp file
        try:
            if temp_path.exists():
                temp_path.unlink()
                logger.info(f"Deleted temp file: {temp_path}")
            else:
                logger.warning(f"Temp file not found for deletion: {temp_path}")
        except Exception as e:
            logger.error(f"Failed to delete temp file {temp_path}: {str(e)}")

        return {
            "success": True,
            "output_filename": output_filename,
            "info": {
                **info,
                "file_size": output_size,
                "padding_percent": padding,
                "aspect_ratio": aspect_ratio,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cropping image: {str(e)}")


@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str):
    """
    Clean up temporary session file

    **Parameters:**
    - **session_id**: Session ID to clean up

    **Returns:** Success status
    """
    temp_path = TEMP_DIR / f"{session_id}.jpg"

    if temp_path.exists():
        try:
            temp_path.unlink()
            logger.info(f"Cleaned up session: {session_id}")
            return {"success": True, "message": "Session cleaned up"}
        except Exception as e:
            logger.error(f"Failed to cleanup session {session_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Error cleaning up session: {str(e)}"
            )

    return {"success": True, "message": "Session not found or already cleaned"}


@router.post("/remove-background")
async def remove_background_endpoint(
    session_id: str = Form(..., description="Session ID from upload"),
    mask: str = Form(..., description="Base64-encoded mask PNG"),
):
    """
    Remove background from image using the provided mask

    **Parameters:**
    - **session_id**: Session ID from upload
    - **mask**: Base64-encoded mask image (white=keep, black=remove)

    **Returns:** Job metadata with background-removed PNG image
    """
    temp_path = TEMP_DIR / f"{session_id}.jpg"

    if not temp_path.exists():
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        # Read original image
        with open(temp_path, "rb") as f:
            image_bytes = f.read()

        # Decode mask from base64
        mask_bytes = base64.b64decode(mask)
        mask_img = Image.open(BytesIO(mask_bytes))
        mask_array = np.array(mask_img)

        # Remove background using the mask
        result_bytes = remove_background(image_bytes, mask=mask_array)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"no_bg_{timestamp}_{unique_id}.png"
        output_path = OUTPUTS_DIR / output_filename

        # Save to disk
        with open(output_path, "wb") as f:
            f.write(result_bytes)

        # Get file size and dimensions
        output_size = output_path.stat().st_size
        result_img = Image.open(BytesIO(result_bytes))

        # Create output record
        output_id = create_output(
            filename=output_filename,
            operation_type="segment",
            original_filename="unknown",
            file_path=str(output_path),
            width=result_img.width,
            height=result_img.height,
            pixels=result_img.width * result_img.height,
        )

        return {
            "success": True,
            "output_filename": output_filename,
            "info": {
                "width": result_img.width,
                "height": result_img.height,
                "file_size": output_size,
                "format": "PNG",
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error removing background: {str(e)}"
        )
