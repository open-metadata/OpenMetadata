"""
Metrics entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Metric
from metadata.sdk.entities.base import BaseEntity


class Metrics(BaseEntity[Metric, CreateMetricRequest]):
    """Metrics SDK class - plural to avoid conflict with generated Metric entity"""

    @classmethod
    def entity_type(cls) -> Type[Metric]:
        """Return the Metric entity type"""
        return Metric
