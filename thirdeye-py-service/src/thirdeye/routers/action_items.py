"""
Action Items Router - Cost optimization action items
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from loguru import logger

from thirdeye.db import get_session
from thirdeye.constants.action_items import (
    ACTION_ITEM_CATEGORIES,
    ACTION_ITEM_QUERY_MAPPINGS,
    SUMMARY_TILE_CONFIG
)

router = APIRouter(prefix="/api/v1/thirdeye/action-items", tags=["action-items"])


def convert_to_number(value) -> float:
    """Convert value to number for JSON serialization"""
    if value is None:
        return 0
    return float(value)


@router.get("")
async def get_action_items(
    session: AsyncSession = Depends(get_session)
):
    """
    Get all action items with real-time database data
    """
    try:
        logger.info("Fetching action items with real-time data")
        
        action_items_with_data = []
        
        # Execute all queries in parallel-like fashion
        for category in ACTION_ITEM_CATEGORIES:
            try:
                result = await session.execute(text(category["query"]))
                row = result.fetchone()
                data = {"count": row.count if row and row.count else 0, "cost": row.cost if row and row.cost else 0}
                
                action_items_with_data.append({
                    "id": category["id"],
                    "title": category["title"],
                    "description": category["description"],
                    "subtitle": category["subtitle"],
                    "icon": category["icon"],
                    "color": category["color"],
                    "cost": round(convert_to_number(data["cost"])),
                    "count": convert_to_number(data["count"]),
                    "savings": None,
                    "metadata": {
                        "type": category["category"],
                        "condition": category["query"],
                        "description": f"{category['description']} - {category['subtitle']}",
                        "action": category["action"],
                        "priority": category["priority"]
                    },
                    "category": category["category"],
                    "priority": category["priority"],
                    "action": category["action"],
                    "status": "pending"
                })
            except Exception as e:
                logger.error(f"Error executing query for {category['id']}: {e}")
                # Add item with zero values on error
                action_items_with_data.append({
                    "id": category["id"],
                    "title": category["title"],
                    "description": category["description"],
                    "subtitle": category["subtitle"],
                    "icon": category["icon"],
                    "color": category["color"],
                    "cost": 0,
                    "count": 0,
                    "savings": None,
                    "metadata": {
                        "type": category["category"],
                        "condition": category["query"],
                        "description": f"{category['description']} - {category['subtitle']}",
                        "action": category["action"],
                        "priority": category["priority"]
                    },
                    "category": category["category"],
                    "priority": category["priority"],
                    "action": category["action"],
                    "status": "pending"
                })
        
        # Calculate total potential savings
        try:
            result = await session.execute(text(SUMMARY_TILE_CONFIG["query"]))
            row = result.fetchone()
            total_potential_savings = round(convert_to_number(row.total_savings if row and row.total_savings else 0))
        except Exception as e:
            logger.error(f"Error calculating total potential savings: {e}")
            total_potential_savings = 0
        
        # Add summary tile
        summary_tile = {
            "id": SUMMARY_TILE_CONFIG["id"],
            "title": SUMMARY_TILE_CONFIG["title"],
            "description": SUMMARY_TILE_CONFIG["description"],
            "subtitle": SUMMARY_TILE_CONFIG["subtitle"],
            "icon": SUMMARY_TILE_CONFIG["icon"],
            "color": SUMMARY_TILE_CONFIG["color"],
            "cost": total_potential_savings,
            "count": 0,
            "savings": total_potential_savings,
            "metadata": {
                "type": SUMMARY_TILE_CONFIG["category"],
                "condition": SUMMARY_TILE_CONFIG["query"],
                "description": "Total monthly cost savings from all optimization actions",
                "action": SUMMARY_TILE_CONFIG["action"],
                "priority": SUMMARY_TILE_CONFIG["priority"]
            },
            "category": SUMMARY_TILE_CONFIG["category"],
            "priority": SUMMARY_TILE_CONFIG["priority"],
            "action": SUMMARY_TILE_CONFIG["action"],
            "status": "pending"
        }
        
        all_action_items = action_items_with_data + [summary_tile]
        
        response = {
            "actionItems": all_action_items,
            "totalItems": len(all_action_items),
            "pendingItems": len([item for item in all_action_items if item["status"] == "pending"]),
            "totalPotentialSavings": total_potential_savings
        }
        
        logger.success(f"Fetched {len(all_action_items)} action items")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching action items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch action items: {str(e)}")


@router.get("/by-category")
async def get_action_items_by_category(
    category: Optional[str] = Query(None, description="Category filter: table or summary"),
    priority: Optional[str] = Query(None, description="Priority filter: high, medium, low, info"),
    status: Optional[str] = Query(None, description="Status filter: pending, in_progress, completed"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get action items filtered by category, priority, or status
    """
    try:
        logger.info(f"Fetching filtered action items: category={category}, priority={priority}, status={status}")
        
        # Get all action items first
        all_items_response = await get_action_items(session)
        filtered_items = all_items_response["actionItems"]
        
        # Apply filters
        if category:
            filtered_items = [item for item in filtered_items if item["category"] == category]
        
        if priority:
            filtered_items = [item for item in filtered_items if item["priority"] == priority]
        
        if status:
            filtered_items = [item for item in filtered_items if item["status"] == status]
        
        return {
            "actionItems": filtered_items,
            "totalItems": len(filtered_items),
            "filters": {
                "category": category,
                "priority": priority,
                "status": status
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching filtered action items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch filtered action items: {str(e)}")


@router.get("/{action_item_id}")
async def get_action_item_by_id(
    action_item_id: str,
    session: AsyncSession = Depends(get_session)
):
    """
    Get a single action item by ID
    """
    try:
        logger.info(f"Fetching action item by ID: {action_item_id}")
        
        # Get all action items and find the requested one
        all_items_response = await get_action_items(session)
        item = next((item for item in all_items_response["actionItems"] if item["id"] == action_item_id), None)
        
        if not item:
            raise HTTPException(status_code=404, detail=f"Action item with id '{action_item_id}' not found")
        
        logger.success(f"Found action item: {action_item_id}")
        return item
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching action item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch action item: {str(e)}")


@router.get("/{action_item_id}/tables")
async def get_action_item_tables(
    action_item_id: str,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session)
):
    """
    Get detailed table list for a specific action item with pagination
    """
    try:
        logger.info(f"Fetching tables for action item: {action_item_id}, limit={limit}, offset={offset}")
        
        # Find the action item category
        action_item_category = next((cat for cat in ACTION_ITEM_CATEGORIES if cat["id"] == action_item_id), None)
        
        if not action_item_category:
            raise HTTPException(status_code=404, detail=f"Action item with id '{action_item_id}' not found")
        
        # Get the query mapping
        query_mapping = ACTION_ITEM_QUERY_MAPPINGS.get(action_item_id)
        
        if not query_mapping:
            raise HTTPException(status_code=404, detail=f"No query mapping found for action item '{action_item_id}'")
        
        # Build detail query
        detail_query = text(f"""
            SELECT 
                FQN,
                DATABASE_NAME,
                DB_SCHEMA,
                TABLE_NAME,
                COALESCE(SIZE_GB, 0) as SIZE_GB,
                COALESCE(days_since_access, 9999) as days_since_access,
                COALESCE(ROLL_30D_TBL_QC, 0) as ROLL_30D_TBL_QC,
                COALESCE(ROLL_30D_TBL_UC, 0) as ROLL_30D_TBL_UC,
                COALESCE(purge_score, 0) as purge_score,
                COALESCE(monthly_cost_usd, 0) as monthly_cost_usd,
                LAST_ACCESSED_DATE,
                LAST_REFRESHED_DATE
            FROM v_table_purge_scores 
            {query_mapping['whereClause']}
            {query_mapping['orderClause']}
            LIMIT :limit OFFSET :offset
        """)
        
        # Get count
        count_query = text(f"""
            SELECT COUNT(*) as total_count 
            FROM v_table_purge_scores 
            {query_mapping['whereClause']}
        """)
        
        # Execute both queries
        result = await session.execute(detail_query, {"limit": limit, "offset": offset})
        rows = result.fetchall()
        
        count_result = await session.execute(count_query)
        count_row = count_result.fetchone()
        total_count = int(count_row.total_count if count_row else 0)
        
        # Process tables
        tables = [
            {
                "FQN": row.FQN or "",
                "DATABASE_NAME": row.DATABASE_NAME or "",
                "DB_SCHEMA": row.DB_SCHEMA or "",
                "TABLE_NAME": row.TABLE_NAME or "",
                "SIZE_GB": convert_to_number(row.SIZE_GB),
                "days_since_access": int(row.days_since_access or 9999),
                "ROLL_30D_TBL_QC": int(row.ROLL_30D_TBL_QC or 0),
                "ROLL_30D_TBL_UC": int(row.ROLL_30D_TBL_UC or 0),
                "purge_score": float(row.purge_score or 0),
                "monthly_cost_usd": float(row.monthly_cost_usd or 0),
                "LAST_ACCESSED_DATE": row.LAST_ACCESSED_DATE.isoformat() if row.LAST_ACCESSED_DATE else None,
                "LAST_REFRESHED_DATE": row.LAST_REFRESHED_DATE.isoformat() if row.LAST_REFRESHED_DATE else None
            }
            for row in rows
        ]
        
        has_more = (offset + limit) < total_count
        
        response = {
            "tables": tables,
            "totalCount": total_count,
            "hasMore": has_more,
            "actionItem": {
                "id": action_item_id,
                "title": action_item_category["title"],
                "description": action_item_category["description"],
                "subtitle": action_item_category["subtitle"],
                "category": action_item_category["category"],
                "priority": action_item_category["priority"],
                "action": action_item_category["action"]
            }
        }
        
        logger.success(f"Fetched {len(tables)} tables for action item: {action_item_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching action item tables: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch action item tables: {str(e)}")
