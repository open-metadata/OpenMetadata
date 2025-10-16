"""
ThirdEye FastAPI Application

Main application entry point with lifespan management, middleware, and router mounting.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import sys

from thirdeye.config import get_settings
from thirdeye.db import init_engines, close_engines, ensure_schema_exists, run_migrations
from thirdeye.routers import health, dashboard, action_items, insights, techniques


# Configure loguru
def setup_logging():
    """Configure loguru logging."""
    settings = get_settings()
    
    # Remove default handler
    logger.remove()
    
    # Add custom handler with format from settings
    logger.add(
        sys.stdout,
        format=settings.log_format,
        level=settings.log_level,
        colorize=True,
    )
    
    # Add file handler for production
    if settings.environment != "development":
        logger.add(
            "logs/thirdeye.log",
            rotation="500 MB",
            retention="10 days",
            compression="zip",
            level=settings.log_level,
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    setup_logging()
    logger.info("🚀 Starting ThirdEye Analytics Service...")
    
    settings = get_settings()
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"MySQL: {settings.om_mysql_host}:{settings.om_mysql_port}")
    logger.info(f"ThirdEye schema: {settings.thirdeye_mysql_schema}")
    logger.info(f"OpenMetadata schema: {settings.om_mysql_db}")
    
    try:
        # Ensure thirdeye schema exists
        await ensure_schema_exists()
        
        # Initialize database engines
        init_engines()
        logger.info("✅ Database engines initialized")
        
        # Run database migrations
        await run_migrations()
        logger.info("✅ Database migrations applied")
        
        # Additional startup tasks
        logger.info(f"📊 ZI Score refresh interval: {settings.refresh_interval_seconds}s ({settings.refresh_minutes} min)")
        logger.info(f"🎯 Campaign expiration: {settings.campaign_expiration_days} days")
        logger.info(f"🔐 JWT enabled: {settings.jwt_enabled}")
        
        logger.success("✨ ThirdEye service is ready!")
    
    except Exception as e:
        logger.error(f"❌ Failed to start ThirdEye service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down ThirdEye service...")
    await close_engines()
    logger.info("✅ Database engines closed")
    logger.success("👋 ThirdEye service stopped")


# Create FastAPI app
app = FastAPI(
    title="ThirdEye Analytics Service",
    description="""
    Internal microservice for OpenMetadata providing analytics and cost optimization.
    
    **Features:**
    - ZI Score calculation (data infrastructure health)
    - Action Items management
    - Opportunity Campaigns
    - Cost tracking
    - Analytics reports
    
    **Note:** This service is accessed through openmetadata-service proxy.
    Direct external access is not supported.
    """,
    version="0.1.0",
    docs_url="/api/v1/thirdeye/docs",
    redoc_url="/api/v1/thirdeye/redoc",
    openapi_url="/api/v1/thirdeye/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Global exception handler for uncaught exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred",
        },
    )


# Mount routers
app.include_router(health.router, tags=["Health"])
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(action_items.router, tags=["Action Items"])
app.include_router(insights.router, tags=["Insights"])
app.include_router(techniques.router, tags=["Techniques"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - redirects to docs."""
    return {
        "service": "ThirdEye Analytics Service",
        "version": "0.1.0",
        "status": "running",
        "docs": "/api/v1/thirdeye/docs",
    }


if __name__ == "__main__":
    """Run with: python -m thirdeye.app"""
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "thirdeye.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )

