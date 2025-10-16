"""
Dashboard Router - Main dashboard metrics and data
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from loguru import logger

from thirdeye.db import get_session
from thirdeye.services.zi_score import ZIScoreService

router = APIRouter(prefix="/api/v1/thirdeye/dashboard", tags=["dashboard"])


@router.get("/data")
async def get_dashboard_data(
    session: AsyncSession = Depends(get_session)
):
    """
    Get main dashboard data including ZI Score, budget forecast, and metadata
    """
    try:
        logger.info("Fetching dashboard data from v_datalake_health_metrics")
        
        # Try to query from the main view first
        query = text("""
            SELECT
                health_score,
                total_tables,
                active_tables,
                inactive_percentage,
                total_monthly_cost_usd,
                monthly_savings_opportunity_usd,
                0 as roi,
                0 as breakdown_compute,
                health_score as breakdown_storage,
                0 as breakdown_query,
                0 as breakdown_others
            FROM v_datalake_health_metrics 
            LIMIT 1
        """)
        
        result = await session.execute(query)
        row = result.fetchone()
        
        if not row:
            logger.warning("No data found in v_datalake_health_metrics, falling back to health_score_history")
            # Fallback to health_score_history table
            fallback_query = text("""
                SELECT 
                    score as health_score,
                    0 as total_tables,
                    0 as active_tables,
                    0 as inactive_percentage,
                    0 as total_monthly_cost_usd,
                    0 as monthly_savings_opportunity_usd
                FROM health_score_history 
                ORDER BY captured_at DESC 
                LIMIT 1
            """)
            result = await session.execute(fallback_query)
            row = result.fetchone()
            
            if not row:
                logger.error("No dashboard data found in any source")
                raise HTTPException(status_code=404, detail="No dashboard data found")
            
            # Convert row to dict
            data = {
                "health_score": int(row.health_score or 0),
                "total_tables": 0,
                "active_tables": 0,
                "inactive_percentage": 0,
                "total_monthly_cost_usd": 0,
                "monthly_savings_opportunity_usd": 0,
                "roi": 0,
                "breakdown_compute": 0,
                "breakdown_storage": int(row.health_score or 0),
                "breakdown_query": 0,
                "breakdown_others": 0
            }
        else:
            # Convert row to dict
            data = {
                "health_score": int(row.health_score or 0),
                "total_tables": int(row.total_tables or 0),
                "active_tables": int(row.active_tables or 0),
                "inactive_percentage": float(row.inactive_percentage or 0),
                "total_monthly_cost_usd": float(row.total_monthly_cost_usd or 0),
                "monthly_savings_opportunity_usd": float(row.monthly_savings_opportunity_usd or 0),
                "roi": float(row.roi or 0),
                "breakdown_compute": int(row.breakdown_compute or 0),
                "breakdown_storage": int(row.breakdown_storage or 0),
                "breakdown_query": int(row.breakdown_query or 0),
                "breakdown_others": int(row.breakdown_others or 0)
            }
        
        # Format response
        response = {
            "ziScore": {
                "score": data["health_score"],
                "breakdown": {
                    "compute": data["breakdown_compute"],
                    "storage": data["breakdown_storage"],
                    "query": data["breakdown_query"],
                    "others": data["breakdown_others"]
                }
            },
            "budgetForecast": {
                "total_monthly_cost_usd": data["total_monthly_cost_usd"],
                "monthly_savings_opportunity_usd": data["monthly_savings_opportunity_usd"],
                "roi": data["roi"]
            },
            "metadata": {
                "total_tables": data["total_tables"],
                "active_tables": data["active_tables"],
                "inactive_percentage": data["inactive_percentage"]
            }
        }
        
        logger.success(f"Dashboard data fetched successfully: health_score={data['health_score']}")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard data: {str(e)}")


@router.get("/health-score-history")
async def get_health_score_history(
    days: int = 30,
    session: AsyncSession = Depends(get_session)
):
    """
    Get health score history for the last N days
    """
    try:
        logger.info(f"Fetching health score history for {days} days")
        
        query = text("""
            SELECT 
                id,
                captured_at,
                score,
                meta
            FROM health_score_history 
            ORDER BY captured_at DESC 
            LIMIT :days
        """)
        
        result = await session.execute(query, {"days": days})
        rows = result.fetchall()
        
        history = [
            {
                "id": row.id,
                "snapshot_date": row.captured_at.isoformat() if row.captured_at else None,
                "score": int(row.score),
                "meta": row.meta
            }
            for row in rows
        ]
        
        logger.success(f"Fetched {len(history)} health score history records")
        return history
        
    except Exception as e:
        logger.error(f"Error fetching health score history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch health score history: {str(e)}")


@router.get("/opportunity-campaigns")
async def get_opportunity_campaigns(
    status: Optional[str] = None,
    limit: int = 10,
    session: AsyncSession = Depends(get_session)
):
    """
    Get opportunity campaigns (if opportunity_campaigns table exists)
    """
    try:
        logger.info(f"Fetching opportunity campaigns: status={status}, limit={limit}")
        
        where_clause = f"WHERE status = '{status}'" if status else ""
        
        query = text(f"""
            SELECT 
                id,
                title,
                description,
                status,
                created_at,
                updated_at,
                meta
            FROM opportunity_campaigns 
            {where_clause}
            ORDER BY created_at DESC 
            LIMIT :limit
        """)
        
        result = await session.execute(query, {"limit": limit})
        rows = result.fetchall()
        
        campaigns = [
            {
                "id": row.id,
                "title": row.title,
                "description": row.description,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                "meta": row.meta
            }
            for row in rows
        ]
        
        logger.success(f"Fetched {len(campaigns)} opportunity campaigns")
        return campaigns
        
    except Exception as e:
        logger.warning(f"Error fetching opportunity campaigns (table may not exist): {e}")
        # Return empty array if table doesn't exist
        return []
