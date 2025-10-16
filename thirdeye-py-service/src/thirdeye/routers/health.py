"""
Health check endpoints for monitoring and load balancers.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict
import platform
import psutil
from datetime import datetime
from loguru import logger

from thirdeye.db import get_thirdeye_session
from thirdeye.config import get_settings

router = APIRouter()


@router.get("/health")
async def health_check() -> Dict:
    """
    Basic health check endpoint.
    Returns service status without database connectivity check.
    
    Used by load balancers and simple monitoring.
    """
    return {
        "status": "ok",
        "service": "thirdeye-analytics",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/v1/thirdeye/health")
async def health_check_v1() -> Dict:
    """
    Health check with API version prefix.
    Matches the proxied route pattern from OpenMetadata.
    """
    return await health_check()


@router.get("/api/v1/thirdeye/health/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_thirdeye_session)
) -> Dict:
    """
    Readiness probe for Kubernetes.
    Checks if service is ready to accept traffic (including database connectivity).
    """
    try:
        # Check database connectivity
        result = await db.execute(text("SELECT 1"))
        db_healthy = result.scalar() == 1
        
        if not db_healthy:
            logger.warning("Database readiness check failed")
            return {
                "status": "not_ready",
                "database": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        return {
            "status": "ready",
            "database": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {
            "status": "not_ready",
            "database": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/api/v1/thirdeye/health/live")
async def liveness_check() -> Dict:
    """
    Liveness probe for Kubernetes.
    Checks if service is alive and should not be restarted.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/v1/thirdeye/health/detail")
async def detailed_health(
    db: AsyncSession = Depends(get_thirdeye_session)
) -> Dict:
    """
    Detailed health information including system metrics.
    Useful for debugging and monitoring dashboards.
    """
    settings = get_settings()
    
    try:
        # Database check
        result = await db.execute(text("SELECT VERSION()"))
        db_version = result.scalar()
        db_healthy = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_version = None
        db_healthy = False
    
    # System metrics
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    return {
        "status": "ok" if db_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "service": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "debug": settings.debug,
        },
        "database": {
            "healthy": db_healthy,
            "version": db_version,
            "host": settings.db_host,
            "name": settings.db_name,
        },
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_percent": cpu_percent,
            "memory": {
                "total_mb": round(memory.total / 1024 / 1024, 2),
                "available_mb": round(memory.available / 1024 / 1024, 2),
                "percent": memory.percent,
            },
        },
        "config": {
            "zi_score_refresh_interval": settings.zi_score_refresh_interval,
            "campaign_expiration_days": settings.campaign_expiration_days,
        },
    }

