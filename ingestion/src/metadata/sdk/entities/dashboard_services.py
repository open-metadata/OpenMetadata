"""DashboardServices entity SDK."""
from __future__ import annotations

from typing import Type

from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.sdk.entities.base import BaseEntity


class DashboardServices(BaseEntity[DashboardService, CreateDashboardServiceRequest]):
    """Fluent facade for dashboard service operations."""

    @classmethod
    def entity_type(cls) -> Type[DashboardService]:
        return DashboardService
