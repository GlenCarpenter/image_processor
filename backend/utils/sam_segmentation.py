"""
SAM 2 segmentation utilities
Provides model loading and inference for interactive segmentation
"""

import numpy as np
from PIL import Image
from io import BytesIO
from typing import List, Tuple, Optional
from pathlib import Path
from ultralytics import SAM
import torch

# Global model cache
_model_cache = {}

# Models directory
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Detect GPU availability
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(
    f"CUDA version (compiled): {torch.version.cuda if torch.version.cuda else 'None'}"
)
print(
    f"cuDNN version: {torch.backends.cudnn.version() if torch.backends.cudnn.is_available() else 'None'}"
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"SAM 2 will use device: {DEVICE}")
if DEVICE == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(
        f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB"
    )
else:
    print("⚠️ Running on CPU - segmentation will be slower")
    print(
        "To enable GPU: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121"
    )


def get_sam_model(model_name: str = "sam2_b.pt") -> SAM:
    """
    Load and cache SAM 2 model with GPU support

    Args:
        model_name: Model name (sam2_b.pt, sam2_l.pt, sam2_s.pt, sam2_t.pt)

    Returns:
        SAM model instance
    """
    if model_name not in _model_cache:
        model_path = MODELS_DIR / model_name

        # If model doesn't exist locally, ultralytics will auto-download it
        # Just use the model name without .pt extension for auto-download
        if not model_path.exists():
            print(f"Model not found at {model_path}")
            print(f"Ultralytics will auto-download {model_name} to cache...")
            # Use just the model name (e.g., 'sam2_b.pt') - ultralytics handles download
            model = SAM(model_name)
        else:
            print(f"Loading SAM model from: {model_path} on {DEVICE}")
            model = SAM(str(model_path))

        # Move model to GPU if available
        if DEVICE == "cuda":
            model.to(DEVICE)
        _model_cache[model_name] = model
        print(f"SAM model loaded: {model_name} on {DEVICE}")

    return _model_cache[model_name]


def clear_model_cache():
    """Clear the model cache to force reload"""
    global _model_cache
    _model_cache = {}


def predict_mask_from_points(
    image_bytes: bytes,
    points: List[Tuple[int, int]],
    labels: List[int],
    model_name: str = "sam2_b.pt",
) -> np.ndarray:
    """
    Generate segmentation mask from point prompts

    Args:
        image_bytes: Image data as bytes
        points: List of (x, y) coordinates for prompts
        labels: List of labels (1 for foreground, 0 for background)
        model_name: SAM model to use

    Returns:
        Binary mask as numpy array (H, W) with values 0 or 255
    """
    # Load image
    img = Image.open(BytesIO(image_bytes))
    img_array = np.array(img)

    # Get cached model (now that wrapping is fixed, caching works properly)
    model = get_sam_model(model_name)

    # Convert points and labels to numpy arrays
    points_array = np.array(points, dtype=np.float32)
    labels_array = np.array(labels, dtype=np.int32)

    print(f"Predicting with {len(points)} points: {points_array}")
    print(f"Labels: {labels_array}")

    # IMPORTANT: Wrap points and labels in an extra list dimension
    # This tells SAM that all points belong to ONE object
    # points=[[[x1,y1], [x2,y2]]] instead of [[x1,y1], [x2,y2]]
    points_wrapped = [points_array.tolist()]
    labels_wrapped = [labels_array.tolist()]

    print(f"Wrapped points: {points_wrapped}")
    print(f"Wrapped labels: {labels_wrapped}")

    # Run prediction with point prompts
    results = model(
        img_array, points=points_wrapped, labels=labels_wrapped, verbose=False
    )

    # Extract mask from results
    if (
        len(results) > 0
        and hasattr(results[0], "masks")
        and results[0].masks is not None
    ):
        # Get the first mask
        mask = results[0].masks.data[0].cpu().numpy()
        # Convert to uint8 (0 or 255)
        mask = (mask * 255).astype(np.uint8)
        print(
            f"Generated mask with shape: {mask.shape}, unique values: {np.unique(mask)}, sum: {mask.sum()}"
        )
        return mask

    # Return empty mask if no result
    print("No mask generated!")
    return np.zeros(img_array.shape[:2], dtype=np.uint8)


