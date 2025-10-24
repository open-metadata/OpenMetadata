"""Strawberry GraphQL schema definition.

This module defines the GraphQL API surface for ThirdEye analytics.
Phase 1: Placeholder schema
Phase 3: Full implementation with queries, mutations, and types.
"""

import strawberry
from typing import Optional


@strawberry.type
class ZIScore:
    """ZI Score health metric."""
    overall: float
    storage_score: float
    query_score: float
    compute_score: float
    trend: str


@strawberry.type
class Query:
    """Root GraphQL query type."""
    
    @strawberry.field
    def zi_score(self) -> ZIScore:
        """Get current ZI Score (placeholder)."""
        return ZIScore(
            overall=75.5,
            storage_score=80.0,
            query_score=76.5,
            compute_score=70.0,
            trend="improving",
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

