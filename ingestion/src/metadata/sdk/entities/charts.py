"""
Charts entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.sdk.entities.base import BaseEntity


class Charts(BaseEntity[Chart, CreateChartRequest]):
    """Charts SDK class - plural to avoid conflict with generated Chart entity"""

    @classmethod
    def entity_type(cls) -> Type[Chart]:
        """Return the Chart entity type"""
        return Chart
