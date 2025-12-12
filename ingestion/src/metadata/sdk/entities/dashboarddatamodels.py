"""
DashboardDataModels entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.sdk.entities.base import BaseEntity


class DashboardDataModels(
    BaseEntity[DashboardDataModel, CreateDashboardDataModelRequest]
):
    """DashboardDataModels SDK class - plural to avoid conflict with generated DashboardDataModel entity"""

    @classmethod
    def entity_type(cls) -> Type[DashboardDataModel]:
        """Return the DashboardDataModel entity type"""
        return DashboardDataModel
