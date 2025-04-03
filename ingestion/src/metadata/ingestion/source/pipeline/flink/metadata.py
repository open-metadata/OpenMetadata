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
"""
Airbyte source to extract metadata
"""
import traceback
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.flinkConnection import (
    FlinkConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
    Timestamp,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.flink.models import FlinkPipeline
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TASK_STATUS_MAP = {
    "RUNNING": StatusType.Pending,
    "FAILED": StatusType.Failed,
    "CANCELED": StatusType.Failed,
}


class FlinkSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Flink's REST API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: FlinkConnection = config.serviceConnection.root.config
        if not isinstance(connection, FlinkConnection):
            raise InvalidSourceException(
                f"Expected FlinkConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(
        self, pipeline_details: FlinkPipeline
    ) -> Optional[List[Task]]:
        """Returns the list of tasks linked to connection"""
        pipeline_info = self.client.get_pipeline_info(pipeline_details.id)
        return [
            Task(
                name=f"{task.name}_{task.id}",
            )
            for task in pipeline_info.tasks
        ]

    def yield_pipeline(
        self, pipeline_details: FlinkPipeline
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from Flink
        :return: Create Pipeline request with tasks
        """
        try:
            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                sourceUrl=SourceUrl(self.get_source_url(pipeline_details)),
                tasks=self.get_connections_jobs(pipeline_details),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except TypeError as err:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Error to yield pipeline for {pipeline_details}: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[FlinkPipeline]:
        """Get List of all pipelines"""
        for pipeline in self.client.get_jobs().pipelines:
            yield pipeline

    def get_pipeline_name(self, pipeline_details: FlinkPipeline) -> str:
        return pipeline_details.name

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage between pipeline and data sources"""

    def yield_pipeline_status(
        self, pipeline_details: FlinkPipeline
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:
            task_status = []
            for task in self.client.get_pipeline_info(pipeline_details.id).tasks:
                task_status.append(
                    TaskStatus(
                        name=f"{task.name}_{task.id}",
                        executionStatus=TASK_STATUS_MAP.get(task.status),
                        startTime=Timestamp(task.start_time),
                        endTime=Timestamp(task.end_time),
                    )
                )

            pipeline_status = PipelineStatus(
                executionStatus=StatusType.Successful,
                taskStatus=task_status,
                timestamp=Timestamp(pipeline_details.start_time),
            )

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            yield Either(
                right=OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn,
                    pipeline_status=pipeline_status,
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline status {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_source_url(self, pipeline_details: FlinkPipeline) -> Optional[str]:
        try:
            pipeline_status = pipeline_details.state.lower()
            url_status = None
            if pipeline_status == "finished" or pipeline_status == "failed":
                url_status = "completed"
            elif pipeline_status == "running":
                url_status = "running"

            if url_status:
                return f"{self.client.config.hostPort}/#/job/{url_status}/{pipeline_details.id}/overview"
            return f"{self.client.config.hostPort}/#/overview"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None
