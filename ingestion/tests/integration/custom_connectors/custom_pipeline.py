#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Custom Pipeline connector yielding a deterministic in-memory pipeline."""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import (
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.customPipelineConnection import (
    CustomPipelineConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata

PIPELINE_NAME = "my_daily_etl"

TASKS: list[tuple[str, str, list[str]]] = [
    ("extract", "Pull yesterday's orders from the source system", []),
    ("transform", "Aggregate orders into daily revenue", ["extract"]),
    ("load", "Write the aggregate to the reporting schema", ["transform"]),
]

# Fixed so the ingested status is reproducible across runs.
RUN_TIMESTAMP = 1700000000000
RUN_END_TIMESTAMP = 1700000300000


class CustomPipelineSource(Source):
    """Yields one pipeline with three chained tasks and one execution status."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomPipelineSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomPipelineConnection):
            raise InvalidSourceException(f"Expected CustomPipelineConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreatePipelineServiceRequest(
                name=service_name,
                serviceType=PipelineServiceType.CustomPipeline,
                connection=self.config.serviceConnection.root,
                displayName="Custom Pipeline Demo",
                description="Orchestrator served by the custom pipeline connector",
            )
        )
        yield Either(
            right=CreatePipelineRequest(
                name=PIPELINE_NAME,
                displayName="My Daily ETL",
                description="Pipeline produced by the custom pipeline connector",
                service=service_name,
                scheduleInterval="0 2 * * *",
                concurrency=1,
                sourceUrl=f"https://orchestrator.example.com/pipelines/{PIPELINE_NAME}",
                tasks=[
                    Task(
                        name=task_name,
                        displayName=task_name.title(),
                        description=task_description,
                        taskType="PythonOperator",
                        downstreamTasks=downstream,
                        sourceUrl=f"https://orchestrator.example.com/pipelines/{PIPELINE_NAME}/{task_name}",
                    )
                    for task_name, task_description, downstream in TASKS
                ],
            )
        )
        # Pipeline status is posted against a persisted pipeline.
        yield Either(right=Barrier(reason="pipeline must exist before its status"))
        yield Either(
            right=OMetaPipelineStatus(
                pipeline_fqn=f"{service_name}.{PIPELINE_NAME}",
                pipeline_status=PipelineStatus(
                    timestamp=Timestamp(RUN_TIMESTAMP),
                    executionStatus=StatusType.Successful,
                    endTime=Timestamp(RUN_END_TIMESTAMP),
                    taskStatus=[
                        TaskStatus(
                            name=task_name,
                            executionStatus=StatusType.Successful,
                            startTime=Timestamp(RUN_TIMESTAMP),
                            endTime=Timestamp(RUN_END_TIMESTAMP),
                        )
                        for task_name, _, _ in TASKS
                    ],
                ),
            )
        )
