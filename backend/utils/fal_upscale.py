"""
Fal AI utilities for image upscaling
Provides reusable functions for interacting with Fal AI's upscaling service
"""

import os
import tempfile
from pathlib import Path
from typing import Optional, Literal, Dict, Any, Callable
import fal_client
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
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=Path(filename).suffix
    ) as tmp_file:
        tmp_file.write(file_bytes)
        tmp_file.flush()

        try:
            with open(tmp_file.name, "rb") as f:
                url = fal_client.upload_file(f)
            return url
        finally:
            # Clean up temp file
            os.unlink(tmp_file.name)


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


def upscale_image_with_fal(
    image_url: str,
    upscale_mode: Literal["factor", "target"] = "factor",
    upscale_factor: float = 2.0,
    target_resolution: Literal["720p", "1080p", "1440p", "2160p"] = "1080p",
    noise_scale: float = 0.1,
    output_format: Literal["png", "jpg", "webp"] = "jpg",
    seed: Optional[int] = None,
    with_logs: bool = False,
    on_queue_update: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Call Fal AI upscale API with the given parameters

    Args:
        image_url: URL of the image to upscale (from Fal storage)
        upscale_mode: 'factor' or 'target'
        upscale_factor: Multiplier for dimensions (used when mode is 'factor')
        target_resolution: Target resolution (used when mode is 'target')
        noise_scale: Noise scale for generation process (0-1)
        output_format: Output image format
        seed: Optional random seed for reproducibility
        with_logs: Whether to include logs in the response
        on_queue_update: Optional callback for queue updates

    Returns:
        Dictionary containing the result from Fal AI, including image URL and dimensions

    Raises:
        Exception: If the API call fails or returns no image URL
    """
    # Prepare API arguments
    arguments = {
        "image_url": image_url,
        "upscale_mode": upscale_mode,
        "upscale_factor": upscale_factor,
        "target_resolution": target_resolution,
        "noise_scale": noise_scale,
        "output_format": output_format,
    }

    # Add seed if provided
    if seed is not None:
        arguments["seed"] = seed

    # Call the Fal AI upscale API
    result = fal_client.subscribe(
        "fal-ai/seedvr/upscale/image",
        arguments=arguments,
        with_logs=with_logs,
        on_queue_update=on_queue_update,
    )

    # Validate result
    if not result or "image" not in result or "url" not in result["image"]:
        raise Exception("No image URL in Fal AI response")

    return result


def upscale_image_end_to_end(
    input_path: str,
    output_path: str,
    upscale_mode: Literal["factor", "target"] = "factor",
    upscale_factor: float = 2.0,
    target_resolution: Literal["720p", "1080p", "1440p", "2160p"] = "1080p",
    noise_scale: float = 0.1,
    output_format: Literal["png", "jpg", "webp"] = "jpg",
    seed: Optional[int] = None,
    with_logs: bool = False,
    on_queue_update: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Complete upscaling pipeline: upload -> upscale -> download

    Args:
        input_path: Path to input image file
        output_path: Path where upscaled image will be saved
        upscale_mode: 'factor' or 'target'
        upscale_factor: Multiplier for dimensions
        target_resolution: Target resolution
        noise_scale: Noise scale (0-1)
        output_format: Output format
        seed: Optional random seed
        with_logs: Whether to show logs
        on_queue_update: Optional callback for progress updates

    Returns:
        Dictionary with result information including dimensions
    """
    # Upload the input image
    image_url = upload_file_to_fal(input_path)

    # Upscale the image
    result = upscale_image_with_fal(
        image_url=image_url,
        upscale_mode=upscale_mode,
        upscale_factor=upscale_factor,
        target_resolution=target_resolution,
        noise_scale=noise_scale,
        output_format=output_format,
        seed=seed,
        with_logs=with_logs,
        on_queue_update=on_queue_update,
    )

    # Download the result
    result_url = result["image"]["url"]
    download_from_url(result_url, output_path)

    return result
