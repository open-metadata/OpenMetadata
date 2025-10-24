"""Dashboard REST endpoints (optional - GraphQL is primary API).

These endpoints provide REST alternatives to GraphQL queries,
useful for simple health monitoring or debugging.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from thirdeye.db import get_om_session, get_te_session
from thirdeye.services.zi_score import ZIScoreService
from thirdeye.auth import get_current_user


router = APIRouter(prefix="/api/v1/thirdeye/dashboard", tags=["dashboard"])


@router.get("/zi-score")
async def get_zi_score(
    om_session: AsyncSession = Depends(get_om_session),
    te_session: AsyncSession = Depends(get_te_session),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get current ZI Score (REST endpoint).
    
    Requires authentication via JWT token from OpenMetadata.
    
    Returns:
        ZI Score breakdown with storage, compute, and query metrics
    """
    service = ZIScoreService(om_session, te_session)
    score = await service.calculate()
    return score
