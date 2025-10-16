"""
Database session management for SQLAlchemy with async support.
Provides sessions for both ThirdEye schema and OpenMetadata schema (read-only).
Both use the same MySQL instance.
"""

from typing import AsyncGenerator
from contextlib import asynccontextmanager
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from loguru import logger

from thirdeye.config import get_settings

# Base class for SQLAlchemy models
Base = declarative_base()

# Global engine instances (initialized in lifespan)
_thirdeye_engine: AsyncEngine | None = None
_om_engine: AsyncEngine | None = None

# Session makers
_thirdeye_session_maker: async_sessionmaker[AsyncSession] | None = None
_om_session_maker: async_sessionmaker[AsyncSession] | None = None


async def ensure_schema_exists() -> None:
    """
    Ensure the thirdeye schema exists in MySQL.
    Creates it if it doesn't exist.
    """
    settings = get_settings()
    
    # Create a temporary engine without specifying default database
    temp_url = (
        f"mysql+asyncmy://{settings.thirdeye_mysql_user}:{settings.thirdeye_mysql_pw}"
        f"@{settings.om_mysql_host}:{settings.om_mysql_port}?charset=utf8mb4"
    )
    
    temp_engine = create_async_engine(temp_url, echo=settings.db_echo)
    
    try:
        async with temp_engine.begin() as conn:
            # Create schema if not exists
            await conn.execute(
                text(f"CREATE SCHEMA IF NOT EXISTS {settings.thirdeye_mysql_schema} "
                     f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            )
            logger.info(f"✅ Ensured schema '{settings.thirdeye_mysql_schema}' exists")
    finally:
        await temp_engine.dispose()


async def run_migrations() -> None:
    """
    Run database migrations idempotently.
    Executes migration SQL files in order.
    """
    if _thirdeye_engine is None:
        raise RuntimeError("ThirdEye engine not initialized. Call init_engines() first.")
    
    settings = get_settings()
    migrations_dir = Path(__file__).parent / "migrations"
    
    if not migrations_dir.exists():
        logger.warning(f"Migrations directory not found: {migrations_dir}")
        return
    
    # Get all .sql files and sort them
    migration_files = sorted(migrations_dir.glob("*.sql"))
    
    if not migration_files:
        logger.info("No migration files found")
        return
    
    logger.info(f"Running {len(migration_files)} migration(s)...")
    
    for migration_file in migration_files:
        try:
            logger.info(f"Applying migration: {migration_file.name}")
            
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Split by semicolons and execute each statement
            # (simple split - doesn't handle semicolons in strings)
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            
            async with _thirdeye_engine.begin() as conn:
                for stmt in statements:
                    if stmt:
                        await conn.execute(text(stmt))
            
            logger.success(f"✅ Applied migration: {migration_file.name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to apply migration {migration_file.name}: {e}")
            # Continue with other migrations (idempotent tables will skip)


def init_engines() -> None:
    """Initialize database engines. Called during app startup."""
    global _thirdeye_engine, _om_engine, _thirdeye_session_maker, _om_session_maker
    
    settings = get_settings()
    
    # ThirdEye schema engine (read-write)
    _thirdeye_engine = create_async_engine(
        settings.thirdeye_database_url,
        echo=settings.db_echo,
        pool_size=settings.sqlalchemy_pool_size,
        max_overflow=settings.sqlalchemy_max_overflow,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
    )
    
    _thirdeye_session_maker = async_sessionmaker(
        _thirdeye_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    logger.info(
        f"Initialized ThirdEye engine: {settings.om_mysql_host}:{settings.om_mysql_port}/{settings.thirdeye_mysql_schema}"
    )
    
    # OpenMetadata schema engine (read-only)
    _om_engine = create_async_engine(
        settings.om_database_url,
        echo=settings.db_echo,
        pool_size=5,  # Smaller pool for read-only
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    
    _om_session_maker = async_sessionmaker(
        _om_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    logger.info(
        f"Initialized OpenMetadata engine (read-only): {settings.om_mysql_host}:{settings.om_mysql_port}/{settings.om_mysql_db}"
    )


async def close_engines() -> None:
    """Close database engines. Called during app shutdown."""
    global _thirdeye_engine, _om_engine
    
    if _thirdeye_engine:
        await _thirdeye_engine.dispose()
        logger.info("Closed ThirdEye DB engine")
    
    if _om_engine:
        await _om_engine.dispose()
        logger.info("Closed OpenMetadata DB engine")


async def get_thirdeye_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting ThirdEye database session.
    
    Usage:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_thirdeye_session)):
            result = await db.execute(select(Model))
            return result.scalars().all()
    """
    if _thirdeye_session_maker is None:
        raise RuntimeError("Database not initialized. Call init_engines() first.")
    
    async with _thirdeye_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_om_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting OpenMetadata database session (read-only).
    
    Usage:
        @router.get("/example")
        async def example(om_db: AsyncSession = Depends(get_om_session)):
            result = await om_db.execute(select(TableEntity))
            return result.scalars().all()
    """
    if _om_session_maker is None:
        raise RuntimeError("OpenMetadata database not initialized. Call init_engines() first.")
    
    async with _om_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def get_session_context():
    """
    Context manager for manual session management.
    
    Usage:
        async with get_session_context() as session:
            result = await session.execute(select(Model))
            return result.scalars().all()
    """
    async with get_thirdeye_session() as session:
        yield session


# Convenience function for getting a session (non-dependency)
def get_session() -> asynccontextmanager:
    """
    Get a session context manager for use outside of FastAPI dependencies.
    
    Usage:
        async with get_session() as session:
            result = await session.execute(select(...))
    """
    return get_session_context()

