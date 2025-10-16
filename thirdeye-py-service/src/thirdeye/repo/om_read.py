"""
Read-only repository for OpenMetadata database.
Queries tables, databases, and usage data from OpenMetadata MySQL.
"""

from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from loguru import logger


class OpenMetadataRepository:
    """Read-only access to OpenMetadata database."""
    
    def __init__(self, om_session: AsyncSession):
        self.session = om_session
    
    async def get_table_count(self) -> int:
        """Get total number of tables in metadata catalog."""
        query = text("SELECT COUNT(*) FROM table_entity")
        result = await self.session.execute(query)
        count = result.scalar()
        logger.debug(f"Total tables in OM: {count}")
        return count or 0
    
    async def get_active_tables_count(self, days: int = 30) -> int:
        """
        Get count of tables accessed in last N days.
        
        Note: This is a placeholder query. Adjust based on actual OM schema.
        """
        # TODO: Update query based on actual OpenMetadata schema for usage tracking
        query = text("""
            SELECT COUNT(DISTINCT t.id)
            FROM table_entity t
            WHERE t.deleted_at IS NULL
        """)
        
        result = await self.session.execute(query)
        count = result.scalar()
        logger.debug(f"Active tables (last {days} days): {count}")
        return count or 0
    
    async def get_database_list(self, limit: int = 100) -> List[Dict]:
        """
        Get list of databases from OpenMetadata catalog.
        
        Returns:
            List of database dictionaries with id, name, service
        """
        query = text("""
            SELECT id, name, json
            FROM database_entity
            WHERE deleted_at IS NULL
            LIMIT :limit
        """)
        
        result = await self.session.execute(query, {"limit": limit})
        rows = result.fetchall()
        
        databases = [
            {
                "id": row[0],
                "name": row[1],
                # Parse JSON if needed: json.loads(row[2])
            }
            for row in rows
        ]
        
        logger.debug(f"Fetched {len(databases)} databases from OM")
        return databases
    
    async def get_table_by_fqn(self, fqn: str) -> Optional[Dict]:
        """
        Get table entity by Fully Qualified Name.
        
        Args:
            fqn: Fully qualified name like "snowflake.db.schema.table"
            
        Returns:
            Table dictionary or None if not found
        """
        query = text("""
            SELECT id, name, fqnHash, json
            FROM table_entity
            WHERE fullyQualifiedName = :fqn
            AND deleted_at IS NULL
            LIMIT 1
        """)
        
        result = await self.session.execute(query, {"fqn": fqn})
        row = result.fetchone()
        
        if not row:
            logger.debug(f"Table not found: {fqn}")
            return None
        
        return {
            "id": row[0],
            "name": row[1],
            "fqn_hash": row[2],
            # Parse JSON: json.loads(row[3])
        }
    
    async def get_storage_usage_summary(self) -> Dict:
        """
        Get storage usage summary across all tables.
        
        Returns:
            {
                "total_size_gb": 1234.56,
                "table_count": 1500,
                "avg_size_gb": 0.82
            }
        """
        # TODO: Update based on actual OM schema
        # This is a placeholder - adjust column names based on actual schema
        query = text("""
            SELECT 
                COUNT(*) as table_count,
                COALESCE(SUM(CAST(json_extract(json, '$.sizeInByte') AS DECIMAL) / 1024 / 1024 / 1024), 0) as total_size_gb
            FROM table_entity
            WHERE deleted_at IS NULL
        """)
        
        result = await self.session.execute(query)
        row = result.fetchone()
        
        if not row:
            return {"total_size_gb": 0, "table_count": 0, "avg_size_gb": 0}
        
        table_count = row[0] or 0
        total_size_gb = float(row[1] or 0)
        avg_size_gb = total_size_gb / table_count if table_count > 0 else 0
        
        return {
            "total_size_gb": round(total_size_gb, 2),
            "table_count": table_count,
            "avg_size_gb": round(avg_size_gb, 2),
        }

