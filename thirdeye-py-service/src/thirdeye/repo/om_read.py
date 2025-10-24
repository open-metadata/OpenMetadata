"""OpenMetadata database read-only repository.

This module provides functions to query OpenMetadata entities
from the core database (read-only access).
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from loguru import logger


async def get_table_count(session: AsyncSession) -> int:
    """
    Get total count of tables in OpenMetadata.
    
    Args:
        session: OpenMetadata database session (read-only)
        
    Returns:
        Total number of tables
    """
    result = await session.execute(
        text("SELECT COUNT(*) as count FROM table_entity")
    )
    row = result.fetchone()
    count = row[0] if row else 0
    logger.debug(f"Total tables in OpenMetadata: {count}")
    return count


async def get_database_count(session: AsyncSession) -> int:
    """
    Get total count of databases in OpenMetadata.
    
    Args:
        session: OpenMetadata database session (read-only)
        
    Returns:
        Total number of databases
    """
    result = await session.execute(
        text("SELECT COUNT(*) as count FROM database_entity")
    )
    row = result.fetchone()
    count = row[0] if row else 0
    logger.debug(f"Total databases in OpenMetadata: {count}")
    return count


# Placeholder for future OM entity queries
# Add more functions as needed:
# - get_table_by_fqn()
# - get_database_by_id()
# - get_users_by_team()
# etc.
