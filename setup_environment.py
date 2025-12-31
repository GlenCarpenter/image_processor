"""
Setup script for installing dependencies with CUDA-enabled PyTorch
Run this instead of: pip install -r requirements.txt
"""

import subprocess
import sys
import platform


def run_command(command, description, shell=False):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    if isinstance(command, list):
        print(f"Command: {' '.join(command)}\n")
    else:
        print(f"Command: {command}\n")

    result = subprocess.run(command, shell=shell)
    if result.returncode != 0:
        print(f"\n[ERROR] {description} failed")
        sys.exit(1)
    print(f"\n[OK] {description} completed successfully")


def main():
    print("=" * 60)
    print("Setting up environment with GPU support")
    print("=" * 60)

    # Debug: Show which Python we're using
    print(f"\nPython executable: {sys.executable}")
    print(f"Python version: {sys.version.split()[0]}")

    # Check if we're in a virtual environment
    in_venv = hasattr(sys, "real_prefix") or (
        hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix
    )
    print(f"In virtual environment: {in_venv}")
    if in_venv:
        print(f"Virtual env path: {sys.prefix}")

    system = platform.system()
    python_exec = sys.executable

    # Step 0: Update pip, setuptools, and wheel first (fixes many dependency issues)
    print("\n" + "=" * 60)
    print("Upgrading pip, setuptools, and wheel")
    print("=" * 60)
    run_command(
        [python_exec, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
        "Upgrading pip and build tools",
        shell=False
    )

    # Build pip command as a list for better reliability
    pytorch_packages = ["torch", "torchvision", "torchaudio"]

    if system == "Windows":
        # CUDA 12.1 build for Windows
        pip_command = (
            [python_exec, "-m", "pip", "install"]
            + pytorch_packages
            + ["--index-url", "https://download.pytorch.org/whl/cu121"]
        )
    elif system == "Linux":
        # CUDA 12.1 build for Linux
        pip_command = (
            [python_exec, "-m", "pip", "install"]
            + pytorch_packages
            + ["--index-url", "https://download.pytorch.org/whl/cu121"]
        )
    elif system == "Darwin":
        # MacOS: use CPU/Metal build with specific index
        # This ensures compatibility with arm64 and x86_64 Macs
        pip_command = (
            [python_exec, "-m", "pip", "install"]
            + pytorch_packages
            + ["--index-url", "https://download.pytorch.org/whl/cpu"]
        )
    else:
        print(f"Unknown OS: {system}. Attempting default PyTorch install.")
        pip_command = [python_exec, "-m", "pip", "install"] + pytorch_packages

    run_command(pip_command, f"Installing PyTorch for {system}", shell=False)

    # Step 2: Install remaining dependencies
    try:
        with open("requirements.txt", "r") as f:
            requirements = [
                line.strip()
                for line in f
                if line.strip()
                and not line.startswith("#")
                and not line.startswith("torch")
            ]

        if requirements:
            print(f"\nFound {len(requirements)} additional dependencies to install")
            # Install each requirement
            for req in requirements:
                req_command = [python_exec, "-m", "pip", "install", req]
                run_command(req_command, f"Installing {req}", shell=False)
    except FileNotFoundError:
        print("\n[WARNING] requirements.txt not found, skipping other dependencies")

    # Step 3: Verify installation
    print("\n" + "=" * 60)
    print("Verifying PyTorch installation")
    print("=" * 60)

    verify_script = """
import torch
import sys
print(f'Python executable: {sys.executable}')
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'CUDA version: {torch.version.cuda}')
if torch.cuda.is_available():
    print(f'CUDA device count: {torch.cuda.device_count()}')
    print(f'CUDA device name: {torch.cuda.get_device_name(0)}')
"""

    result = subprocess.run(
        [python_exec, "-c", verify_script], capture_output=True, text=True
    )

    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)

    if result.returncode != 0:
        print("\n[ERROR] PyTorch verification failed")
        sys.exit(1)

    # Check if we got CUDA support
    if "CUDA available: True" in result.stdout:
        print("\n[OK] CUDA support detected and working!")
    elif "CUDA available: False" in result.stdout:
        print("\n[WARNING] CUDA support not detected!")
        print("Possible reasons:")
        print("  1. No NVIDIA GPU present")
        print("  2. NVIDIA GPU drivers not installed")
        print("  3. CUDA toolkit version mismatch")
        print("\nThe application will still work, but will use CPU (slower)")

    print("\n" + "=" * 60)
    print("Setup complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
