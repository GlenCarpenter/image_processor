"""
Fal AI utilities for image editing using Qwen
Provides reusable functions for interacting with Fal AI's image editing service
"""

import os
from typing import Optional, Literal, Dict, Any, Callable, Tuple
import fal_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Fal API key
FAL_KEY = os.getenv("FAL_KEY")
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY


def submit_edit_image(
    image_url: str,
    prompt: str = "Remove all text from the image",
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    acceleration: Literal["none", "regular", "high"] = "regular",
    negative_prompt: str = "",
    enable_safety_checker: bool = True,
    output_format: Literal["png", "jpeg", "webp"] = "png",
    num_images: int = 1,
    seed: Optional[int] = None,
    sync_mode: bool = False,
    webhook_url: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Submit an async image edit job to Fal AI

    Args:
        image_url: URL of the image to edit (from Fal storage)
        prompt: Editing instruction
        image_width: Custom output width (required with image_height)
        image_height: Custom output height (required with image_width)
        guidance_scale: How closely to follow the prompt (1.0-20.0, default: 4.5)
        num_inference_steps: Number of denoising steps (1-50, default: 28)
        acceleration: Generation speed mode ('none', 'regular', or 'high', default: 'regular')
        negative_prompt: What to avoid in the output (default: "")
        enable_safety_checker: Whether to enable safety filtering (default: True)
        output_format: Output image format ('png', 'jpeg', or 'webp', default: 'png')
        num_images: Number of images to generate (1-4, default: 1)
        seed: Random seed for reproducibility
        sync_mode: If True, media will be returned as data URI (default: False)
        webhook_url: Optional webhook URL for result notification

    Returns:
        Tuple of (request_id, endpoint) for later retrieval
    """
    # Prepare API arguments
    arguments = {
        "image_urls": [image_url],
        "prompt": prompt,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "acceleration": acceleration,
        "negative_prompt": negative_prompt,
        "enable_safety_checker": enable_safety_checker,
        "output_format": output_format,
        "num_images": num_images,
    }

    # Add custom image size if provided
    if image_width and image_height:
        arguments["image_size"] = {
            "width": image_width,
            "height": image_height,
        }

    # Add seed if provided
    if seed is not None:
        arguments["seed"] = seed

    endpoint = "fal-ai/qwen-image-edit-2511"

    # Submit the job asynchronously
    handler = fal_client.submit(
        endpoint,
        arguments=arguments,
        webhook_url=webhook_url,
    )

    return handler.request_id, endpoint


def submit_edit_image_multi(
    image_urls: list[str],
    prompt: str = "Remove all text from the image",
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    acceleration: Literal["none", "regular", "high"] = "regular",
    negative_prompt: str = "",
    enable_safety_checker: bool = True,
    output_format: Literal["png", "jpeg", "webp"] = "png",
    num_images: int = 1,
    seed: Optional[int] = None,
    sync_mode: bool = False,
    webhook_url: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Submit an async image edit job to Fal AI with multiple input images

    Args:
        image_urls: List of URLs of images to edit (from Fal storage, 1-4 images)
        prompt: Editing instruction
        image_width: Custom output width (required with image_height)
        image_height: Custom output height (required with image_width)
        guidance_scale: How closely to follow the prompt (1.0-20.0, default: 4.5)
        num_inference_steps: Number of denoising steps (1-50, default: 28)
        acceleration: Generation speed mode ('none', 'regular', or 'high', default: 'regular')
        negative_prompt: What to avoid in the output (default: "")
        enable_safety_checker: Whether to enable safety filtering (default: True)
        output_format: Output image format ('png', 'jpeg', or 'webp', default: 'png')
        num_images: Number of images to generate (1-4, default: 1)
        seed: Random seed for reproducibility
        sync_mode: If True, media will be returned as data URI (default: False)
        webhook_url: Optional webhook URL for result notification

    Returns:
        Tuple of (request_id, endpoint) for later retrieval
    """
    # Prepare API arguments
    arguments = {
        "image_urls": image_urls,
        "prompt": prompt,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "acceleration": acceleration,
        "negative_prompt": negative_prompt,
        "enable_safety_checker": enable_safety_checker,
        "output_format": output_format,
        "num_images": num_images,
        "sync_mode": sync_mode,
    }

    # Add custom image size if provided
    if image_width and image_height:
        arguments["image_size"] = {
            "width": image_width,
            "height": image_height,
        }

    # Add seed if provided
    if seed is not None:
        arguments["seed"] = seed

    endpoint = "fal-ai/qwen-image-edit-2511"

    # Submit the job asynchronously
    handler = fal_client.submit(
        endpoint,
        arguments=arguments,
        webhook_url=webhook_url,
    )

    return handler.request_id, endpoint


def edit_image_with_fal(
    image_url: str,
    prompt: str = "Remove all text from the image",
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    acceleration: Literal["none", "regular", "high"] = "regular",
    negative_prompt: str = "",
    enable_safety_checker: bool = True,
    output_format: Literal["png", "jpeg", "webp"] = "png",
    num_images: int = 1,
    seed: Optional[int] = None,
    sync_mode: bool = False,
    with_logs: bool = False,
    on_queue_update: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Call Fal AI Qwen image edit API with the given parameters (synchronous)

    Args:
        image_url: URL of the image to edit (from Fal storage)
        prompt: Editing instruction (e.g., "Remove all text from the image")
        image_width: Custom output width (required with image_height)
        image_height: Custom output height (required with image_width)
        guidance_scale: How closely to follow the prompt (1.0-20.0, default: 4.5)
        num_inference_steps: Number of denoising steps (1-50, default: 28)
        acceleration: Generation speed mode ('none', 'regular', or 'high', default: 'regular')
        negative_prompt: What to avoid in the output (default: "")
        enable_safety_checker: Whether to enable safety filtering (default: True)
        output_format: Output image format ('png', 'jpeg', or 'webp', default: 'png')
        num_images: Number of images to generate (1-4, default: 1)
        seed: Random seed for reproducibility
        sync_mode: If True, media will be returned as data URI (default: False)
        with_logs: Whether to include logs in the response
        on_queue_update: Optional callback for queue updates

    Returns:
        Dictionary containing the result from Fal AI, including image URL

    Raises:
        Exception: If the API call fails or returns no image URL
    """
    # Prepare API arguments
    arguments = {
        "image_urls": [image_url],
        "prompt": prompt,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "acceleration": acceleration,
        "negative_prompt": negative_prompt,
        "enable_safety_checker": enable_safety_checker,
        "output_format": output_format,
        "num_images": num_images,
        "sync_mode": sync_mode,
    }

    # Add custom image size if provided
    if image_width and image_height:
        arguments["image_size"] = {
            "width": image_width,
            "height": image_height,
        }

    # Add seed if provided
    if seed is not None:
        arguments["seed"] = seed

    # Call the Fal AI edit API
    result = fal_client.subscribe(
        "fal-ai/qwen-image-edit-2511",
        arguments=arguments,
        with_logs=with_logs,
        on_queue_update=on_queue_update,
    )

    # Validate result
    if not result or "images" not in result or len(result["images"]) == 0:
        raise Exception("No images in Fal AI response")

    if "url" not in result["images"][0]:
        raise Exception("No image URL in Fal AI response")

    return result


def edit_image_end_to_end(
    input_path: str,
    output_path: str,
    prompt: str = "Remove all text from the image",
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    acceleration: Literal["none", "regular", "high"] = "regular",
    negative_prompt: str = "",
    enable_safety_checker: bool = True,
    output_format: Literal["png", "jpeg", "webp"] = "png",
    num_images: int = 1,
    seed: Optional[int] = None,
    sync_mode: bool = False,
    with_logs: bool = False,
    on_queue_update: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Complete editing pipeline: upload -> edit -> download

    Args:
        input_path: Path to input image file
        output_path: Path where edited image will be saved
        prompt: Editing instruction
        guidance_scale: How closely to follow the prompt (1.0-20.0, default: 4.5)
        num_inference_steps: Number of denoising steps (1-50, default: 28)
        acceleration: Generation speed mode ('none', 'regular', or 'high')
        negative_prompt: What to avoid in the output
        enable_safety_checker: Whether to enable safety filtering
        output_format: Output format ('png', 'jpeg', or 'webp')
        num_images: Number of images to generate (1-4)
        seed: Random seed for reproducibility
        sync_mode: If True, media will be returned as data URI
        with_logs: Whether to show logs
        on_queue_update: Optional callback for progress updates

    Returns:
        Dictionary with result information including image URL
    """
    from backend.utils.fal_utils import upload_file_to_fal, download_from_url

    # Upload the input image
    image_url = upload_file_to_fal(input_path)

    # Edit the image
    result = edit_image_with_fal(
        image_url=image_url,
        prompt=prompt,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        acceleration=acceleration,
        negative_prompt=negative_prompt,
        enable_safety_checker=enable_safety_checker,
        output_format=output_format,
        num_images=num_images,
        seed=seed,
        sync_mode=sync_mode,
        with_logs=with_logs,
        on_queue_update=on_queue_update,
    )

    # Download the result
    result_url = result["images"][0]["url"]
    download_from_url(result_url, output_path)

    return result
