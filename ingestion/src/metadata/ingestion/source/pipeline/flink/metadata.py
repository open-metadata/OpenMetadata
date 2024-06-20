#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Airbyte source to extract metadata
"""
import datetime
import traceback
from typing import Any, Iterable, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
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
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.flink.models import FlinkPipeline
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class FlinkSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Flink's REST API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: FlinkConnection = config.serviceConnection.root.config
        if not isinstance(connection, FlinkConnection):
            raise InvalidSourceException(
                f"Expected FlinkConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(self, pipeline_details: FlinkPipeline):
        """Returns the list of tasks linked to connection"""
        pipeline_info = self.client.get_pipeline_info(pipeline_details)
        tasks = pipeline_info.get("vertices", [])
        om_tasks = []
        for task in tasks:
            om_tasks.append(
                Task(
                    name=f"{task.get('name')}_{task.get('id')}",
                ),
            )
        return om_tasks

    def yield_pipeline(
        self, pipeline_details: FlinkPipeline
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from Flink
        :return: Create Pipeline request with tasks
        """
        pipeline_request = CreatePipelineRequest(
            name=pipeline_details.name,
            service=self.context.get().pipeline_service,
            sourceUrl=self.get_source_url(pipeline_details),
            tasks=self.get_connections_jobs(pipeline_details),
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def get_pipelines_list(self) -> Iterable[FlinkPipeline]:
        """Get List of all pipelines"""
        for pipeline in self.client.get_jobs():
            yield FlinkPipeline(**pipeline)

    def get_pipeline_name(self, pipeline_details: FlinkPipeline) -> str:
        return pipeline_details.name

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage between pipeline and data sources"""

    def yield_pipeline_status(
        self, pipeline_details: FlinkPipeline
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Method to get task & pipeline status"""

    def yield_pipeline_status(
        self, pipeline_details: FlinkPipeline
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:
            task_status = [
                TaskStatus(
                    name=str(task.get("id")),
                    executionStatus=task.get("status"),
                    startTime=Timestamp(
                        datetime_to_ts(
                            datetime.strptime(task.started_at, "%Y-%m-%d %H:%M:%S.%f%z")
                            if task.started_at
                            else datetime.now()
                        )
                    ),
                    endTime=Timestamp(
                        datetime_to_ts(
                            datetime.strptime(
                                task.finished_at, "%Y-%m-%d %H:%M:%S.%f%z"
                            )
                            if task.finished_at
                            else datetime.now()
                        )
                    ),
                )
                for task in self.client.get_pipeline_info(pipeline_details).get(
                    "vertices", []
                )
            ]

            pipeline_status = PipelineStatus(
                executionStatus=pipeline_details.state,
                taskStatus=task_status,
                timestamp=Timestamp(
                    datetime_to_ts(
                        datetime.strptime(
                            pipeline_details.created_at, "%Y-%m-%dT%H:%M:%S.%f%z"
                        )
                        if pipeline_details.created_at
                        else datetime.now()
                    )
                ),
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
            if pipeline_details.state.lower() == "finished":
                status = "completed"
            else:
                status = "running"
            return f"{self.client.config.hostPort}/#/job/{status}/{pipeline_details.id}/overview"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None
