"""API Routes"""
from fastapi import APIRouter

from backend.routes import scripts

api_router = APIRouter()

# Include sub-routers
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
