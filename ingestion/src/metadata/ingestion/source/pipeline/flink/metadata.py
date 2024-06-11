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
import traceback
from typing import Any, Iterable, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.services.connections.pipeline.flinkConnection import (
    FlinkConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.flink.models import FlinkPipeline
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
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
        connection: FlinkConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, FlinkConnection):
            raise InvalidSourceException(
                f"Expected FlinkConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(self, pipeline_details: FlinkPipeline):
        """Returns the list of tasks linked to connection"""
        return [
            Task(
                name=pipeline_details.name,
            )
        ]

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
