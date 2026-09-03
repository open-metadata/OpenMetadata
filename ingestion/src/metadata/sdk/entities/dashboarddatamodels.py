"""
DashboardDataModels entity SDK with fluent API
"""

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.sdk.entities.base import BaseEntity


class DashboardDataModels(BaseEntity[DashboardDataModel, CreateDashboardDataModelRequest]):
    """DashboardDataModels SDK class - plural to avoid conflict with generated DashboardDataModel entity"""

    @classmethod
    def entity_type(cls) -> type[DashboardDataModel]:
        """Return the DashboardDataModel entity type"""
        return DashboardDataModel
