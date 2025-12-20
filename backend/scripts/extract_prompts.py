"""
Extract prompts from image metadata and save them as text files.
"""

import json
from PIL import Image
from pathlib import Path


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


def extract_prompt_from_image(image_path):
    """
    Extract prompt from image metadata.
    Handles three formats:
    1. Non-JSON text (newline separated) - returns first line
    2. SwarmUI JSON with sui_image_params.prompt
    3. ComfyUI workflow JSON with CLIPTextEncode node

    Args:
        image_path: Path to the image file

    Returns:
        str: The prompt text if found, None otherwise
    """
    try:
        img = Image.open(image_path)

        # Check PNG info for metadata
        if hasattr(img, "info"):
            for key in img.info.keys():
                metadata_str = img.info[key]

                if not metadata_str:
                    continue

                # Try to parse as JSON first
                try:
                    metadata = json.loads(metadata_str)

                    # Case 2: SwarmUI format - sui_image_params.prompt
                    if isinstance(metadata, dict) and "sui_image_params" in metadata:
                        prompt = metadata["sui_image_params"].get("prompt")
                        if prompt:
                            return prompt

                    # Case 3: ComfyUI format
                    comfyui_prompt = extract_comfyui_prompt(metadata)
                    if comfyui_prompt:
                        return comfyui_prompt

                except (json.JSONDecodeError, TypeError):
                    # Case 1: Non-JSON format - return first line
                    if isinstance(metadata_str, str):
                        lines = metadata_str.split("\n")
                        if lines and lines[0].strip():
                            return lines[0].strip()

        return None

    except Exception as e:
        print(f"Error reading {image_path}: {e}")
        return None


def process_images(src_dir, output_dir=None):
    """
    Process all images in the source directory and extract prompts.

    Args:
        src_dir: Directory containing the images
        output_dir: Directory to save text files (defaults to same as src_dir)
    """
    if output_dir is None:
        output_dir = src_dir

    src_path = Path(src_dir)
    output_path = Path(output_dir)

    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)

    # Supported image extensions
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

    # Process each image file
    processed = 0
    skipped = 0

    for file_path in src_path.iterdir():
        if file_path.suffix.lower() in image_extensions:
            prompt = extract_prompt_from_image(file_path)

            if prompt:
                # Create text file with same name prefix
                txt_filename = file_path.stem + ".txt"
                txt_path = output_path / txt_filename

                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(prompt)

                print(f"✓ Extracted prompt from {file_path.name} -> {txt_filename}")
                processed += 1
            else:
                print(f"✗ No prompt found in {file_path.name}")
                skipped += 1

    print(f"\nSummary: {processed} prompts extracted, {skipped} images skipped")


if __name__ == "__main__":
    # Process images in the src directory
    script_dir = Path(__file__).parent
    src_directory = script_dir / "src"

    print(f"Processing images in: {src_directory}")
    print("-" * 60)

    process_images(src_directory)
