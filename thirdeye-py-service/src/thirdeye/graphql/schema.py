"""Strawberry GraphQL schema definition.

This module defines the GraphQL API surface for ThirdEye analytics.
Provides ZI Score metrics via GraphQL with real data from database views.
"""

import strawberry
from typing import Optional
from strawberry.types import Info

from thirdeye.services.zi_score import ZIScoreService
from thirdeye.db import get_om_session, get_te_session


@strawberry.type
class ZIScoreBreakdown:
    """Component breakdown of ZI Score for UI gauge display."""
    storage: float
    compute: float
    query: float
    others: float


@strawberry.type
class ZIScoreMetadata:
    """Additional metadata about the health metrics."""
    total_tables: int
    active_tables: int
    inactive_tables: int
    total_storage_tb: float
    waste_storage_tb: float
    waste_percentage: float
    monthly_cost_usd: float
    monthly_savings_opportunity_usd: float
    annual_savings_opportunity_usd: float
    zombie_tables: int
    zombie_percentage: float
    stale_tables: int
    stale_percentage: float
    calculated_at: Optional[str]


@strawberry.type
class ZIScore:
    """
    ZI Score (Zero Intelligence Score) health metric.
    
    Calculated from v_datalake_health_metrics view:
    - Utilization Rate (40% weight): Active tables vs total
    - Storage Efficiency (35% weight): Active storage vs total
    - Access Freshness (25% weight): Recently accessed tables
    """
    overall: float
    storage_score: float
    query_score: float
    compute_score: float
    trend: str
    status: str
    breakdown: ZIScoreBreakdown
    metadata: ZIScoreMetadata


@strawberry.type
class Query:
    """Root GraphQL query type."""
    
    @strawberry.field
    async def zi_score(self, info: Info) -> ZIScore:
        """
        Get current ZI Score with real data from v_datalake_health_metrics.
        
        Returns:
            ZI Score with overall score, component scores, breakdown, and metadata
        """
        # Get database sessions
        # Note: In production, these would come from dependency injection
        # For GraphQL, we manually get the sessions
        from thirdeye.db import OMSessionLocal, TESessionLocal
        
        async with OMSessionLocal() as om_session, TESessionLocal() as te_session:
            # Create service and calculate score
            service = ZIScoreService(om_session, te_session)
            result = await service.calculate()
            
            # Convert to GraphQL types
            return ZIScore(
                overall=result["overall"],
                storage_score=result["storageScore"],
                query_score=result["queryScore"],
                compute_score=result["computeScore"],
                trend=result["trend"],
                status=result["status"],
                breakdown=ZIScoreBreakdown(
                    storage=result["breakdown"]["storage"],
                    compute=result["breakdown"]["compute"],
                    query=result["breakdown"]["query"],
                    others=result["breakdown"]["others"],
                ),
                metadata=ZIScoreMetadata(
                    total_tables=result["metadata"]["totalTables"],
                    active_tables=result["metadata"]["activeTables"],
                    inactive_tables=result["metadata"]["inactiveTables"],
                    total_storage_tb=result["metadata"]["totalStorageTB"],
                    waste_storage_tb=result["metadata"]["wasteStorageTB"],
                    waste_percentage=result["metadata"]["wastePercentage"],
                    monthly_cost_usd=result["metadata"]["monthlyCostUSD"],
                    monthly_savings_opportunity_usd=result["metadata"]["monthlySavingsOpportunityUSD"],
                    annual_savings_opportunity_usd=result["metadata"]["annualSavingsOpportunityUSD"],
                    zombie_tables=result["metadata"]["zombieTables"],
                    zombie_percentage=result["metadata"]["zombiePercentage"],
                    stale_tables=result["metadata"]["staleTables"],
                    stale_percentage=result["metadata"]["stalePercentage"],
                    calculated_at=result["metadata"]["calculatedAt"],
                ),
            )
    
    @strawberry.field
    def health(self) -> str:
        """Health check via GraphQL."""
        return "ok"


# Create Strawberry schema
schema = strawberry.Schema(query=Query)


# Future: Add Mutation type for createActionItem, updateCampaign, etc.
# @strawberry.type
# class Mutation:
#     @strawberry.mutation
#     def create_action_item(self, input: ActionItemInput) -> ActionItem:
#         ...

