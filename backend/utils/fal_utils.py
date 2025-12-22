"""
Shared Fal AI utilities
Provides common functions for interacting with Fal AI services (upscaling, editing, etc.)
"""

import os
import tempfile
import asyncio
from pathlib import Path
from datetime import datetime
import uuid
import fal_client
from fal_client.client import Queued, InProgress, Completed
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Fal API key
FAL_KEY = os.getenv("FAL_KEY")
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY


def upload_file_to_fal(file_path: str) -> str:
    """
    Upload a file from disk to Fal storage and return the URL

    Args:
        file_path: Path to the file to upload

    Returns:
        URL of the uploaded file in Fal storage
    """
    with open(file_path, "rb") as f:
        url = fal_client.upload_file(f)
    return url


def upload_bytes_to_fal(file_bytes: bytes, filename: str) -> str:
    """
    Upload image bytes to Fal storage and return the URL
    Uses a temporary file for the upload

    Args:
        file_bytes: Image data as bytes
        filename: Original filename (used for extension detection)

    Returns:
        URL of the uploaded file in Fal storage
    """
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix)
    tmp_path = tmp_file.name

    try:
        tmp_file.write(file_bytes)
        tmp_file.flush()
        tmp_file.close()  # Explicitly close before uploading

        # Pass the file path as string, not file handle
        url = fal_client.upload_file(tmp_path)
        return url
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except PermissionError:
            # On Windows, sometimes there's a delay before file can be deleted
            import time

            time.sleep(0.1)
            try:
                os.unlink(tmp_path)
            except Exception:
                pass  # Ignore if still can't delete, OS will clean up eventually


def download_from_url(url: str, output_path: str) -> None:
    """
    Download a file from URL to local path

    Args:
        url: URL to download from
        output_path: Local path to save the file
    """
    response = requests.get(url, stream=True)
    response.raise_for_status()

    with open(output_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)


async def poll_fal_job(job_id: int, request_id: str, endpoint: str, job_type: str):
    """
    Background task to poll Fal API for job completion
    Updates database with status changes and downloads result when complete

    Args:
        job_id: Database job ID
        request_id: Fal request ID
        endpoint: Fal API endpoint
        job_type: Type of job ('upscale', 'edit', etc.)
    """
    from backend.database import update_job_status

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

    Args:
        job_id: Database job ID
        job_type: Type of job ('upscale', 'edit', etc.)
        result: Result dictionary from Fal API
    """
    from backend.database import get_job, create_output, update_job_status

    # Output directory for processed images
    OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
    OUTPUTS_DIR.mkdir(exist_ok=True)

    try:
        # Get job details to retrieve original filename
        job = get_job(job_id)
        if not job:
            raise Exception(f"Job {job_id} not found in database")

        original_filename = job.get("input_filename", "unknown")

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

        # Create output record in image_outputs table
        output_id = create_output(
            filename=output_filename,
            file_path=str(output_path),
            operation_type=job_type,
            original_filename=original_filename,
            width=result_width,
            height=result_height,
            pixels=output_pixels,
            metadata=job.get("metadata"),  # Preserve original metadata
        )

        # Update job status with output_id link
        update_job_status(
            job_id,
            "completed",
            output_filename=output_filename,
            output_width=result_width,
            output_height=result_height,
            output_pixels=output_pixels,
            output_id=output_id,
        )

        print(
            f"[Job {job_id}] Completed successfully: {output_filename} (output_id: {output_id})"
        )

    except Exception as e:
        print(f"[Job {job_id}] Error processing result: {str(e)}")
        update_job_status(job_id, "failed", error_message=str(e))
