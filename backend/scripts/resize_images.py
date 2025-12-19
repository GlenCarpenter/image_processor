#!/usr/bin/env python3
"""
Image resizer script that resizes images to match a target pixel count while finding the closest
matching aspect ratio from a predefined list of common ratios.
"""

import os
import argparse
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import math


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
        tuple: (ratio_name, ratio_value, target_width, target_height)
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
    # For aspect ratio w/h = r and w*h = target_pixels:
    # w = r*h, so (r*h)*h = target_pixels
    # r*h² = target_pixels
    # h = sqrt(target_pixels / r)
    # w = r * h

    height = math.sqrt(target_pixels / aspect_ratio)
    width = aspect_ratio * height

    # Convert to integers and round to multiples of 8 for better compression
    width = int(width)
    height = int(height)

    width = width - (width % 8)
    height = height - (height % 8)

    return width, height


def resize_image_to_pixels(input_path, output_path, target_pixels=1048576):
    """
    Resize an image to match a target pixel count using the closest matching aspect ratio.

    Args:
        input_path: Path to input image
        output_path: Path to save resized image
        target_pixels: Target total number of pixels (default: 1048576 = 1024²)

    Returns:
        tuple: (success: bool, info_dict: dict) where info_dict contains processing details
    """
    try:
        # Open and get current dimensions
        with Image.open(input_path) as img:
            # Convert to RGB if needed (handles RGBA, P mode, etc.)
            if img.mode in ("RGBA", "LA", "P"):
                # Create white background for transparency
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

            # Check if this is a 1:2 or 2:1 image that should be pillarboxed to 1:1
            original_aspect = original_width / original_height

            # Check if image should be pillarboxed to square
            # Include images that are 1:2, 2:1, or even more extreme ratios
            is_very_tall = original_aspect <= 0.55  # Narrower than ~1:1.8 (includes 1:2, 1:3, 1:4, etc.)
            is_very_wide = original_aspect >= 1.8   # Wider than ~1.8:1 (includes 2:1, 3:1, 4:1, etc.)

            if is_very_tall or is_very_wide:
                # Force to square (1:1) by pillarboxing/letterboxing
                ratio_name = "Square (1:1)"
                aspect_ratio = 1.0

                # Create square canvas by padding the shorter dimension
                max_dim = max(original_width, original_height)
                square_img = Image.new(
                    "RGB", (max_dim, max_dim), color=(0, 0, 0)
                )  # Black padding

                # Center the original image on the square canvas
                if is_very_tall:
                    # Tall image (1:2 or narrower) - add pillarboxes on left/right
                    paste_x = (max_dim - original_width) // 2
                    paste_y = 0
                else:
                    # Wide image (2:1 or wider) - add letterboxes on top/bottom
                    paste_x = 0
                    paste_y = (max_dim - original_height) // 2

                square_img.paste(img, (paste_x, paste_y))
                img = square_img
            else:
                # Find the closest matching aspect ratio for other images
                ratio_name, aspect_ratio = find_closest_aspect_ratio(
                    original_width, original_height
                )

                # Center crop the image to match the target aspect ratio if needed
                if (
                    abs(original_aspect - aspect_ratio) > 0.01
                ):  # Only crop if ratios differ significantly
                    if original_aspect > aspect_ratio:
                        # Original is wider, crop the width
                        new_width = int(original_height * aspect_ratio)
                        left = (original_width - new_width) // 2
                        crop_box = (left, 0, left + new_width, original_height)
                    else:
                        # Original is taller, crop the height
                        new_height = int(original_width / aspect_ratio)
                        top = (original_height - new_height) // 2
                        crop_box = (0, top, original_width, top + new_height)

                    img = img.crop(crop_box)

            # Calculate target dimensions for the pixel count and aspect ratio
            target_width, target_height = calculate_dimensions_for_pixels(
                target_pixels, aspect_ratio
            )
            actual_pixels = target_width * target_height

            # Now resize the cropped image to target dimensions
            resized_img = img.resize(
                (target_width, target_height), Image.Resampling.LANCZOS
            )

            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Save with high quality
            resized_img.save(output_path, "JPEG", quality=95, optimize=True)

            # Return success and processing info
            info = {
                "original_size": (original_width, original_height),
                "original_pixels": original_pixels,
                "target_size": (target_width, target_height),
                "actual_pixels": actual_pixels,
                "ratio_name": ratio_name,
                "aspect_ratio": aspect_ratio,
                "original_ratio": original_width / original_height,
            }

        return True, info

    except Exception as e:
        error_info = {
            "error": str(e),
            "original_size": None,
            "target_size": None,
            "ratio_name": None,
        }
        return False, error_info


