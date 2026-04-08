"""
Fal AI utilities for Nano Banana Pro image editing
Provides reusable functions for interacting with Fal AI's Nano Banana Pro Edit service
"""

import os
from typing import Optional, Literal, Dict, Any, Tuple, List
import fal_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Fal API key
FAL_KEY = os.getenv("FAL_KEY")
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY


def submit_nano_banana_edit(
    image_urls: List[str],
    prompt: str,
    num_images: int = 1,
    seed: Optional[int] = None,
    aspect_ratio: Optional[str] = "auto",
    resolution: Literal["1K", "2K", "4K"] = "1K",
    output_format: Literal["jpeg", "png", "webp"] = "png",
    safety_tolerance: Literal["1", "2", "3", "4", "5", "6"] = "4",
    sync_mode: bool = False,
    enable_web_search: bool = False,
    limit_generations: bool = False,
    webhook_url: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Submit an async Nano Banana Pro image edit job to Fal AI

    Args:
        image_urls: List of image URLs to edit (1-4 images from Fal storage)
        prompt: The prompt for image editing
        num_images: Number of images to generate (1-4, default: 1)
        seed: Random seed for reproducibility (optional)
        aspect_ratio: Aspect ratio of the generated image (default: "auto")
                     Options: "auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"
        resolution: Resolution of the image ("1K", "2K", or "4K", default: "1K")
        output_format: Output image format ('jpeg', 'png', or 'webp', default: 'png')
        safety_tolerance: Safety tolerance level (1-6, default: "4")
                         1 is most strict, 6 is least strict
        sync_mode: If True, media will be returned as data URI (default: False)
        enable_web_search: Enable web search for latest information (default: False)
        limit_generations: Limit generations from each round to 1 (default: False)
        webhook_url: Optional webhook URL for result notification

    Returns:
        Tuple of (request_id, endpoint) for later retrieval
    """
    # Prepare API arguments
    arguments = {
        "image_urls": image_urls,
        "prompt": prompt,
        "num_images": num_images,
        "resolution": resolution,
        "output_format": output_format,
        "safety_tolerance": str(safety_tolerance),
        "sync_mode": sync_mode,
        "enable_web_search": enable_web_search,
        "limit_generations": limit_generations,
    }

    # Add optional parameters
    if aspect_ratio:
        arguments["aspect_ratio"] = aspect_ratio

    if seed is not None:
        arguments["seed"] = seed

    endpoint = "fal-ai/nano-banana-pro/edit"

    # Submit the job asynchronously
    handler = fal_client.submit(
        endpoint,
        arguments=arguments,
        webhook_url=webhook_url,
    )

    return handler.request_id, endpoint


def edit_image_with_nano_banana(
    image_urls: List[str],
    prompt: str,
    num_images: int = 1,
    seed: Optional[int] = None,
    aspect_ratio: Optional[str] = "auto",
    resolution: Literal["1K", "2K", "4K"] = "1K",
    output_format: Literal["jpeg", "png", "webp"] = "png",
    safety_tolerance: Literal["1", "2", "3", "4", "5", "6"] = "4",
    sync_mode: bool = False,
    enable_web_search: bool = False,
    limit_generations: bool = False,
) -> Dict[str, Any]:
    """
    Call Fal AI Nano Banana Pro Edit API with the given parameters (synchronous)

    Args:
        image_urls: List of image URLs to edit (1-4 images from Fal storage)
        prompt: The prompt for image editing
        num_images: Number of images to generate (1-4, default: 1)
        seed: Random seed for reproducibility (optional)
        aspect_ratio: Aspect ratio of the generated image (default: "auto")
        resolution: Resolution of the image ("1K", "2K", or "4K", default: "1K")
        output_format: Output image format ('jpeg', 'png', or 'webp', default: 'png')
        safety_tolerance: Safety tolerance level (1-6, default: "4")
        sync_mode: If True, media will be returned as data URI (default: False)
        enable_web_search: Enable web search for latest information (default: False)
        limit_generations: Limit generations from each round to 1 (default: False)

    Returns:
        Dict containing:
            - images: List of edited image URLs
            - description: Description of the edited images
            - timings: Performance metrics (if available)

    Raises:
        Exception: If the API call fails
    """
    # Prepare API arguments
    arguments = {
        "image_urls": image_urls,
        "prompt": prompt,
        "num_images": num_images,
        "resolution": resolution,
        "output_format": output_format,
        "safety_tolerance": str(safety_tolerance),
        "sync_mode": sync_mode,
        "enable_web_search": enable_web_search,
        "limit_generations": limit_generations,
    }

    # Add optional parameters
    if aspect_ratio:
        arguments["aspect_ratio"] = aspect_ratio

    if seed is not None:
        arguments["seed"] = seed

    endpoint = "fal-ai/nano-banana-pro/edit"

    try:
        # Call the API synchronously
        result = fal_client.subscribe(
            endpoint,
            arguments=arguments,
            with_logs=True,
        )

        return result

    except Exception as e:
        print(f"Error calling Nano Banana Pro Edit API: {str(e)}")
        raise
