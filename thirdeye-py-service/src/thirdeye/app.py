"""ThirdEye FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from prometheus_client import make_asgi_app
import sys

from thirdeye.config import settings
from thirdeye.db import init_db, close_db
from thirdeye.routers import health


# Configure loguru logger
logger.remove()  # Remove default handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=settings.log_level,
    colorize=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager for startup and shutdown events.
    
    Handles:
    - Database connection initialization
    - Resource cleanup on shutdown
    """
    # Startup
    logger.info(f"Starting {settings.service_name} in {settings.environment} mode")
    logger.info(f"Log level: {settings.log_level}")
    
    # Skip database initialization if SKIP_DB_INIT is set (for testing without MySQL)
    import os
    if not os.getenv("SKIP_DB_INIT", "").lower() in ("true", "1", "yes"):
        try:
            await init_db()
            logger.info("ThirdEye service startup complete")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            logger.warning("Database initialization failed, but continuing for health check testing")
            # Don't raise - allow service to start for health check testing
    else:
        logger.warning("Skipping database initialization (SKIP_DB_INIT=true)")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ThirdEye service...")
    await close_db()
    logger.info("ThirdEye service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="ThirdEye Analytics Service",
    description="Internal microservice for analytics and optimization capabilities, accessed via OpenMetadata proxy",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,  # Disable Swagger in production
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)


# CORS middleware (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(health.router)


# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint redirect to health check."""
    return {
        "service": "thirdeye-py-service",
        "message": "ThirdEye Analytics Service - Internal API",
        "health": "/api/v1/thirdeye/health",
        "metrics": "/metrics",
        "docs": "/docs" if not settings.is_production else "disabled",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "thirdeye.app:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )
