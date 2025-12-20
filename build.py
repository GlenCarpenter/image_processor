"""
Build script for Segment Markup project
Handles frontend build, dependency installation, and server startup
"""

import subprocess
import sys
from pathlib import Path
import argparse


def run_command(cmd, cwd=None, shell=False):
    """Run a command and stream output"""
    print(f"\n{'='*60}")
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    print(f"{'='*60}\n")

    result = subprocess.run(cmd, cwd=cwd, shell=shell, text=True)

    if result.returncode != 0:
        print(f"\n❌ Command failed with exit code {result.returncode}")
        return False
    return True


def check_node_installed():
    """Check if Node.js is installed"""
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ Node.js found: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass

    print("❌ Node.js not found. Please install Node.js to build the frontend.")
    return False


def check_frontend_exists():
    """Check if frontend directory exists with package.json"""
    frontend_dir = Path("frontend")
    package_json = frontend_dir / "package.json"

    if not frontend_dir.exists():
        print("⚠ Frontend directory not found. Skipping frontend build.")
        return False

    if not package_json.exists():
        print("⚠ package.json not found in frontend. Skipping frontend build.")
        return False

    return True


def build_frontend():
    """Build the React frontend"""
    print("\n📦 Building Frontend...")

    if not check_frontend_exists():
        return True  # Not an error, just skip

    if not check_node_installed():
        return False

    frontend_dir = Path("frontend")

    # Check if node_modules exists
    if not (frontend_dir / "node_modules").exists():
        print("\n📥 Installing frontend dependencies...")
        if not run_command(["npm", "install"], cwd=frontend_dir):
            return False

    # Build the frontend
    print("\n🔨 Building React app...")
    if not run_command(["npm", "run", "build"], cwd=frontend_dir):
        return False

    print("\n✅ Frontend build complete!")
    return True


def install_requirements():
    """Install Python requirements"""
    print("\n📦 Installing Python Dependencies...")

    requirements_file = Path("requirements.txt")
    if not requirements_file.exists():
        print("⚠ requirements.txt not found. Skipping.")
        return True

    # Use the current Python interpreter
    python_exe = sys.executable

    if not run_command([python_exe, "-m", "pip", "install", "-r", "requirements.txt"]):
        return False

    print("\n✅ Python dependencies installed!")
    return True


def start_server(dev_mode=False):
    """Start the FastAPI server"""
    print("\n🚀 Starting Server...")

    python_exe = sys.executable

    if dev_mode:
        print("Starting in development mode with auto-reload...")
        # Use uvicorn directly with --reload-dir to ensure venv is used
        # Pass the python executable explicitly to subprocess workers
        import os
        env = os.environ.copy()
        env['PYTHONPATH'] = str(Path(__file__).parent.resolve())
        
        subprocess.run(
            [
                python_exe,
                "-m",
                "uvicorn",
                "backend.main:app",
                "--reload",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
            ],
            env=env
        )
    else:
        subprocess.run([python_exe, "-m", "backend.main"])


def main():
    """Main build process"""
    parser = argparse.ArgumentParser(description="Build and run Segment Markup")
    parser.add_argument(
        "--skip-frontend", action="store_true", help="Skip frontend build"
    )
    parser.add_argument(
        "--skip-requirements",
        action="store_true",
        help="Skip Python requirements installation",
    )
    parser.add_argument(
        "--no-server", action="store_true", help="Don't start the server after building"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Start server in development mode with auto-reload",
    )

    args = parser.parse_args()

    print("🏗️  Segment Markup Build Script")
    print("=" * 60)

    # Build frontend
    if not args.skip_frontend:
        if not build_frontend():
            print("\n❌ Frontend build failed!")
            sys.exit(1)
    else:
        print("\n⏭️  Skipping frontend build")

    # Install Python requirements
    if not args.skip_requirements:
        if not install_requirements():
            print("\n❌ Requirements installation failed!")
            sys.exit(1)
    else:
        print("\n⏭️  Skipping requirements installation")

    # Start server
    if not args.no_server:
        start_server(dev_mode=args.dev)
    else:
        print("\n✅ Build complete! Run 'python -m backend.main' to start the server.")


if __name__ == "__main__":
    main()
