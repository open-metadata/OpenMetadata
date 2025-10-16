"""
Insights Router - Detailed insights and reports by category
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Literal
from loguru import logger

from thirdeye.db import get_session

router = APIRouter(prefix="/api/v1/thirdeye/insights", tags=["insights"])


@router.get("/report")
async def get_insight_report(
    report_type: Literal["storage", "compute", "query", "other"] = Query(..., description="Type of insight report"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session)
):
    """
    Get insight report by type with pagination
    """
    try:
        logger.info(f"Fetching {report_type} insight report: limit={limit}, offset={offset}")
        
        # Customize query based on report type
        if report_type == "storage":
            where_clause = "WHERE COALESCE(SIZE_GB, 0) > 0"
            order_clause = "ORDER BY SIZE_GB DESC, monthly_cost_usd DESC"
        elif report_type == "compute":
            where_clause = "WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 0"
            order_clause = "ORDER BY ROLL_30D_TBL_QC DESC, ROLL_30D_TBL_UC DESC"
        elif report_type == "query":
            where_clause = "WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 0 OR COALESCE(days_since_access, 9999) <= 90"
            order_clause = "ORDER BY ROLL_30D_TBL_QC DESC, days_since_access ASC"
        elif report_type == "other":
            where_clause = "WHERE purge_score IS NOT NULL"
            order_clause = "ORDER BY purge_score DESC, days_since_access DESC"
        else:
            where_clause = ""
            order_clause = "ORDER BY monthly_cost_usd DESC"
        
        # Get total count
        count_query = text(f"""
            SELECT COUNT(*) as total_count 
            FROM v_table_purge_scores 
            {where_clause}
        """)
        
        count_result = await session.execute(count_query)
        count_row = count_result.fetchone()
        total_count = int(count_row.total_count if count_row else 0)
        
        # Get the actual data
        data_query = text(f"""
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
            {where_clause}
            {order_clause}
            LIMIT :limit OFFSET :offset
        """)
        
        result = await session.execute(data_query, {"limit": limit, "offset": offset})
        rows = result.fetchall()
        
        # Process tables
        tables = [
            {
                "FQN": row.FQN or "",
                "DATABASE_NAME": row.DATABASE_NAME or "",
                "DB_SCHEMA": row.DB_SCHEMA or "",
                "TABLE_NAME": row.TABLE_NAME or "",
                "SIZE_GB": float(row.SIZE_GB or 0),
                "days_since_access": int(row.days_since_access or 0),
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
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        current_page = offset // limit + 1
        
        response = {
            "tables": tables,
            "totalCount": total_count,
            "reportType": report_type,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "hasMore": has_more,
                "totalPages": total_pages,
                "currentPage": current_page
            }
        }
        
        logger.success(f"Fetched {len(tables)} tables for {report_type} insight report")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching insight report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch insight report: {str(e)}")


@router.get("/summary")
async def get_insight_summary(
    session: AsyncSession = Depends(get_session)
):
    """
    Get summary statistics for all report types
    """
    try:
        logger.info("Fetching insight summary statistics")
        
        summary_query = text("""
            SELECT 
                COUNT(*) as total_tables,
                SUM(CASE WHEN SIZE_GB > 0 THEN 1 ELSE 0 END) as storage_tables,
                SUM(CASE WHEN ROLL_30D_TBL_QC > 0 THEN 1 ELSE 0 END) as compute_tables,
                SUM(CASE WHEN ROLL_30D_TBL_QC > 0 OR days_since_access <= 90 THEN 1 ELSE 0 END) as query_tables,
                SUM(CASE WHEN purge_score IS NOT NULL THEN 1 ELSE 0 END) as other_tables,
                SUM(monthly_cost_usd) as total_monthly_cost,
                AVG(purge_score) as avg_purge_score,
                SUM(SIZE_GB) as total_size_gb
            FROM v_table_purge_scores
        """)
        
        result = await session.execute(summary_query)
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="No summary data found")
        
        summary = {
            "totalTables": int(row.total_tables or 0),
            "storageTables": int(row.storage_tables or 0),
            "computeTables": int(row.compute_tables or 0),
            "queryTables": int(row.query_tables or 0),
            "otherTables": int(row.other_tables or 0),
            "totalMonthlyCost": float(row.total_monthly_cost or 0),
            "avgPurgeScore": float(row.avg_purge_score or 0),
            "totalSizeGb": float(row.total_size_gb or 0)
        }
        
        logger.success("Insight summary fetched successfully")
        return summary
        
    except Exception as e:
        logger.error(f"Error fetching insight summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch insight summary: {str(e)}")

