"""
Image processing utilities
Extracted from resize_images.py for API use
"""

import math
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


def extract_exif_data(image_path: str) -> Dict[str, Any]:
    """
    Extract EXIF metadata from an image file

    Args:
        image_path: Path to the image file

    Returns:
        Dictionary with EXIF data organized by category
    """
    try:
        img = Image.open(image_path)
        exif_data = img.getexif()

        if not exif_data:
            return {}

        # Organize EXIF data into categories
        camera_info = {}
        settings_info = {}
        image_info = {}
        location_info = {}
        datetime_info = {}
        other_info = {}

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

        # Build result dictionary with only non-empty categories
        result = {}
        if camera_info:
            result["camera"] = camera_info
        if settings_info:
            result["settings"] = settings_info
        if datetime_info:
            result["datetime"] = datetime_info
        if image_info:
            result["image"] = image_info
        if location_info:
            result["location"] = location_info
        if other_info:
            result["other"] = other_info

        return result

    except Exception as e:
        print(f"Error extracting EXIF data: {str(e)}")
        return {}
