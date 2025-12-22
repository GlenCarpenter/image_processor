"""
Job management API routes
Handles async job status, polling, and webhooks
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import uuid
import fal_client

from backend.database import (
    get_job,
    get_job_by_request_id,
    update_job_status,
    get_active_jobs,
    get_all_jobs,
    clear_all_jobs,
)
from backend.utils.fal_utils import download_from_url

router = APIRouter()

# Output directory for processed images
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@router.get("")
async def list_jobs(
    limit: int = 50,
    offset: int = 0,
    job_type: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    Get list of async jobs with optional filtering

    **Parameters:**
    - **limit**: Maximum number of jobs to return (default: 50)
    - **offset**: Pagination offset (default: 0)
    - **job_type**: Filter by job type (upscale, edit)
    - **status**: Filter by status (pending, processing, completed, failed)

    **Returns:** List of async jobs from image_jobs table
    """
    jobs = get_all_jobs(limit=limit, offset=offset, job_type=job_type)

    # Apply status filter if provided
    if status:
        jobs = [job for job in jobs if job.get("job_status") == status]

    return {
        "success": True,
        "jobs": jobs,
        "count": len(jobs),
    }


@router.get("/active")
async def list_active_jobs():
    """
    Get all active (pending, processing, queued) jobs

    **Returns:** List of active jobs
    """
    jobs = get_active_jobs()

    return {
        "success": True,
        "jobs": jobs,
        "count": len(jobs),
    }


@router.get("/{job_id}")
async def get_job_status(job_id: int):
    """
    Get detailed job status by ID

    **Parameters:**
    - **job_id**: Job ID

    **Returns:** Job details
    """
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return {
        "success": True,
        "job": job,
    }


@router.post("/{job_id}/poll")
async def poll_job_status(job_id: int, background_tasks: BackgroundTasks):
    """
    Poll Fal API for job status and update database if completed

    **Parameters:**
    - **job_id**: Job ID

    **Returns:** Updated job status
    """
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # If job is already completed or failed, return current status
    if job["job_status"] in ["completed", "failed"]:
        return {
            "success": True,
            "job": job,
            "message": f"Job already {job['job_status']}",
        }

    # Get fal request_id
    fal_request_id = job.get("fal_request_id")
    if not fal_request_id:
        raise HTTPException(
            status_code=400,
            detail="Job does not have a Fal request ID (might be a synchronous job)",
        )

    # Extract endpoint from metadata (we'll need to store this)
    # For now, determine based on job_type
    job_type = job["job_type"]
    if job_type == "edit":
        endpoint = "fal-ai/qwen-image-edit-plus"
    elif job_type == "upscale":
        endpoint = "fal-ai/seedvr/upscale/image"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown job type: {job_type}",
        )

    try:
        # Check status with Fal
        status = fal_client.status(endpoint, fal_request_id, with_logs=False)

        # Update job status based on Fal status
        if hasattr(status, "status"):
            fal_status = status.status
        else:
            fal_status = "Unknown"

        # Map Fal status to our status
        if fal_status == "Completed":
            # Get the result
            result = fal_client.result(endpoint, fal_request_id)

            # Process the result in background
            background_tasks.add_task(
                process_completed_job,
                job_id,
                job_type,
                result,
            )

            update_job_status(job_id, "processing")
            job["job_status"] = "processing"

            return {
                "success": True,
                "job": job,
                "message": "Job completed, processing result...",
                "fal_status": fal_status,
            }
        elif fal_status == "InProgress":
            update_job_status(job_id, "processing")
            job["job_status"] = "processing"
        elif fal_status == "Queued":
            update_job_status(job_id, "queued")
            job["job_status"] = "queued"
        else:
            # Unknown status, keep as pending
            pass

        return {
            "success": True,
            "job": job,
            "fal_status": fal_status,
        }

    except Exception as e:
        print(f"Error polling job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error polling job status: {str(e)}",
        )


@router.post("/webhooks/fal")
async def fal_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook endpoint for Fal AI completion notifications

    **Body:** Fal AI webhook payload

    **Returns:** Success acknowledgment
    """
    try:
        payload = await request.json()

        # Extract request_id from payload
        request_id = payload.get("request_id")
        if not request_id:
            raise HTTPException(
                status_code=400, detail="Missing request_id in webhook payload"
            )

        # Find job by request_id
        job = get_job_by_request_id(request_id)
        if not job:
            print(f"Warning: Received webhook for unknown request_id: {request_id}")
            return {"success": True, "message": "Job not found, ignoring"}

        # Get status from payload
        status = payload.get("status", "unknown")

        if status == "COMPLETED":
            # Process the completed job
            result = payload.get("result")
            if result:
                background_tasks.add_task(
                    process_completed_job,
                    job["id"],
                    job["job_type"],
                    result,
                )
        elif status == "FAILED":
            error_msg = payload.get("error", "Unknown error")
            update_job_status(job["id"], "failed", error_message=error_msg)

        return {"success": True, "message": "Webhook processed"}

    except Exception as e:
        print(f"Error processing webhook: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing webhook: {str(e)}"
        )


@router.delete("")
async def clear_jobs():
    """
    Clear all job records (does not delete output files)

    **Returns:** Number of jobs cleared
    """
    count = clear_all_jobs()
    return {
        "success": True,
        "message": f"Cleared {count} jobs",
        "count": count,
    }


async def process_completed_job(job_id: int, job_type: str, result: Dict[str, Any]):
    """
    Background task to process completed Fal job result
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

        print(f"Job {job_id} completed successfully: {output_filename}")

    except Exception as e:
        print(f"Error processing completed job {job_id}: {str(e)}")
        update_job_status(job_id, "failed", error_message=str(e))
