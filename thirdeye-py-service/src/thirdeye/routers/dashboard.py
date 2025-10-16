"""
Dashboard API endpoints for ZI Score and high-level metrics.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Optional
from datetime import datetime, timedelta

from thirdeye.db import get_thirdeye_session
from thirdeye.auth import get_current_user
from thirdeye.services.zi_score import ZIScoreService

router = APIRouter(prefix="/api/v1/thirdeye/dashboard")


@router.get("/zi-score")
async def get_zi_score(
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    Get current ZI Score and breakdown.
    
    ZI Score (Zero Inefficiency Score) measures data infrastructure health
    based on storage, compute, query efficiency, and other factors.
    
    Returns:
        {
            "score": 74,
            "breakdown": {
                "storage": 60,
                "compute": 15,
                "query": 10,
                "others": 15
            },
            "metadata": {
                "total_tables": 1500,
                "active_tables": 890,
                "inactive_percentage": 40.67
            },
            "timestamp": "2025-01-16T..."
        }
    """
    service = ZIScoreService(db)
    result = await service.calculate_zi_score()
    
    return {
        **result,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health-history")
async def get_health_history(
    days: int = Query(default=30, ge=1, le=365, description="Number of days of history"),
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    Get historical ZI Score data.
    
    Args:
        days: Number of days to fetch (1-365)
        
    Returns:
        {
            "data": [
                {"date": "2025-01-15", "score": 74, "status": "good"},
                {"date": "2025-01-14", "score": 72, "status": "good"},
                ...
            ],
            "summary": {
                "average_score": 73.5,
                "trend": "improving",
                "days": 30
            }
        }
    """
    service = ZIScoreService(db)
    history = await service.get_health_history(days=days)
    
    return history


@router.get("/budget-forecast")
async def get_budget_forecast(
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    Get budget forecast and savings opportunities.
    
    Returns:
        {
            "total_monthly_cost_usd": 45000.00,
            "monthly_savings_opportunity_usd": 12000.00,
            "roi": 26.67,
            "breakdown": {
                "storage": {"cost": 25000, "savings": 8000},
                "compute": {"cost": 15000, "savings": 3000},
                "query": {"cost": 5000, "savings": 1000}
            }
        }
    """
    service = ZIScoreService(db)
    forecast = await service.get_budget_forecast()
    
    return forecast


@router.get("/summary")
async def get_dashboard_summary(
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    Get complete dashboard summary (ZI Score + Budget + Stats).
    
    Combines multiple metrics into a single response for dashboard page.
    """
    service = ZIScoreService(db)
    
    # Fetch all metrics concurrently
    zi_score = await service.calculate_zi_score()
    budget = await service.get_budget_forecast()
    
    return {
        "zi_score": zi_score,
        "budget_forecast": budget,
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user.get("sub"),
    }

