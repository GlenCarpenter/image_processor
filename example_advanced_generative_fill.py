"""
Example script demonstrating the new generative fill features:
- Custom schedulers
- LoRA support

This script shows how to use these features programmatically.
"""

from pathlib import Path
from PIL import Image, ImageDraw
from backend.utils.generative_fill import (
    detect_sdxl_models,
    detect_loras,
    perform_generative_fill,
)
import io


def create_example_mask(width: int, height: int) -> bytes:
    """Create a simple circular mask for testing"""
    mask = Image.new("L", (width, height), 0)  # Black background
    draw = ImageDraw.Draw(mask)

    # Draw a white circle in the center
    center_x, center_y = width // 2, height // 2
    radius = min(width, height) // 4
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=255,
    )

    # Convert to bytes
    mask_bytes = io.BytesIO()
    mask.save(mask_bytes, format="PNG")
    return mask_bytes.getvalue()


def main():
    # Detect available resources
    print("=== Detecting Available Resources ===")
    models = detect_sdxl_models()
    loras = detect_loras()

    print(f"\nFound {len(models)} model(s)")
    for model in models:
        print(f"  - {model['name']}")

    print(f"\nFound {len(loras)} LoRA(s)")
    for lora in loras:
        print(f"  - {lora['name']}")

    if not models:
        print("\n⚠️ No models found! Please add SDXL models to the 'sdxl' directory.")
        return

    # Example 1: Basic generative fill with custom scheduler
    print("\n=== Example 1: Custom Scheduler ===")
    print("Using DPMSolverMultistep scheduler for faster generation")

    # Load a test image (you'll need to provide your own)
    test_image_path = Path("test_image.png")
    if test_image_path.exists():
        with open(test_image_path, "rb") as f:
            image_bytes = f.read()

        # Get image dimensions
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        # Create mask
        mask_bytes = create_example_mask(width, height)

        # Perform fill with custom scheduler
        output_bytes = perform_generative_fill(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
            prompt="a beautiful sunset over mountains",
            model_path=models[0]["path"],
            negative_prompt="blurry, low quality",
            num_inference_steps=25,
            guidance_scale=8.0,
            scheduler_type="DPMSolverMultistep",
            seed=42,
        )

        # Save output
        output_path = Path("outputs/example_custom_scheduler.png")
        output_path.parent.mkdir(exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(output_bytes)
        print(f"✓ Output saved to: {output_path}")
    else:
        print(f"⚠️ Test image not found at {test_image_path}")

    # Example 2: Using LoRAs
    if loras:
        print("\n=== Example 2: Using LoRAs ===")
        print(f"Using LoRA: {loras[0]['name']}")

        if test_image_path.exists():
            with open(test_image_path, "rb") as f:
                image_bytes = f.read()

            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size
            mask_bytes = create_example_mask(width, height)

            # Perform fill with LoRA
            output_bytes = perform_generative_fill(
                image_bytes=image_bytes,
                mask_bytes=mask_bytes,
                prompt="a magical fantasy landscape",
                model_path=models[0]["path"],
                negative_prompt="blurry, low quality, realistic",
                num_inference_steps=30,
                guidance_scale=8.0,
                lora_paths=[loras[0]["path"]],
                lora_scales=[0.9],
                scheduler_type="DPMSolverMultistep",
                seed=42,
            )

            # Save output
            output_path = Path("outputs/example_with_lora.png")
            with open(output_path, "wb") as f:
                f.write(output_bytes)
            print(f"✓ Output saved to: {output_path}")
    else:
        print("\n=== Example 2: Skipped (No LoRAs found) ===")
        print("Add LoRA files to the 'lora' directory to try this example")

    # Example 3: Multiple LoRAs
    if len(loras) >= 2:
        print("\n=== Example 3: Multiple LoRAs ===")
        print(f"Using LoRAs: {loras[0]['name']} + {loras[1]['name']}")

        if test_image_path.exists():
            with open(test_image_path, "rb") as f:
                image_bytes = f.read()

            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size
            mask_bytes = create_example_mask(width, height)

            # Perform fill with multiple LoRAs
            output_bytes = perform_generative_fill(
                image_bytes=image_bytes,
                mask_bytes=mask_bytes,
                prompt="an epic cinematic scene",
                model_path=models[0]["path"],
                negative_prompt="blurry, low quality",
                num_inference_steps=35,
                guidance_scale=9.0,
                lora_paths=[loras[0]["path"], loras[1]["path"]],
                lora_scales=[0.8, 0.7],
                scheduler_type="EulerAncestralDiscrete",
                seed=123,
            )

            # Save output
            output_path = Path("outputs/example_multiple_loras.png")
            with open(output_path, "wb") as f:
                f.write(output_bytes)
            print(f"✓ Output saved to: {output_path}")

    print("\n=== Examples Complete ===")
    print("\nAvailable schedulers:")
    print("  - DDIM")
    print("  - DPMSolverMultistep")
    print("  - EulerAncestralDiscrete")
    print("  - EulerDiscrete")
    print("  - PNDM")
    print("  - LMSDiscrete")


if __name__ == "__main__":
    main()
