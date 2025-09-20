"""
Pipelines entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.sdk.entities.base import BaseEntity


class Pipelines(BaseEntity[Pipeline, CreatePipelineRequest]):
    """Pipelines SDK class - plural to avoid conflict with generated Pipeline entity"""

    @classmethod
    def entity_type(cls) -> Type[Pipeline]:
        """Return the Pipeline entity type"""
        return Pipeline
