"""Database connection management for ThirdEye service."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from loguru import logger

from thirdeye.config import settings


# OpenMetadata database engine (read-only)
om_engine: AsyncEngine | None = None
OMSessionLocal: async_sessionmaker[AsyncSession] | None = None

# ThirdEye database engine (read-write)
te_engine: AsyncEngine | None = None
TESessionLocal: async_sessionmaker[AsyncSession] | None = None


async def init_db() -> None:
    """Initialize database connections on startup."""
    global om_engine, OMSessionLocal, te_engine, TESessionLocal
    
    logger.info("Initializing database connections...")
    
    # OpenMetadata database (read-only)
    logger.info(f"Connecting to OpenMetadata DB: {settings.om_mysql_host}:{settings.om_mysql_port}/{settings.om_mysql_db}")
    om_engine = create_async_engine(
        settings.om_mysql_url,
        pool_size=settings.om_mysql_pool_size,
        max_overflow=settings.om_mysql_max_overflow,
        pool_pre_ping=True,  # Verify connections before use
        echo=False,  # Set to True for SQL query logging
    )
    OMSessionLocal = async_sessionmaker(
        om_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # ThirdEye database (read-write)
    logger.info(f"Connecting to ThirdEye DB: {settings.te_mysql_host}:{settings.te_mysql_port}/{settings.te_mysql_db} (schema: {settings.te_mysql_schema})")
    te_engine = create_async_engine(
        settings.te_mysql_url,
        pool_size=settings.te_mysql_pool_size,
        max_overflow=settings.te_mysql_max_overflow,
        pool_pre_ping=True,
        echo=False,
    )
    TESessionLocal = async_sessionmaker(
        te_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    logger.info("Database connections initialized successfully")


async def close_db() -> None:
    """Close database connections on shutdown."""
    global om_engine, te_engine
    
    logger.info("Closing database connections...")
    
    if om_engine:
        await om_engine.dispose()
        logger.info("OpenMetadata DB connection closed")
    
    if te_engine:
        await te_engine.dispose()
        logger.info("ThirdEye DB connection closed")


async def get_om_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get OpenMetadata database session (read-only).
    
    Usage:
        @router.get("/example")
        async def example(session: AsyncSession = Depends(get_om_session)):
            result = await session.execute(select(TableEntity))
            return result.scalars().all()
    """
    if not OMSessionLocal:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    
    async with OMSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_te_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get ThirdEye database session (read-write).
    
    Usage:
        @router.post("/action-items")
        async def create_action_item(
            session: AsyncSession = Depends(get_te_session)
        ):
            # Insert into thirdeye schema
            ...
    """
    if not TESessionLocal:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    
    async with TESessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
