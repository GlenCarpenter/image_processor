"""
Image processing utilities
Extracted from resize_images.py for API use
"""

import math
import json
from io import BytesIO
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from typing import Dict, Any

# Predefined aspect ratios with their names
ASPECT_RATIOS = {
    "Portrait (2:3)": 2 / 3,
    "Standard (3:4)": 3 / 4,
    "Large Format (4:5)": 4 / 5,
    "Selfie, Social Media Videos (9:16)": 9 / 16,
    "Tall Portrait (1:2)": 1 / 2,
    "Square (1:1)": 1 / 1,
    "Wide Landscape (2:1)": 2 / 1,
    "SD TV (4:3)": 4 / 3,
    "IMAX (1.43:1)": 1.43 / 1,
    "European Widescreen (1.66:1)": 1.66 / 1,
    "Widescreen / HD TV (16:9)": 16 / 9,
    "Standard Widescreen (1.85:1)": 1.85 / 1,
    "Cinemascope / Panavision (2.35:1)": 2.35 / 1,
    "Anamorphic Widescreen (2.39:1)": 2.39 / 1,
    "Older TV and some documentaries (4:3)": 4 / 3,
    "Golden Ratio (1.618:1)": 1.618 / 1,
}


def find_closest_aspect_ratio(image_width, image_height):
    """
    Find the closest matching aspect ratio from the predefined list.

    Args:
        image_width: Current image width
        image_height: Current image height

    Returns:
        tuple: (ratio_name, ratio_value)
    """
    current_ratio = image_width / image_height

    closest_name = None
    closest_ratio = None
    min_difference = float("inf")

    for name, ratio in ASPECT_RATIOS.items():
        difference = abs(current_ratio - ratio)
        if difference < min_difference:
            min_difference = difference
            closest_name = name
            closest_ratio = ratio

    return closest_name, closest_ratio


def calculate_dimensions_for_pixels(target_pixels, aspect_ratio):
    """
    Calculate width and height for a target pixel count and aspect ratio.

    Args:
        target_pixels: Target total number of pixels
        aspect_ratio: Width/height ratio

    Returns:
        tuple: (width, height) rounded to multiples of 8
    """
    height = math.sqrt(target_pixels / aspect_ratio)
    width = aspect_ratio * height

    # Convert to integers and round to multiples of 8 for better compression
    width = int(width)
    height = int(height)

    width = width - (width % 8)
    height = height - (height % 8)

    return width, height


def resize_image_bytes(
    image_bytes, target_pixels=1048576, output_format="JPEG", quality=95
):
    """
    Resize an image from bytes to match a target pixel count using the closest matching aspect ratio.

    Args:
        image_bytes: Image data as bytes
        target_pixels: Target total number of pixels (default: 1048576 = 1024²)
        output_format: Output image format (JPEG, PNG, etc.)
        quality: JPEG quality (1-100)

    Returns:
        tuple: (resized_image_bytes, info_dict)
    """
    # Open image from bytes
    img = Image.open(BytesIO(image_bytes))

    # Convert to RGB if needed
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(
            img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None
        )
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    original_width, original_height = img.size
    original_pixels = original_width * original_height
    original_aspect = original_width / original_height

    # Check if image should be pillarboxed to square
    is_very_tall = original_aspect <= 0.55  # Narrower than ~1:1.8
    is_very_wide = original_aspect >= 1.8  # Wider than ~1.8:1

    if is_very_tall or is_very_wide:
        # Force to square (1:1) by pillarboxing/letterboxing
        ratio_name = "Square (1:1)"
        aspect_ratio = 1.0

        max_dim = max(original_width, original_height)
        square_img = Image.new("RGB", (max_dim, max_dim), color=(0, 0, 0))

        if is_very_tall:
            paste_x = (max_dim - original_width) // 2
            paste_y = 0
        else:
            paste_x = 0
            paste_y = (max_dim - original_height) // 2

        square_img.paste(img, (paste_x, paste_y))
        img = square_img
    else:
        # Find the closest matching aspect ratio
        ratio_name, aspect_ratio = find_closest_aspect_ratio(
            original_width, original_height
        )

        # Center crop to match target aspect ratio if needed
        if abs(original_aspect - aspect_ratio) > 0.01:
            if original_aspect > aspect_ratio:
                new_width = int(original_height * aspect_ratio)
                left = (original_width - new_width) // 2
                crop_box = (left, 0, left + new_width, original_height)
            else:
                new_height = int(original_width / aspect_ratio)
                top = (original_height - new_height) // 2
                crop_box = (0, top, original_width, top + new_height)

            img = img.crop(crop_box)

    # Calculate target dimensions
    target_width, target_height = calculate_dimensions_for_pixels(
        target_pixels, aspect_ratio
    )
    actual_pixels = target_width * target_height

    # Resize the image
    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)

    # Convert to bytes
    output_buffer = BytesIO()
    if output_format.upper() == "JPEG":
        resized_img.save(output_buffer, format="JPEG", quality=quality, optimize=True)
    else:
        resized_img.save(output_buffer, format=output_format)

    output_buffer.seek(0)

    # Prepare info
    info = {
        "original_size": {"width": original_width, "height": original_height},
        "original_pixels": original_pixels,
        "target_size": {"width": target_width, "height": target_height},
        "actual_pixels": actual_pixels,
        "ratio_name": ratio_name,
        "aspect_ratio": aspect_ratio,
        "original_aspect_ratio": original_aspect,
    }

    return output_buffer.getvalue(), info