def crop_image_with_mask(
    image_bytes: bytes,
    mask: np.ndarray,
    padding_percent: float = 10.0,
    target_aspect_ratio: Optional[float] = None,
) -> Tuple[bytes, dict]:
    """
    Crop image to mask bounds with padding and aspect ratio adjustment

    Args:
        image_bytes: Original image data as bytes
        mask: Binary mask (0 or 255)
        padding_percent: Padding as percentage of crop size
        target_aspect_ratio: Target width/height ratio (None = use mask bounds)

    Returns:
        Tuple of (cropped_image_bytes, info_dict)
    """
    # Load original image
    img = Image.open(BytesIO(image_bytes))
    img_array = np.array(img)

    # Find mask bounds
    rows = np.any(mask > 0, axis=1)
    cols = np.any(mask > 0, axis=0)

    if not np.any(rows) or not np.any(cols):
        # No mask, return original image
        output_buffer = BytesIO()
        img.save(output_buffer, format="JPEG", quality=95)
        output_buffer.seek(0)
        return output_buffer.getvalue(), {
            "original_size": {"width": img.width, "height": img.height},
            "crop_bounds": None,
            "message": "No mask found",
        }

    row_min, row_max = np.where(rows)[0][[0, -1]]
    col_min, col_max = np.where(cols)[0][[0, -1]]

    # Calculate crop dimensions
    mask_width = col_max - col_min + 1
    mask_height = row_max - row_min + 1

    # Add padding (from original image content)
    padding_w = int(mask_width * padding_percent / 100)
    padding_h = int(mask_height * padding_percent / 100)

    crop_x1 = max(0, col_min - padding_w)
    crop_y1 = max(0, row_min - padding_h)
    crop_x2 = min(img.width, col_max + padding_w + 1)
    crop_y2 = min(img.height, row_max + padding_h + 1)

    # Crop to bounds with padding
    cropped = img_array[crop_y1:crop_y2, crop_x1:crop_x2]

    # Apply aspect ratio if specified
    if target_aspect_ratio is not None:
        current_h, current_w = cropped.shape[:2]
        current_aspect = current_w / current_h

        if abs(current_aspect - target_aspect_ratio) > 0.01:
            if current_aspect > target_aspect_ratio:
                # Too wide, crop width
                new_width = int(current_h * target_aspect_ratio)
                start_x = (current_w - new_width) // 2
                cropped = cropped[:, start_x : start_x + new_width]
            else:
                # Too tall, crop height
                new_height = int(current_w / target_aspect_ratio)
                start_y = (current_h - new_height) // 2
                cropped = cropped[start_y : start_y + new_height, :]

    # Convert back to PIL Image and save
    cropped_img = Image.fromarray(cropped)
    output_buffer = BytesIO()
    cropped_img.save(output_buffer, format="JPEG", quality=95, optimize=True)
    output_buffer.seek(0)

    info = {
        "original_size": {"width": img.width, "height": img.height},
        "mask_bounds": {
            "x": int(col_min),
            "y": int(row_min),
            "width": int(mask_width),
            "height": int(mask_height),
        },
        "crop_bounds": {
            "x": int(crop_x1),
            "y": int(crop_y1),
            "width": int(crop_x2 - crop_x1),
            "height": int(crop_y2 - crop_y1),
        },
        "final_size": {"width": cropped_img.width, "height": cropped_img.height},
        "padding_applied": {"horizontal": padding_w, "vertical": padding_h},
    }

    return output_buffer.getvalue(), info


def remove_background(
    image_bytes: bytes,
    mask: np.ndarray,
) -> bytes:
    """
    Remove background using the provided mask

    Args:
        image_bytes: Image data as bytes
        mask: Binary mask (0 or 255) where 255 = keep, 0 = remove

    Returns:
        PNG image bytes with transparent background
    """
    # Load image
    img = Image.open(BytesIO(image_bytes))

    print(f"Removing background from image: {img.size}")
    print(f"Mask shape: {mask.shape}, unique values: {np.unique(mask)}")

    # Convert image to RGBA if not already
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Get image as array
    img_array = np.array(img)

    # Ensure mask is the same size as image
    if mask.shape != img_array.shape[:2]:
        mask_img = Image.fromarray(mask)
        mask_img = mask_img.resize((img.width, img.height), Image.LANCZOS)
        mask = np.array(mask_img)

    # Apply mask as alpha channel (255 = keep, 0 = transparent)
    img_array[:, :, 3] = mask

    # Convert back to PIL Image
    result_img = Image.fromarray(img_array, "RGBA")

    # Save as PNG (supports transparency)
    output_buffer = BytesIO()
    result_img.save(output_buffer, format="PNG", optimize=True)
    output_buffer.seek(0)

    return output_buffer.getvalue()
