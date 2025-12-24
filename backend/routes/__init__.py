"""API Routes"""

from fastapi import APIRouter

from backend.routes import scripts, images, upscale, segmentation, edit, fill, jobs, presets

api_router = APIRouter()

# Include sub-routers
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(images.router, prefix="/images", tags=["images"])
api_router.include_router(upscale.router, prefix="/upscale", tags=["upscale"])
api_router.include_router(segmentation.router, prefix="/segment", tags=["segmentation"])
api_router.include_router(edit.router, prefix="/edit", tags=["edit"])
api_router.include_router(fill.router, prefix="/fill", tags=["generative_fill"])
api_router.include_router(presets.router, prefix="/presets", tags=["presets"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
