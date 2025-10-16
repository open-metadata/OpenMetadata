"""
Read-write repository for ThirdEye database.
Manages action items, campaigns, cost tracking, etc.
"""

from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, and_, func
from datetime import datetime
from loguru import logger


class ActionItemsRepository:
    """Repository for action items CRUD operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def list_action_items(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> Tuple[List[Dict], int]:
        """
        List action items with filtering and pagination.
        
        Returns:
            Tuple of (items_list, total_count)
        """
        # Build WHERE clause
        where_conditions = ["1=1"]  # Always true
        params = {"limit": limit, "offset": offset}
        
        if status:
            where_conditions.append("status = :status")
            params["status"] = status
        
        if category:
            where_conditions.append("category = :category")
            params["category"] = category
        
        if priority:
            where_conditions.append("priority = :priority")
            params["priority"] = priority
        
        where_clause = " AND ".join(where_conditions)
        
        # Get total count
        count_query = text(f"""
            SELECT COUNT(*)
            FROM action_items
            WHERE {where_clause}
        """)
        
        count_result = await self.session.execute(count_query, params)
        total = count_result.scalar() or 0
        
        # Get items
        query = text(f"""
            SELECT 
                id, title, description, category, priority, status,
                estimated_savings_usd, fqn, decision, created_at, updated_at, created_by,
                metadata
            FROM action_items
            WHERE {where_clause}
            ORDER BY 
                CASE priority
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                END,
                created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        result = await self.session.execute(query, params)
        rows = result.fetchall()
        
        items = [
            {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": row[3],
                "priority": row[4],
                "status": row[5],
                "estimated_savings_usd": float(row[6] or 0),
                "fqn": row[7],
                "decision": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "created_by": row[11],
                "metadata": row[12] or {},
            }
            for row in rows
        ]
        
        logger.debug(f"Fetched {len(items)} action items (total: {total})")
        return items, total
    
    async def get_action_item(self, item_id: int) -> Optional[Dict]:
        """Get a single action item by ID."""
        query = text("""
            SELECT 
                id, title, description, category, priority, status,
                estimated_savings_usd, fqn, decision, created_at, updated_at, created_by,
                metadata
            FROM action_items
            WHERE id = :id
        """)
        
        result = await self.session.execute(query, {"id": item_id})
        row = result.fetchone()
        
        if not row:
            return None
        
        return {
            "id": row[0],
            "title": row[1],
            "description": row[2],
            "category": row[3],
            "priority": row[4],
            "status": row[5],
            "estimated_savings_usd": float(row[6] or 0),
            "fqn": row[7],
            "decision": row[8],
            "created_at": row[9],
            "updated_at": row[10],
            "created_by": row[11],
            "metadata": row[12] or {},
        }
    
    async def create_action_item(
        self,
        title: str,
        description: str,
        category: str,
        priority: str = "medium",
        estimated_savings_usd: float = 0.0,
        fqn: Optional[str] = None,
        metadata: Optional[Dict] = None,
        created_by: str = "system",
    ) -> Dict:
        """Create a new action item."""
        query = text("""
            INSERT INTO action_items (
                title, description, category, priority, status,
                estimated_savings_usd, fqn, metadata, created_by,
                created_at, updated_at
            )
            VALUES (
                :title, :description, :category, :priority, 'open',
                :estimated_savings_usd, :fqn, :metadata, :created_by,
                NOW(), NOW()
            )
        """)
        
        params = {
            "title": title,
            "description": description,
            "category": category,
            "priority": priority,
            "estimated_savings_usd": estimated_savings_usd,
            "fqn": fqn,
            "metadata": metadata or {},
            "created_by": created_by,
        }
        
        result = await self.session.execute(query, params)
        await self.session.commit()
        
        # Get the created item
        item_id = result.lastrowid
        logger.info(f"Created action item {item_id}: {title}")
        
        return await self.get_action_item(item_id)
    
    async def update_action_item(self, item_id: int, **kwargs) -> Dict:
        """Update an action item with provided fields."""
        # Build SET clause dynamically
        set_fields = []
        params = {"id": item_id, "updated_at": datetime.utcnow()}
        
        for key, value in kwargs.items():
            if value is not None:
                set_fields.append(f"{key} = :{key}")
                params[key] = value
        
        if not set_fields:
            # No updates
            return await self.get_action_item(item_id)
        
        set_fields.append("updated_at = :updated_at")
        set_clause = ", ".join(set_fields)
        
        query = text(f"""
            UPDATE action_items
            SET {set_clause}
            WHERE id = :id
        """)
        
        await self.session.execute(query, params)
        await self.session.commit()
        
        logger.info(f"Updated action item {item_id}")
        return await self.get_action_item(item_id)
    
    async def delete_action_item(self, item_id: int) -> bool:
        """Delete an action item."""
        query = text("""
            DELETE FROM action_items
            WHERE id = :id
        """)
        
        result = await self.session.execute(query, {"id": item_id})
        await self.session.commit()
        
        deleted = result.rowcount > 0
        if deleted:
            logger.info(f"Deleted action item {item_id}")
        
        return deleted
    
    async def get_stats(self) -> Dict:
        """Get statistics about action items."""
        query = text("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
                SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority,
                SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium_priority,
                SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low_priority,
                SUM(estimated_savings_usd) as total_potential_savings
            FROM action_items
        """)
        
        result = await self.session.execute(query)
        row = result.fetchone()
        
        return {
            "total": row[0] or 0,
            "by_status": {
                "open": row[1] or 0,
                "in_progress": row[2] or 0,
                "completed": row[3] or 0,
                "dismissed": row[4] or 0,
            },
            "by_priority": {
                "high": row[5] or 0,
                "medium": row[6] or 0,
                "low": row[7] or 0,
            },
            "total_potential_savings_usd": float(row[8] or 0),
        }

