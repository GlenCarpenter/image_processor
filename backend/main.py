"""
FastAPI Main Application
Serves as both an API server and lightweight web server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from backend.routes import api_router
from backend.config import settings

app = FastAPI(
    title="Segment Markup API",
    description="FastAPI server for running Python scripts and serving the React UI",
    version="0.1.0",
)

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

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
