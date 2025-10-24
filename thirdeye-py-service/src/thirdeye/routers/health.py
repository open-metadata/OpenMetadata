"""Health check endpoints for ThirdEye service."""

from fastapi import APIRouter, status
from pydantic import BaseModel
from datetime import datetime

from thirdeye.config import settings


router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str
    version: str
    environment: str
    timestamp: str


@router.get(
    "/api/v1/thirdeye/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns the health status of the ThirdEye service",
)
async def health_check() -> HealthResponse:
    """
    Health check endpoint for service monitoring.
    
    Returns:
        Health status information including service name, version, and environment
    """
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        version="0.1.0",
        environment=settings.environment,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
