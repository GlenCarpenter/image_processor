"""
FastAPI Main Application
Serves as both an API server and lightweight web server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import asyncio

from backend.routes import api_router
from backend.config import settings
from backend.database import get_active_jobs, init_db
from backend.utils.fal_utils import poll_fal_job, resolve_fal_endpoint

app = FastAPI(
    title="Image Processor API",
    description="FastAPI server for running Python scripts and serving the React UI",
    version="0.1.0",
)


@app.on_event("startup")
async def startup_event():
    """
    Startup event handler
    Initializes database and recovers incomplete jobs
    """
    print("[Startup] Initializing database...")
    init_db()

    print("[Startup] Checking for incomplete jobs to recover...")
    incomplete_jobs = get_active_jobs()

    if incomplete_jobs:
        print(f"[Startup] Found {len(incomplete_jobs)} incomplete job(s) to recover")
        for job in incomplete_jobs:
            job_id = job["id"]
            job_type = job["job_type"]
            fal_request_id = job.get("fal_request_id")

            if fal_request_id:
                try:
                    endpoint = resolve_fal_endpoint(job_type, job.get("metadata"))
                except ValueError:
                    print(
                        f"[Startup] Unknown job type '{job_type}' for job {job_id}, skipping"
                    )
                    continue

                print(
                    f"[Startup] Resuming polling for {job_type} job {job_id} (request_id: {fal_request_id})"
                )
                asyncio.create_task(
                    poll_fal_job(job_id, fal_request_id, endpoint, job_type)
                )
            else:
                print(f"[Startup] Job {job_id} has no fal_request_id, cannot recover")
    else:
        print("[Startup] No incomplete jobs found")

    print("[Startup] Server ready!")


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Serve React static files (when built)
frontend_build_path = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_build_path.exists():
    # Mount assets directory for static files
    app.mount(
        "/assets",
        StaticFiles(directory=str(frontend_build_path / "assets")),
        name="assets",
    )

    # Catch-all route for SPA - serves index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all routes (catch-all for client-side routing)"""
        # If requesting a specific file that exists, serve it
        file_path = frontend_build_path / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # Otherwise serve index.html for client-side routing
        return FileResponse(frontend_build_path / "index.html")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Server is running"}


if __name__ == "__main__":
    import uvicorn

    # Note: When running with reload=True, the startup event will fire on each reload
    print(f"\n{'='*60}")
    print("Starting Image Processor API Server")
    print(f"{'='*60}")
    print(f"Server binds to: {settings.HOST}:{settings.PORT}")
    print(f"Access the Image Processor app at: http://localhost:{settings.PORT}")
    print(f"Swagger Docs: http://localhost:{settings.PORT}/docs")
    print(f"{'='*60}\n")

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
