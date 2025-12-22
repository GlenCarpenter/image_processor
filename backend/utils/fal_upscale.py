"""
Fal AI utilities for image upscaling
Provides reusable functions for interacting with Fal AI's upscaling service
"""

import os
from typing import Optional, Literal, Dict, Any, Callable, Tuple
import fal_client
from dotenv import load_dotenv

# Import shared utilities
from backend.utils.fal_utils import (
    upload_file_to_fal,
    download_from_url,
)

# Load environment variables
load_dotenv()

# Configure Fal API key
FAL_KEY = os.getenv("FAL_KEY")
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY


def submit_upscale_image(
    image_url: str,
    upscale_mode: Literal["factor", "target"] = "factor",
    upscale_factor: float = 2.0,
    target_resolution: Literal["720p", "1080p", "1440p", "2160p"] = "1080p",
    noise_scale: float = 0.1,
    output_format: Literal["png", "jpg", "webp"] = "jpg",
    seed: Optional[int] = None,
    webhook_url: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Submit an async upscale job to Fal AI

    Args:
        image_url: URL of the image to upscale (from Fal storage)
        upscale_mode: 'factor' or 'target'
        upscale_factor: Upscaling factor (for 'factor' mode)
        target_resolution: Target resolution (for 'target' mode)
        noise_scale: Noise scale for generation process
        output_format: Output image format
        seed: Optional random seed
        webhook_url: Optional webhook URL for result notification

    Returns:
        Tuple of (request_id, endpoint) for later retrieval
    """
    # Prepare API arguments
    arguments = {
        "image_url": image_url,
        "upscale_mode": upscale_mode,
        "noise_scale": noise_scale,
        "output_format": output_format,
    }

    if upscale_mode == "factor":
        arguments["upscale_factor"] = upscale_factor
    else:
        arguments["target_resolution"] = target_resolution

    if seed is not None:
        arguments["seed"] = seed

    endpoint = "fal-ai/seedvr/upscale/image"

    # Submit the job asynchronously
    handler = fal_client.submit(
        endpoint,
        arguments=arguments,
        webhook_url=webhook_url,
    )

    return handler.request_id, endpoint


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