def extract_comfyui_prompt(metadata):
    """
    Extract prompt from ComfyUI workflow JSON.
    Looks for CLIPTextEncode node with title "CLIP Text Encode (Positive Prompt)".

    Args:
        metadata: Parsed JSON metadata

    Returns:
        str: The prompt text if found, None otherwise
    """
    if not isinstance(metadata, dict):
        return None

    for node_id, node_data in metadata.items():
        if not isinstance(node_data, dict):
            continue

        # Check if this is a CLIPTextEncode node with positive prompt
        if (
            node_data.get("class_type") == "CLIPTextEncode"
            and node_data.get("_meta", {}).get("title")
            == "CLIP Text Encode (Positive Prompt)"
        ):

            # Extract the text from inputs
            text = node_data.get("inputs", {}).get("text")
            if text:
                return text

    return None


def extract_prompt_from_metadata(img: Image.Image) -> str | None:
    """
    Extract prompt from image metadata.
    Handles three formats:
    1. Non-JSON text (newline separated) - returns first line
    2. SwarmUI JSON with sui_image_params.prompt
    3. ComfyUI workflow JSON with CLIPTextEncode node

    Args:
        img: PIL Image object

    Returns:
        str: The prompt text if found, None otherwise
    """
    # Check PNG info for metadata
    if hasattr(img, "info"):
        print(f"Image has info attribute with keys: {list(img.info.keys())}")
        for key in img.info.keys():
            metadata_str = img.info[key]

            if not metadata_str:
                continue

            print(f"Checking metadata key: {key}, length: {len(str(metadata_str))}")

            # Try to parse as JSON first
            try:
                metadata = json.loads(metadata_str)
                print(f"Successfully parsed JSON metadata")

                # Case 2: SwarmUI format - sui_image_params.prompt
                if isinstance(metadata, dict) and "sui_image_params" in metadata:
                    prompt = metadata["sui_image_params"].get("prompt")
                    if prompt:
                        print(f"Found SwarmUI prompt: {prompt[:100]}...")
                        return prompt

                # Case 3: ComfyUI format
                comfyui_prompt = extract_comfyui_prompt(metadata)
                if comfyui_prompt:
                    print(f"Found ComfyUI prompt: {comfyui_prompt[:100]}...")
                    return comfyui_prompt

            except (json.JSONDecodeError, TypeError) as e:
                # Case 1: Non-JSON format - return first line
                if isinstance(metadata_str, str):
                    lines = metadata_str.split("\n")
                    if lines and lines[0].strip():
                        print(f"Found non-JSON prompt: {lines[0][:100]}...")
                        return lines[0].strip()
    else:
        print("Image does not have info attribute")

    print("No prompt found in image metadata")
    return None


