"""
Metrics entity SDK with fluent API
"""
from typing import List, Type
from uuid import UUID

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.base import BaseEntity


class Metrics(BaseEntity[Metric, CreateMetricRequest]):
    """Metrics SDK class - plural to avoid conflict with generated Metric entity"""

    @classmethod
    def entity_type(cls) -> Type[Metric]:
        """Return the Metric entity type"""
        return Metric

    @classmethod
    def add_related_metrics(
        cls, metric_id: str, related_metric_ids: List[str]
    ) -> Metric:
        """
        Add related metrics to a metric.

        Args:
            metric_id: Metric UUID
            related_metric_ids: List of related metric UUIDs

        Returns:
            Updated metric
        """
        client = cls._get_client()

        # Get current metric
        metric = client.get_by_id(
            entity=Metric, entity_id=metric_id, fields=["relatedMetrics"]
        )

        # Create modified version with new related metrics
        modified_metric = metric.model_copy(deep=True)

        if modified_metric.relatedMetrics is None:
            modified_metric.relatedMetrics = []

        # Add new related metrics
        for related_id in related_metric_ids:
            # Parse UUID if it's a string
            if isinstance(related_id, str):
                try:
                    related_uuid = UUID(related_id)
                except ValueError:
                    raise ValueError(
                        f"Invalid UUID format for related metric: {related_id}"
                    )
            else:
                related_uuid = related_id

            # Check if not already related
            if not any(rm.id == related_uuid for rm in modified_metric.relatedMetrics):
                related_ref = EntityReference(id=related_uuid, type="metric")
                modified_metric.relatedMetrics.append(related_ref)

        # Apply patch using proper method signature
        return client.patch(entity=Metric, source=metric, destination=modified_metric)
