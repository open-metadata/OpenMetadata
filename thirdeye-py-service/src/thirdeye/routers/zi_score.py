"""ZI Score REST API endpoints.

Provides comprehensive ZI Score metrics and related data:
- Overall health score
- Component breakdowns
- Purge score candidates
- Historical trends (future)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional

from thirdeye.db import get_om_session, get_te_session
from thirdeye.services.zi_score import ZIScoreService
from thirdeye.repo import te_write
from thirdeye.auth import get_current_user


router = APIRouter(prefix="/api/v1/thirdeye/zi-score", tags=["zi-score"])


@router.get("")
async def get_zi_score(
    om_session: AsyncSession = Depends(get_om_session),
    te_session: AsyncSession = Depends(get_te_session),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get current ZI Score with full breakdown.
    
    This endpoint returns:
    - Overall health score (0-100)
    - Component scores (storage, compute, query)
    - Breakdown percentages for UI gauge
    - Metadata (tables, storage, costs, savings opportunities)
    
    Requires authentication via JWT token from OpenMetadata.
    
    Returns:
        Complete ZI Score data structure
    """
    service = ZIScoreService(om_session, te_session)
    score = await service.calculate()
    return score


@router.get("/health-metrics")
async def get_health_metrics(
    te_session: AsyncSession = Depends(get_te_session),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get raw health metrics from v_datalake_health_metrics view.
    
    Provides access to the underlying metrics used to calculate ZI Score,
    useful for detailed analysis and debugging.
    
    Returns:
        Raw health metrics dictionary
    """
    metrics = await te_write.get_health_metrics(te_session)
    
    if not metrics:
        return {
            "error": "No health metrics available",
            "message": "Please ensure fact_datalake_table_usage_inventory has data."
        }
    
    return metrics


@router.get("/purge-candidates")
async def get_purge_candidates(
    te_session: AsyncSession = Depends(get_te_session),
    user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    min_score: Optional[float] = Query(None, ge=0, le=10, description="Minimum purge score"),
    recommendation: Optional[str] = Query(
        None,
        description="Filter by recommendation (EXCELLENT_CANDIDATE, GOOD_CANDIDATE, REVIEW_REQUIRED, KEEP)"
    ),
) -> Dict[str, Any]:
    """
    Get table purge score candidates.
    
    Returns tables ranked by purge score (0-10), which indicates
    how safe and beneficial it would be to delete or archive the table.
    
    Query Parameters:
        limit: Maximum results (1-1000, default 100)
        offset: Pagination offset (default 0)
        min_score: Filter for score >= value (0-10)
        recommendation: Filter by category
    
    Returns:
        List of tables with purge scores and recommendations
    """
    scores = await te_write.get_purge_scores(
        session=te_session,
        limit=limit,
        offset=offset,
        min_score=min_score,
        recommendation=recommendation,
    )
    
    return {
        "data": scores,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "count": len(scores),
        },
        "filters": {
            "min_score": min_score,
            "recommendation": recommendation,
        },
    }


@router.get("/summary")
async def get_zi_score_summary(
    om_session: AsyncSession = Depends(get_om_session),
    te_session: AsyncSession = Depends(get_te_session),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get summarized ZI Score data for dashboard display.
    
    Returns a condensed version of the ZI Score optimized for
    the ZIScoreGauge component and dashboard widgets.
    
    Returns:
        Simplified ZI Score summary
    """
    service = ZIScoreService(om_session, te_session)
    full_score = await service.calculate()
    
    # Extract just what the UI gauge needs
    summary = {
        "score": full_score["overall"],
        "status": full_score["status"],
        "breakdown": full_score["breakdown"],
        "trend": full_score["trend"],
        "savings": {
            "monthly": full_score["metadata"]["monthlySavingsOpportunityUSD"],
            "annual": full_score["metadata"]["annualSavingsOpportunityUSD"],
        },
        "alerts": {
            "zombie_tables": full_score["metadata"]["zombieTables"],
            "zombie_percentage": full_score["metadata"]["zombiePercentage"],
            "waste_storage_tb": full_score["metadata"]["wasteStorageTB"],
            "waste_percentage": full_score["metadata"]["wastePercentage"],
        },
    }
    
    return summary