def process_directory(input_dir, output_dir, target_pixels=1048576):
    """
    Process all images in input directory and save resized versions to output directory.

    Args:
        input_dir: Input directory path
        output_dir: Output directory path
        target_pixels: Target total number of pixels (default: 1048576 = 1024²)
    """
    # Supported image extensions
    supported_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}

    # Find all image files recursively
    input_path = Path(input_dir)
    if not input_path.exists():
        print(f"Error: Input directory '{input_dir}' does not exist.")
        return

    image_files = []
    for root, dirs, files in os.walk(input_dir):
        for file in files:
            if Path(file).suffix.lower() in supported_extensions:
                image_files.append(os.path.join(root, file))

    if not image_files:
        print(f"No supported image files found in '{input_dir}'")
        print(f"Supported formats: {', '.join(supported_extensions)}")
        return

    print(f"Found {len(image_files)} images to process")
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Target pixels: {target_pixels:,} ({int(math.sqrt(target_pixels))}² approx)")

    # Process images
    processed = 0
    failed = 0
    processing_details = []

    for input_file in tqdm(image_files, desc="Resizing images"):
        # Calculate relative path to maintain directory structure
        rel_path = os.path.relpath(input_file, input_dir)

        # Change extension to .jpg for output (since we're converting to JPEG)
        output_path_obj = Path(rel_path)
        output_filename = output_path_obj.stem + ".jpg"
        output_rel_path = str(output_path_obj.parent / output_filename)

        output_file = os.path.join(output_dir, output_rel_path)

        success, info = resize_image_to_pixels(input_file, output_file, target_pixels)
        if success:
            processed += 1
            processing_details.append(info)
        else:
            failed += 1

    print("\nProcessing complete!")
    print(f"Successfully processed: {processed}")
    print(f"Failed: {failed}")
    print(f"Total: {len(image_files)}")

    # Show aspect ratio summary
    if processing_details:
        print("\nAspect Ratio Summary:")
        ratio_counts = {}
        for detail in processing_details:
            ratio_name = detail["ratio_name"]
            ratio_counts[ratio_name] = ratio_counts.get(ratio_name, 0) + 1

        for ratio_name, count in sorted(
            ratio_counts.items(), key=lambda x: x[1], reverse=True
        ):
            print(f"  {ratio_name}: {count} images")

        # Show a few examples of transformations
        print("\nExample transformations (first 3):")
        for i, detail in enumerate(processing_details[:3]):
            orig_w, orig_h = detail["original_size"]
            target_w, target_h = detail["target_size"]
            print(
                f"  {orig_w}x{orig_h} ({detail['original_pixels']:,} px) -> {target_w}x{target_h} ({detail['actual_pixels']:,} px) [{detail['ratio_name']}]"
            )


def main():
    """Main function to handle command line arguments."""
    parser = argparse.ArgumentParser(
        description="Resize images to match a target pixel count using closest matching aspect ratios",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Input directory containing images to resize",
    )

    parser.add_argument(
        "-o", "--output", required=True, help="Output directory for resized images"
    )

    parser.add_argument(
        "-s",
        "--size",
        type=int,
        default=1024,
        help="Target size root (pixels will be size²) (default: 1024 = 1,048,576 pixels)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without actually resizing images",
    )

    args = parser.parse_args()

    # Convert size to pixels (size²)
    target_pixels = args.size * args.size

    # Convert relative paths to absolute paths
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()

    # Validate arguments
    if args.size <= 0:
        print("Error: Size must be a positive integer")
        return 1

    if args.dry_run:
        # Just show what would be processed
        if not input_dir.exists():
            print(f"Error: Input directory '{input_dir}' does not exist.")
            return 1

        supported_extensions = {
            ".jpg",
            ".jpeg",
            ".png",
            ".bmp",
            ".webp",
            ".tiff",
            ".tif",
        }
        image_files = []

        for root, dirs, files in os.walk(input_dir):
            for file in files:
                if Path(file).suffix.lower() in supported_extensions:
                    image_files.append(os.path.join(root, file))

        print(f"DRY RUN - Would process {len(image_files)} images")
        print(f"Input: {input_dir}")
        print(f"Output: {output_dir}")
        print(f"Target size: {args.size} ({target_pixels:,} pixels = {args.size}²)")

        if image_files:
            print("\nFirst 10 files that would be processed:")
            for i, file in enumerate(image_files[:10]):
                rel_path = os.path.relpath(file, input_dir)
                output_path_obj = Path(rel_path)
                output_filename = output_path_obj.stem + ".jpg"
                output_rel_path = str(output_path_obj.parent / output_filename)
                print(f"  {rel_path} -> {output_rel_path}")

            if len(image_files) > 10:
                print(f"  ... and {len(image_files) - 10} more files")

        return 0

    # Process the images
    process_directory(str(input_dir), str(output_dir), target_pixels)
    return 0


if __name__ == "__main__":
    exit(main())
