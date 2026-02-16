"""
Pipelines entity SDK with fluent API
"""
from typing import Any, List, Optional, Type, cast

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.sdk.entities.base import BaseEntity


class Pipelines(BaseEntity[Pipeline, CreatePipelineRequest]):
    """Pipelines SDK class - plural to avoid conflict with generated Pipeline entity"""

    @classmethod
    def entity_type(cls) -> Type[Pipeline]:
        """Return the Pipeline entity type"""
        return Pipeline

    @classmethod
    def add_pipeline_status(cls, fqn: str, status: PipelineStatus) -> Pipeline:
        """Add a single pipeline execution status."""
        client = cls._get_client()
        result = cast(Any, client).add_pipeline_status(fqn=fqn, status=status)
        return cls._coerce_entity(result)

    @classmethod
    def add_bulk_pipeline_status(
        cls, fqn: str, statuses: List[PipelineStatus]
    ) -> Pipeline:
        """Add multiple pipeline execution statuses in a single bulk request."""
        client = cls._get_client()
        result = cast(Any, client).add_bulk_pipeline_status(fqn=fqn, statuses=statuses)
        return cls._coerce_entity(result)

    @classmethod
    def list_pipeline_statuses(
        cls,
        fqn: str,
        start_ts: int,
        end_ts: int,
        limit: Optional[int] = None,
    ) -> List[PipelineStatus]:
        """List pipeline execution statuses within a time range."""
        client = cls._get_client()
        return cast(Any, client).list_pipeline_statuses(
            fqn=fqn, start_ts=start_ts, end_ts=end_ts, limit=limit
        )
