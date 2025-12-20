#!/usr/bin/env python3
"""
Batch Image Upscaler using Fal AI
Upscales images using the fal-ai/seedvr/upscale/image model
"""

import os
import sys
from pathlib import Path
from typing import List, Optional, Literal
from dataclasses import dataclass
import asyncio

from backend.utils.fal_upscale import upscale_image_end_to_end
import fal_client


@dataclass
class UpscaleOptions:
    """Options for upscaling images"""

    input_dir: str
    output_dir: str
    upscale_mode: Literal["factor", "target"] = "factor"
    upscale_factor: int = 2
    target_resolution: Literal["720p", "1080p", "1440p", "2160p"] = "1080p"
    noise_scale: float = 0.1
    output_format: Literal["png", "jpg", "webp"] = "jpg"
    concurrency: int = 3


@dataclass
class UpscaleResult:
    """Result of an upscale operation"""

    file_name: str
    success: bool
    output_path: Optional[str] = None
    error: Optional[str] = None


# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def get_image_files(dir_path: str) -> List[str]:
    """Get all image files from a directory"""
    dir_path_obj = Path(dir_path)

    if not dir_path_obj.exists():
        raise FileNotFoundError(f"Directory not found: {dir_path}")

    image_files = []
    for file in dir_path_obj.iterdir():
        if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS:
            image_files.append(file.name)

    return sorted(image_files)


def upscale_image(input_path: str, output_path: str, options: UpscaleOptions) -> None:
    """Upscale a single image using the shared Fal utility"""
    print("  Processing with fal AI...")

    # Callback for queue updates
    def on_queue_update(update):
        if isinstance(update, fal_client.InProgress):
            for log in update.logs:
                print(f"    {log['message']}")

    # Use the shared utility for the complete upscale pipeline
    upscale_image_end_to_end(
        input_path=input_path,
        output_path=output_path,
        upscale_mode=options.upscale_mode,
        upscale_factor=options.upscale_factor,
        target_resolution=options.target_resolution,
        noise_scale=options.noise_scale,
        output_format=options.output_format,
        with_logs=True,
        on_queue_update=on_queue_update,
    )


async def process_batch_async(
    files: List[str], processor, concurrency: int
) -> List[UpscaleResult]:
    """Process images in batches with concurrency control"""
    results = []

    for i in range(0, len(files), concurrency):
        batch = files[i : i + concurrency]
        batch_results = await asyncio.gather(
            *[processor(file, i + idx) for idx, file in enumerate(batch)],
            return_exceptions=True,
        )

        # Handle any exceptions in the batch
        processed_results = []
        for result in batch_results:
            if isinstance(result, Exception):
                # This shouldn't happen as we catch exceptions in processor
                processed_results.append(
                    UpscaleResult(file_name="unknown", success=False, error=str(result))
                )
            else:
                processed_results.append(result)

        results.extend(processed_results)

    return results


def batch_upscale(options: UpscaleOptions) -> List[UpscaleResult]:
    """Batch upscale all images in a directory"""
    input_dir = options.input_dir
    output_dir = options.output_dir
    concurrency = options.concurrency

    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Get all image files
    image_files = get_image_files(input_dir)
    print(f"Found {len(image_files)} images to upscale")
    print(f"Using concurrency: {concurrency}\n")

    if len(image_files) == 0:
        print("No images found to process")
        return []

    # Process each image
    async def process_file(file_name: str, index: int) -> UpscaleResult:
        input_path = os.path.join(input_dir, file_name)
        file_stem = Path(file_name).stem
        file_ext = Path(file_name).suffix
        output_file_name = f"{file_stem}_upscaled{file_ext}"
        output_path = os.path.join(output_dir, output_file_name)

        print(f"\n[{index + 1}/{len(image_files)}] Processing: {file_name}")

        try:
            # Run synchronous upscale in thread pool to not block event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, upscale_image, input_path, output_path, options
            )
            print(f"  ✓ Saved to: {output_path}")
            return UpscaleResult(
                file_name=file_name, success=True, output_path=output_path
            )
        except Exception as error:
            error_msg = str(error)
            print(f"  ✗ Failed: {error_msg}")
            return UpscaleResult(file_name=file_name, success=False, error=error_msg)

    # Run async processing
    results = asyncio.run(process_batch_async(image_files, process_file, concurrency))

    return results


def main():
    """Main function"""
    # Parse command line arguments or use defaults
    input_dir = sys.argv[1] if len(sys.argv) > 1 else "./input"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"

    print("=== Batch Image Upscaler ===\n")
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}\n")

    options = UpscaleOptions(
        input_dir=input_dir,
        output_dir=output_dir,
        upscale_mode="factor",
        upscale_factor=2,
        noise_scale=0.1,
        output_format="jpg",
        concurrency=3,  # Process 3 images at a time
    )

    results = batch_upscale(options)

    # Print summary
    print("\n=== Summary ===")
    successful = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success)
    print(f"Total: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")

    if failed > 0:
        print("\nFailed files:")
        for result in results:
            if not result.success:
                print(f"  - {result.file_name}: {result.error}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
