"""ThirdEye database read-write repository.

This module provides functions to query and manipulate ThirdEye analytics data
in the dedicated thirdeye schema.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from loguru import logger
from decimal import Decimal


async def get_action_items_count(session: AsyncSession) -> int:
    """
    Get total count of action items in ThirdEye.
    
    Args:
        session: ThirdEye database session (read-write)
        
    Returns:
        Total number of action items
    """
    # Note: Table will be created by migrations in Phase 2
    # This is a placeholder for now
    try:
        result = await session.execute(
            text(f"SELECT COUNT(*) as count FROM {session.bind.url.database}.action_items")
        )
        row = result.fetchone()
        count = row[0] if row else 0
        logger.debug(f"Total action items in ThirdEye: {count}")
        return count
    except Exception as e:
        # Table might not exist yet
        logger.warning(f"Could not query action_items: {e}")
        return 0


async def get_health_metrics(session: AsyncSession) -> Optional[Dict[str, Any]]:
    """
    Get current data lake health metrics from v_datalake_health_metrics view.
    
    This view calculates:
    - Overall health score (ZI Score)
    - Component scores (utilization, storage efficiency, access freshness)
    - Breakdown percentages for UI display
    - Key metrics (tables, storage, costs, etc.)
    
    Args:
        session: ThirdEye database session
        
    Returns:
        Dictionary with health metrics, or None if view doesn't exist or has no data
    """
    try:
        query = text("""
            SELECT 
                health_score,
                health_status,
                utilization_rate,
                storage_efficiency,
                access_freshness,
                total_tables,
                active_tables,
                inactive_tables,
                total_storage_tb,
                waste_storage_tb,
                waste_percentage,
                total_monthly_cost_usd,
                monthly_savings_opportunity_usd,
                annual_savings_opportunity_usd,
                zombie_tables,
                zombie_percentage,
                stale_tables,
                stale_percentage,
                calculated_at
            FROM thirdeye.v_datalake_health_metrics
            LIMIT 1
        """)
        
        result = await session.execute(query)
        row = result.fetchone()
        
        logger.info(f"Query executed successfully. Row returned: {row is not None}")
        
        if not row:
            logger.warning("v_datalake_health_metrics returned no data")
            return None
        
        logger.info(f"Raw row data: {row}")
        
        # Convert row to dictionary with proper type handling
        def to_float(val: Any) -> float:
            """Convert Decimal/None to float."""
            if val is None:
                return 0.0
            if isinstance(val, Decimal):
                return float(val)
            return float(val)
        
        def to_int(val: Any) -> int:
            """Convert Decimal/None to int."""
            if val is None:
                return 0
            if isinstance(val, Decimal):
                return int(val)
            return int(val)
        
        # Calculate breakdown percentages from component scores
        # These represent how each component contributes to the overall score
        utilization = to_float(row[2])
        storage_eff = to_float(row[3])
        access_fresh = to_float(row[4])
        
        # Normalize to percentages that sum to 100
        total_score = utilization + storage_eff + access_fresh
        if total_score > 0:
            breakdown_storage = (storage_eff / total_score) * 100
            breakdown_compute = (utilization / total_score) * 100  
            breakdown_query = (access_fresh / total_score) * 100
            breakdown_others = 0  # For future use
        else:
            breakdown_storage = 25.0
            breakdown_compute = 25.0
            breakdown_query = 25.0
            breakdown_others = 25.0
        
        metrics = {
            "health_score": to_float(row[0]),
            "health_status": row[1] or "UNKNOWN",
            "utilization_rate": utilization,
            "storage_efficiency": storage_eff,
            "access_freshness": access_fresh,
            "breakdown_storage": breakdown_storage,
            "breakdown_compute": breakdown_compute,
            "breakdown_query": breakdown_query,
            "breakdown_others": breakdown_others,
            "total_tables": to_int(row[5]),
            "active_tables": to_int(row[6]),
            "inactive_tables": to_int(row[7]),
            "total_storage_tb": to_float(row[8]),
            "waste_storage_tb": to_float(row[9]),
            "waste_percentage": to_float(row[10]),
            "total_monthly_cost_usd": to_float(row[11]),
            "monthly_savings_opportunity_usd": to_float(row[12]),
            "annual_savings_opportunity_usd": to_float(row[13]),
            "zombie_tables": to_int(row[14]),
            "zombie_percentage": to_float(row[15]),
            "stale_tables": to_int(row[16]),
            "stale_percentage": to_float(row[17]),
            "calculated_at": row[18],
        }
        
        logger.info(f"✅ Retrieved health metrics: score={metrics['health_score']}, status={metrics['health_status']}, total_tables={metrics['total_tables']}, active_tables={metrics['active_tables']}")
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to query health metrics: {e}")
        return None


async def get_purge_scores(
    session: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    min_score: Optional[float] = None,
    recommendation: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Get table purge scores from v_table_purge_scores view.
    
    Args:
        session: ThirdEye database session
        limit: Maximum number of records to return
        offset: Number of records to skip
        min_score: Filter by minimum purge score
        recommendation: Filter by recommendation type (EXCELLENT_CANDIDATE, GOOD_CANDIDATE, etc.)
        
    Returns:
        List of dictionaries with purge score data
    """
    try:
        # Build query with filters
        where_clauses = []
        if min_score is not None:
            where_clauses.append(f"purge_score >= {min_score}")
        if recommendation:
            where_clauses.append(f"recommendation = '{recommendation}'")
        
        where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        query = text(f"""
            SELECT 
                FQN,
                DATABASE_NAME,
                DB_SCHEMA,
                TABLE_NAME,
                TABLE_TYPE,
                SIZE_GB,
                days_since_access,
                ROLL_30D_TBL_QC,
                ROLL_30D_TBL_UC,
                monthly_cost_usd,
                purge_score,
                recommendation,
                annual_savings_usd,
                size_score,
                access_staleness_score,
                usage_frequency_score,
                refresh_waste_score,
                user_engagement_score
            FROM thirdeye.v_table_purge_scores
            WHERE {where_clause}
            ORDER BY purge_score DESC, monthly_cost_usd DESC
            LIMIT {limit} OFFSET {offset}
        """)
        
        result = await session.execute(query)
        rows = result.fetchall()
        
        purge_scores = []
        for row in rows:
            purge_scores.append({
                "fqn": row[0],
                "database_name": row[1],
                "db_schema": row[2],
                "table_name": row[3],
                "table_type": row[4],
                "size_gb": float(row[5]) if row[5] else 0.0,
                "days_since_access": int(row[6]) if row[6] else None,
                "query_count_30d": int(row[7]) if row[7] else 0,
                "user_count_30d": int(row[8]) if row[8] else 0,
                "monthly_cost_usd": float(row[9]) if row[9] else 0.0,
                "purge_score": float(row[10]) if row[10] else 0.0,
                "recommendation": row[11],
                "annual_savings_usd": float(row[12]) if row[12] else 0.0,
                "size_score": float(row[13]) if row[13] else 0.0,
                "access_staleness_score": float(row[14]) if row[14] else 0.0,
                "usage_frequency_score": float(row[15]) if row[15] else 0.0,
                "refresh_waste_score": float(row[16]) if row[16] else 0.0,
                "user_engagement_score": float(row[17]) if row[17] else 0.0,
            })
        
        logger.debug(f"Retrieved {len(purge_scores)} purge scores")
        return purge_scores
        
    except Exception as e:
        logger.error(f"Failed to query purge scores: {e}")
        return []


# Future ThirdEye entity operations:
# - create_action_item()
# - update_action_item()
# - get_campaigns()
# - create_campaign()
# - get_zi_score_history()
# etc.
