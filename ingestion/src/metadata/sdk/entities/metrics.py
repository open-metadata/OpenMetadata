"""Metrics entity SDK."""
from __future__ import annotations

from typing import Any, Sequence, Type, cast

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Metric
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike


class Metrics(BaseEntity[Metric, CreateMetricRequest]):
    """SDK facade for metric entities."""

    @classmethod
    def entity_type(cls) -> Type[Metric]:
        return Metric

    @classmethod
    def add_related_metrics(
        cls, metric_id: UuidLike, related_metric_ids: Sequence[UuidLike]
    ) -> Metric:
        """Attach related metrics to the provided metric identifier."""

        if not related_metric_ids:
            return cls.retrieve(metric_id, fields=["relatedMetrics"])

        client = cls._get_client()
        current = client.get_by_id(
            entity=Metric,
            entity_id=cls._stringify_identifier(metric_id),
            fields=["relatedMetrics"],
        )

        working = getattr(current, "model_copy", None)
        working = working(deep=True) if callable(working) else current

        existing = list(getattr(working, "relatedMetrics", []) or [])
        for related_id in related_metric_ids:
            payload = {"id": cls._stringify_identifier(related_id)}
            existing.append(payload)
        setattr(working, "relatedMetrics", existing)

        updated = cast(Any, client).patch(
            entity=Metric,
            source=current,
            destination=working,
        )
        return cls._coerce_entity(updated)
