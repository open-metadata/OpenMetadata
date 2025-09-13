"""
Pipeline entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline as PipelineEntity
from metadata.sdk.entities.base import BaseEntity


class Pipeline(BaseEntity[PipelineEntity, CreatePipelineRequest]):
    """
    Pipeline entity wrapper with static methods for CRUD operations.

    Example usage:
        # Create a pipeline
        create_request = CreatePipelineRequest(
            name="etl-daily-sales",
            service="airflow-prod",
            displayName="Daily Sales ETL",
            description="ETL pipeline for daily sales data"
        )
        pipeline = Pipeline.create(create_request)

        # Retrieve a pipeline
        pipeline = Pipeline.retrieve(pipeline_id)
        pipeline = Pipeline.retrieve_by_name("airflow-prod.etl-daily-sales")

        # Update a pipeline
        pipeline.description = "Updated ETL pipeline for sales data"
        updated = Pipeline.update(pipeline.id, pipeline)

        # Patch a pipeline
        patch = [
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "Tier.Tier1"}},
            {"op": "add", "path": "/owner", "value": {"id": "user-id", "type": "user"}}
        ]
        patched = Pipeline.patch(pipeline.id, patch)

        # Delete a pipeline
        Pipeline.delete(pipeline.id, recursive=True)

        # List pipelines with pagination
        pipelines = Pipeline.list(limit=20, after="cursor-string")
    """

    @classmethod
    def entity_type(cls) -> Type[PipelineEntity]:
        """Return the Pipeline entity type"""
        return PipelineEntity
