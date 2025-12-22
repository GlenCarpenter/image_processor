"""
Setup script for installing dependencies with CUDA-enabled PyTorch
Run this instead of: pip install -r requirements.txt
"""

import subprocess
import sys


def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"📦 {description}")
    print(f"{'='*60}")
    print(f"Command: {command}\n")

    result = subprocess.run(command, shell=True)
    if result.returncode != 0:
        print(f"\n❌ Error: {description} failed")
        sys.exit(1)
    print(f"\n✅ {description} completed successfully")


def main():
    import platform
    print("🚀 Setting up segment_markup environment with GPU support (cross-platform)")

    system = platform.system()
    pytorch_command = None

    if system == "Windows":
        # Default to CUDA 12.1 build for Windows
        pytorch_command = (
            "pip install torch torchvision torchaudio "
            "--index-url https://download.pytorch.org/whl/cu121"
        )
    elif system == "Linux":
        # Try CUDA 12.1 build for Linux, fallback to CPU if fails
        try:
            import torch
            cuda_available = torch.cuda.is_available()
        except ImportError:
            cuda_available = False
        if cuda_available:
            pytorch_command = (
                "pip install torch torchvision torchaudio "
                "--index-url https://download.pytorch.org/whl/cu121"
            )
        else:
            pytorch_command = "pip install torch torchvision torchaudio"
    elif system == "Darwin":
        # MacOS: install default (CPU/Metal) build
        pytorch_command = "pip install torch torchvision torchaudio"
    else:
        print(f"Unknown OS: {system}. Attempting default PyTorch install.")
        pytorch_command = "pip install torch torchvision torchaudio"

    run_command(pytorch_command, f"Installing PyTorch for {system}")

    # Step 2: Install remaining dependencies
    # Read requirements.txt and filter out torch/torchvision lines
    with open("requirements.txt", "r") as f:
        requirements = [
            line.strip()
            for line in f
            if line.strip()
            and not line.startswith("#")
            and not line.startswith("torch")
        ]

    if requirements:
        requirements_str = " ".join(f'"{req}"' for req in requirements)
        other_deps_command = f"pip install {requirements_str}"
        run_command(other_deps_command, "Installing other dependencies")

    # Step 3: Verify installation
    print("\n" + "=" * 60)
    print("🔍 Verifying installation")
    print("=" * 60)

    verify_command = (
        "python -c \"import torch; print(f'PyTorch: {torch.__version__}'); "
        "print(f'CUDA available: {getattr(torch.cuda, 'is_available', lambda: False)()}'); "
        "print(f'CUDA version: {getattr(getattr(torch, 'version', None), 'cuda', None)}')\" "
    )
    run_command(verify_command, "Checking PyTorch installation")

    print("\n" + "=" * 60)
    print("✨ Setup complete!")
    print("=" * 60)
    print("\nYou can now run:")
    print("  - Frontend: cd frontend && npm run dev")
    print("  - Backend:  python -m uvicorn backend.main:app --reload")


if __name__ == "__main__":
    main()
