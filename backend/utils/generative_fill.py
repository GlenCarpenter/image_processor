"""
Generative fill utilities for inpainting with SDXL models
Provides functions for detecting available models and performing generative fill operations
"""

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import torch
from diffusers import StableDiffusionXLInpaintPipeline
from PIL import Image
from io import BytesIO


def detect_sdxl_models() -> List[Dict[str, str]]:
    """
    Detect all available SDXL safetensors models in the sdxl directory

    Returns:
        List of dicts with 'name' and 'path' keys for each model found
    """
    sdxl_dir = Path(__file__).parent.parent.parent / "sdxl"
    models = []

    if not sdxl_dir.exists():
        print(f"SDXL directory not found: {sdxl_dir}")
        return models

    # Find all .safetensors files
    for model_file in sdxl_dir.glob("*.safetensors"):
        models.append(
            {
                "name": model_file.stem,  # Filename without extension
                "path": str(model_file),
                "filename": model_file.name,
            }
        )

    # Sort by name for consistent ordering
    models.sort(key=lambda x: x["name"])
    print(f"Found {len(models)} SDXL model(s): {[m['name'] for m in models]}")
    return models


def load_sdxl_pipeline(
    model_path: str, device: str = "cuda"
) -> StableDiffusionXLInpaintPipeline:
    """
    Load an SDXL inpaint pipeline from a safetensors model

    Args:
        model_path: Path to the SDXL safetensors model
        device: Device to load model on ('cuda' or 'cpu')

    Returns:
        Loaded pipeline ready for inference
    """
    # Check if model exists
    if not Path(model_path).exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    print(f"Loading SDXL model from {model_path} on device '{device}'...")

    try:
        # Load the pipeline with the single-file safetensors checkpoint
        pipeline = StableDiffusionXLInpaintPipeline.from_single_file(
            model_path,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        )

        # Move to device
        pipeline = pipeline.to(device)

        # Enable memory-efficient attention if on CUDA
        if device == "cuda":
            pipeline.enable_attention_slicing()

        print(f"Model loaded successfully")
        return pipeline

    except Exception as e:
        raise RuntimeError(f"Failed to load SDXL model: {str(e)}")


def perform_generative_fill(
    image_bytes: bytes,
    mask_bytes: bytes,
    prompt: str,
    model_path: str,
    negative_prompt: str = "",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    strength: float = 1.0,
    seed: Optional[int] = None,
    device: str = "cuda",
    target_width: Optional[int] = None,
    target_height: Optional[int] = None,
) -> bytes:
    """
    Perform generative fill on an image using an SDXL model

    Args:
        image_bytes: Original image as bytes (PNG, JPEG, etc.)
        mask_bytes: Mask image as bytes (white areas = fill, black areas = keep)
        prompt: Text prompt describing what to generate
        model_path: Path to SDXL safetensors model
        negative_prompt: What to avoid in generation
        num_inference_steps: Number of denoising steps (20-50 recommended)
        guidance_scale: How closely to follow prompt (7-15 recommended)
        strength: How much to inpaint (0-1, 1.0 = full inpaint)
        seed: Random seed for reproducibility
        device: Device to run inference on
        target_width: Target width for output (if None, preserves input width)
        target_height: Target height for output (if None, preserves input height)

    Returns:
        Generated image as bytes (PNG format)
    """
    try:
        # Load images from bytes
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        mask = Image.open(BytesIO(mask_bytes)).convert("L")  # Grayscale

        # Store original dimensions
        original_width, original_height = image.size
        if target_width is None:
            target_width = original_width
        if target_height is None:
            target_height = original_height

        # Ensure mask and image have same dimensions
        if image.size != mask.size:
            print(
                f"Resizing mask from {mask.size} to {image.size} to match image dimensions"
            )
            mask = mask.resize(image.size, Image.Resampling.LANCZOS)

        print(
            f"Input image size: {image.size}, Target output: {target_width}x{target_height}, Prompt: '{prompt}', Steps: {num_inference_steps}, Guidance: {guidance_scale}"
        )

        # Load pipeline
        pipeline = load_sdxl_pipeline(model_path, device=device)

        # Set seed for reproducibility
        if seed is not None:
            generator = torch.Generator(device=device).manual_seed(seed)
        else:
            generator = None

        # Run inference
        print("Running generative fill inference...")
        result = pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=image,
            mask_image=mask,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            strength=strength,
            generator=generator,
        )

        output_image = result.images[0]
        
        # Resize output back to target dimensions if different
        if output_image.size != (target_width, target_height):
            print(f"Resizing output from {output_image.size} to {target_width}x{target_height}")
            output_image = output_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        print(f"Inference completed successfully, output size: {output_image.size}")

        # Convert to bytes
        output_bytes = BytesIO()
        output_image.save(output_bytes, format="PNG")
        output_bytes.seek(0)
        return output_bytes.getvalue()

    except Exception as e:
        print(f"Error during generative fill: {str(e)}")
        raise


def create_simple_mask_from_polygon(
    image_size: Tuple[int, int], polygon_points: List[Tuple[int, int]]
) -> Image.Image:
    """
    Create a simple mask image from polygon points
    Areas inside polygon are white (fill), outside are black (keep)

    Args:
        image_size: Tuple of (width, height)
        polygon_points: List of (x, y) tuples defining the polygon

    Returns:
        PIL Image mask (grayscale)
    """
    from PIL import ImageDraw

    mask = Image.new("L", image_size, 0)  # Black background
    draw = ImageDraw.Draw(mask)

    # Draw filled polygon in white
    if len(polygon_points) > 2:
        draw.polygon(polygon_points, fill=255)

    return mask


def invert_mask(mask: Image.Image) -> Image.Image:
    """
    Invert a mask (white becomes black, black becomes white)

    Args:
        mask: PIL Image mask

    Returns:
        Inverted mask
    """
    from PIL import ImageOps

    return ImageOps.invert(mask.convert("L"))
