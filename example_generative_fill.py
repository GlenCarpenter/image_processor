#!/usr/bin/env python3
"""
Example script demonstrating generative fill functionality
Shows how to use the backend utility directly or via API
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path.parent))

from backend.utils.generative_fill import (
    detect_sdxl_models,
    perform_generative_fill,
    create_simple_mask_from_polygon,
)
from PIL import Image


def example_detect_models():
    """Example 1: Detect available SDXL models"""
    print("=" * 60)
    print("Example 1: Detecting Available SDXL Models")
    print("=" * 60)

    models = detect_sdxl_models()

    if models:
        print(f"\nFound {len(models)} model(s):\n")
        for i, model in enumerate(models, 1):
            print(f"{i}. {model['name']}")
            print(f"   Path: {model['path']}\n")
    else:
        print("\nNo SDXL models found!")
        print(
            "Add .safetensors files to the 'sdxl/' directory to get started.\n"
        )

    return models


def example_create_simple_mask(image_path: str, output_path: str = None):
    """Example 2: Create a simple mask from polygon"""
    print("\n" + "=" * 60)
    print("Example 2: Creating a Simple Mask")
    print("=" * 60)

    # Create a rectangular mask (white center, black borders)
    img = Image.open(image_path)
    width, height = img.size

    # Define a polygon (rectangle in center)
    left = int(width * 0.2)
    right = int(width * 0.8)
    top = int(height * 0.2)
    bottom = int(height * 0.8)

    polygon_points = [(left, top), (right, top), (right, bottom), (left, bottom)]

    mask = create_simple_mask_from_polygon((width, height), polygon_points)

    if output_path:
        mask.save(output_path)
        print(f"\nMask created: {output_path}")
        print(f"Mask size: {mask.size}")
        print("White area (center) will be filled")
        print("Black area (borders) will be preserved\n")

    return mask


def example_generative_fill(
    image_path: str,
    mask_path: str,
    model_path: str,
    prompt: str,
    output_path: str = None,
):
    """Example 3: Perform generative fill"""
    print("\n" + "=" * 60)
    print("Example 3: Performing Generative Fill")
    print("=" * 60)

    print(f"\nInput image: {image_path}")
    print(f"Mask image: {mask_path}")
    print(f"Model: {Path(model_path).name}")
    print(f"Prompt: {prompt}")

    try:
        # Read image files
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        with open(mask_path, "rb") as f:
            mask_bytes = f.read()

        print("\nStarting generative fill...")
        result_bytes = perform_generative_fill(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
            prompt=prompt,
            model_path=model_path,
            negative_prompt="low quality, blurry",
            num_inference_steps=30,
            guidance_scale=7.5,
            strength=1.0,
            seed=42,  # Fixed seed for reproducibility
            device="cuda",
        )

        if output_path:
            with open(output_path, "wb") as f:
                f.write(result_bytes)
            print(f"\nResult saved: {output_path}")

        return result_bytes

    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()
        return None


def example_api_usage():
    """Example 4: Using the API"""
    print("\n" + "=" * 60)
    print("Example 4: Using the API")
    print("=" * 60)

    print("""
To use the generative fill API, make HTTP requests:

1. Get available models:
   curl http://localhost:8000/api/fill/models

2. Submit a fill job:
   curl -X POST http://localhost:8000/api/fill/fill \\
     -F "file=@image.jpg" \\
     -F "mask=@mask.png" \\
     -F "prompt=beautiful landscape" \\
     -F "model_name=realvisxlV50_v50Bakedvae" \\
     -F "num_inference_steps=30" \\
     -F "guidance_scale=7.5" \\
     -F "strength=1.0"

3. Response example:
   {
     "success": true,
     "job_id": 1,
     "output_id": 1,
     "filename": "fill_20240101_120000_a1b2c3d4.png",
     "status": "completed",
     "width": 512,
     "height": 512
   }
    """)


def main():
    """Run examples"""
    print("\n")
    print("╔" + "═" * 58 + "╗")
    print("║" + " GENERATIVE FILL EXAMPLES ".center(58) + "║")
    print("╚" + "═" * 58 + "╝")

    # Example 1: Detect models
    models = example_detect_models()

    # Example 2: Show how to create masks
    test_image = Path(__file__).parent / "outputs" / "test.jpg"
    if test_image.exists():
        mask_output = Path(__file__).parent / "outputs" / "example_mask.png"
        example_create_simple_mask(str(test_image), str(mask_output))
    else:
        print("\nSkipping mask creation (no test image found)")

    # Example 3: Show generative fill usage
    if models and test_image.exists():
        try:
            output_image = Path(__file__).parent / "outputs" / "example_output.png"
            example_generative_fill(
                image_path=str(test_image),
                mask_path=str(mask_output),
                model_path=models[0]["path"],
                prompt="photorealistic mountain landscape",
                output_path=str(output_image),
            )
        except Exception as e:
            print(f"Could not run generative fill example: {e}")

    # Example 4: Show API usage
    example_api_usage()

    print("\n" + "=" * 60)
    print("For more information, see GENERATIVE_FILL_GUIDE.md")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
