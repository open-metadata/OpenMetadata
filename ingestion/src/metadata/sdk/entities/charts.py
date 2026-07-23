"""
Charts entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.sdk.entities.base import BaseEntity


class Charts(BaseEntity[Chart, CreateChartRequest]):
    """Charts SDK class - plural to avoid conflict with generated Chart entity"""

    @classmethod
    def entity_type(cls) -> Type[Chart]:  # noqa: UP006
        """Return the Chart entity type"""
        return Chart
