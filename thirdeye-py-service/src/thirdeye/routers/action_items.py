"""
Action Items API - CRUD operations for cost optimization recommendations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from thirdeye.db import get_thirdeye_session
from thirdeye.auth import get_current_user
from thirdeye.repo.te_write import ActionItemsRepository

router = APIRouter(prefix="/api/v1/thirdeye/action-items")


# Pydantic models for request/response
class ActionItemCreate(BaseModel):
    """Request model for creating an action item."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    category: str = Field(..., description="e.g., 'storage', 'compute', 'query'")
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")
    estimated_savings_usd: float = Field(default=0.0, ge=0)
    fqn: Optional[str] = Field(None, description="Fully qualified name of resource")
    metadata: Optional[Dict] = Field(default_factory=dict)


class ActionItemUpdate(BaseModel):
    """Request model for updating an action item."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(open|in_progress|completed|dismissed)$")
    priority: Optional[str] = Field(None, pattern="^(high|medium|low)$")
    decision: Optional[str] = None
    metadata: Optional[Dict] = None


class ActionItemResponse(BaseModel):
    """Response model for action item."""
    id: int
    title: str
    description: str
    category: str
    priority: str
    status: str
    estimated_savings_usd: float
    fqn: Optional[str]
    decision: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str
    metadata: Dict


@router.get("")
async def list_action_items(
    status: Optional[str] = Query(None, description="Filter by status: open, in_progress, completed, dismissed"),
    category: Optional[str] = Query(None, description="Filter by category: storage, compute, query, etc."),
    priority: Optional[str] = Query(None, description="Filter by priority: high, medium, low"),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    List action items with optional filtering and pagination.
    
    Returns:
        {
            "items": [...],
            "total": 42,
            "limit": 10,
            "offset": 0
        }
    """
    repo = ActionItemsRepository(db)
    
    items, total = await repo.list_action_items(
        status=status,
        category=category,
        priority=priority,
        limit=limit,
        offset=offset,
    )
    
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_action_item(
    data: ActionItemCreate,
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> ActionItemResponse:
    """
    Create a new action item.
    """
    repo = ActionItemsRepository(db)
    
    item = await repo.create_action_item(
        title=data.title,
        description=data.description,
        category=data.category,
        priority=data.priority,
        estimated_savings_usd=data.estimated_savings_usd,
        fqn=data.fqn,
        metadata=data.metadata,
        created_by=user.get("sub", "system"),
    )
    
    return item


@router.get("/{item_id}")
async def get_action_item(
    item_id: int,
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> ActionItemResponse:
    """
    Get a specific action item by ID.
    """
    repo = ActionItemsRepository(db)
    item = await repo.get_action_item(item_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action item {item_id} not found"
        )
    
    return item


@router.patch("/{item_id}")
async def update_action_item(
    item_id: int,
    data: ActionItemUpdate,
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> ActionItemResponse:
    """
    Update an existing action item.
    """
    repo = ActionItemsRepository(db)
    
    # Check if exists
    existing = await repo.get_action_item(item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action item {item_id} not found"
        )
    
    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    item = await repo.update_action_item(item_id, **update_data)
    
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(
    item_id: int,
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
):
    """
    Delete an action item.
    """
    repo = ActionItemsRepository(db)
    
    success = await repo.delete_action_item(item_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action item {item_id} not found"
        )
    
    return None


@router.get("/stats/summary")
async def get_action_items_stats(
    user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_thirdeye_session),
) -> Dict:
    """
    Get statistics about action items.
    
    Returns:
        {
            "total": 42,
            "by_status": {"open": 20, "in_progress": 10, "completed": 12},
            "by_priority": {"high": 15, "medium": 20, "low": 7},
            "total_potential_savings_usd": 125000.00
        }
    """
    repo = ActionItemsRepository(db)
    stats = await repo.get_stats()
    
    return stats

