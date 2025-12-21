"""
Cleanup orphaned temporary files from segmentation sessions
"""

from pathlib import Path

TEMP_DIR = Path(__file__).parent / "temp"


def cleanup_temp_directory():
    """Remove all files from the temp directory"""
    if not TEMP_DIR.exists():
        print(f"Temp directory does not exist: {TEMP_DIR}")
        return

    files = list(TEMP_DIR.glob("*.jpg"))

    if not files:
        print("No files to clean up")
        return

    print(f"Found {len(files)} files in temp directory")

    for file in files:
        try:
            file.unlink()
            print(f"Deleted: {file.name}")
        except Exception as e:
            print(f"Failed to delete {file.name}: {e}")

    remaining = list(TEMP_DIR.glob("*.jpg"))
    print(f"\nCleanup complete. Remaining files: {len(remaining)}")


if __name__ == "__main__":
    cleanup_temp_directory()
