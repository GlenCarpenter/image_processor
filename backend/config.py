"""
Application Configuration
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings"""

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # CORS Configuration
    # Note: Server binds to 0.0.0.0 (all interfaces), but access via localhost or 127.0.0.1
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite default dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost:8000",  # Backend self-requests
        "http://127.0.0.1:5173",  # IPv4 localhost Vite
        "http://127.0.0.1:3000",  # IPv4 localhost alternative
        "http://127.0.0.1:8000",  # IPv4 localhost backend
    ]

    # Script Configuration
    SCRIPTS_DIR: str = "backend/scripts"
    MAX_SCRIPT_TIMEOUT: int = 300  # seconds

    # Fal AI Configuration
    FAL_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
