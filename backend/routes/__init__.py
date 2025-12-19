"""API Routes"""
from fastapi import APIRouter

from backend.routes import scripts, images

api_router = APIRouter()

# Include sub-routers
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(images.router, prefix="/images", tags=["images"])