def extract_exif_data(image_path: str) -> Dict[str, Any]:
    """
    Extract EXIF metadata and AI prompt from an image file

    Args:
        image_path: Path to the image file

    Returns:
        Dictionary with separate exif data and prompt
    """
    try:
        img = Image.open(image_path)
        
        # Extract AI generation prompt first (works for PNG metadata)
        prompt = extract_prompt_from_metadata(img)

        # Organize EXIF data into categories
        camera_info = {}
        settings_info = {}
        image_info = {}
        location_info = {}
        datetime_info = {}
        other_info = {}

        # Now extract EXIF data
        exif_data = img.getexif()

        if exif_data:
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)

                # Handle GPS data separately
                if tag == "GPSInfo":
                    try:
                        gps_data = {}
                        if isinstance(value, dict):
                            for gps_tag_id in value:
                                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                                gps_data[gps_tag] = value[gps_tag_id]
                            location_info["GPS"] = gps_data
                    except Exception as e:
                        print(f"Error processing GPS data: {e}")
                    continue

                # Convert bytes to string if possible
                if isinstance(value, bytes):
                    try:
                        value = value.decode("utf-8", errors="ignore").strip("\x00")
                    except Exception:
                        value = str(value)

                # Skip empty or invalid values
                if value == "" or value is None:
                    continue
                
                # Convert IFDRational (PIL's rational number type) to float
                if hasattr(value, 'numerator') and hasattr(value, 'denominator'):
                    # It's a rational number (like exposure time, aperture, etc.)
                    try:
                        value = float(value)
                    except Exception:
                        value = str(value)
                
                # Convert tuples to strings for JSON serialization
                if isinstance(value, tuple):
                    value = str(value)

                # Categorize the data
                if tag in ["Make", "Model", "LensMake", "LensModel", "SerialNumber"]:
                    camera_info[tag] = value
                elif tag in [
                    "ExposureTime",
                    "FNumber",
                    "ISOSpeedRatings",
                    "ISO",
                    "FocalLength",
                    "ExposureProgram",
                    "MeteringMode",
                    "Flash",
                    "WhiteBalance",
                    "ExposureMode",
                    "ExposureBiasValue",
                    "MaxApertureValue",
                    "ShutterSpeedValue",
                    "FocalLengthIn35mmFilm",
                    "DigitalZoomRatio",
                    "SceneCaptureType",
                    "GainControl",
                    "Contrast",
                    "Saturation",
                    "Sharpness",
                ]:
                    settings_info[tag] = value
                elif tag in [
                    "DateTime",
                    "DateTimeOriginal",
                    "DateTimeDigitized",
                    "OffsetTime",
                    "OffsetTimeOriginal",
                    "SubsecTime",
                    "SubsecTimeOriginal",
                    "SubsecTimeDigitized",
                ]:
                    datetime_info[tag] = value
                elif tag in [
                    "ImageWidth",
                    "ImageHeight",
                    "Orientation",
                    "ResolutionUnit",
                    "XResolution",
                    "YResolution",
                    "ColorSpace",
                    "ExifImageWidth",
                    "ExifImageHeight",
                    "PixelXDimension",
                    "PixelYDimension",
                    "CompressedBitsPerPixel",
                    "Compression",
                    "PhotometricInterpretation",
                ]:
                    image_info[tag] = value
                elif tag in [
                    "Software",
                    "Artist",
                    "Copyright",
                    "ImageDescription",
                    "UserComment",
                    "HostComputer",
                    "ProcessingSoftware",
                ]:
                    other_info[tag] = value
                else:
                    # Put everything else in other_info instead of dropping it
                    other_info[tag] = value

        # Build EXIF result dictionary with only non-empty categories
        exif_result = {}
        if camera_info:
            exif_result["camera"] = camera_info
        if settings_info:
            exif_result["settings"] = settings_info
        if datetime_info:
            exif_result["datetime"] = datetime_info
        if image_info:
            exif_result["image"] = image_info
        if location_info:
            exif_result["location"] = location_info
        if other_info:
            exif_result["other"] = other_info

        # Return both EXIF and prompt separately
        return {
            "exif": exif_result,
            "prompt": prompt
        }

    except Exception as e:
        print(f"Error extracting EXIF data: {str(e)}")
        return {"exif": {}, "prompt": None}
