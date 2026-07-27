"""
Dashboards entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.sdk.entities.base import BaseEntity


class Dashboards(BaseEntity[Dashboard, CreateDashboardRequest]):
    """Dashboards SDK class - plural to avoid conflict with generated Dashboard entity"""

    @classmethod
    def entity_type(cls) -> Type[Dashboard]:  # noqa: UP006
        """Return the Dashboard entity type"""
        return Dashboard
