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
Nifi source to extract metadata
"""
import traceback
from typing import Iterable, List, Optional

from pydantic import BaseModel, ValidationError

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.services.connections.pipeline.nifiConnection import (
    NifiConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


PROCESS_GROUP_FLOW = "processGroupFlow"
BREADCRUMB = "breadcrumb"


class NifiProcessor(BaseModel):
    """
    Processor (task) description to be ingested
    """

    id_: str
    name: Optional[str] = None
    type_: str
    uri: str


class NifiProcessorConnections(BaseModel):
    """
    Describes connections between components
    connections.[components].source|destination
    """

    id_: str
    source_id: str
    destination_id: str


class NifiPipelineDetails(BaseModel):
    """
    Defines the necessary Nifi information
    """

    id_: str
    name: Optional[str] = None
    uri: str
    processors: List[NifiProcessor]
    connections: List[NifiProcessorConnections]


class NifiSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: NifiConnection = config.serviceConnection.root.config
        if not isinstance(connection, NifiConnection):
            raise InvalidSourceException(
                f"Expected NifiConnection, but got {connection}"
            )
        return cls(config, metadata)

    @staticmethod
    def _get_downstream_tasks_from(
        source_id: str, connections: List[NifiProcessorConnections]
    ) -> List[str]:
        """
        Fetch all tasks downstream from the source
        """
        return [
            conn.destination_id for conn in connections if conn.source_id == source_id
        ]

    def _get_tasks_from_details(
        self, pipeline_details: NifiPipelineDetails
    ) -> Optional[List[Task]]:
        """
        Prepare the list of the related Tasks
        that form the Pipeline
        """
        try:
            return [
                Task(
                    name=processor.id_,
                    displayName=processor.name,
                    sourceUrl=SourceUrl(
                        f"{clean_uri(self.service_connection.hostPort)}{processor.uri}"
                    ),
                    taskType=processor.type_,
                    downstreamTasks=self._get_downstream_tasks_from(
                        source_id=processor.id_,
                        connections=pipeline_details.connections,
                    ),
                )
                for processor in pipeline_details.processors
            ]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Wild error encountered when trying to get tasks from Pipeline Details {pipeline_details} - {err}."
            )
        return None

    def yield_pipeline(
        self, pipeline_details: NifiPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from Nifi
        :return: Create Pipeline request with tasks
        """
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.id_),
            displayName=pipeline_details.name,
            sourceUrl=SourceUrl(
                f"{clean_uri(self.service_connection.hostPort)}{pipeline_details.uri}"
            ),
            tasks=self._get_tasks_from_details(pipeline_details),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def yield_pipeline_status(
        self, pipeline_details: NifiPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Method to get task & pipeline status.
        Based on the latest refresh data.
        https://github.com/open-metadata/OpenMetadata/issues/6955
        """

    def yield_pipeline_lineage_details(
        self, pipeline_details: NifiPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from Nifi
        :return: Lineage request
        https://github.com/open-metadata/OpenMetadata/issues/6950
        """

    @staticmethod
    def _get_connections_from_process_group(
        process_group: dict,
    ) -> List[NifiProcessorConnections]:
        """
        Parse the process_group dictionary to pick up the Connections
        """
        connections_list = (
            process_group.get(PROCESS_GROUP_FLOW).get("flow").get("connections")
        )

        return [
            NifiProcessorConnections(
                id_=connection.get("id"),
                source_id=connection["component"]["source"]["id"],
                destination_id=connection["component"]["destination"]["id"],
            )
            for connection in connections_list
        ]

    @staticmethod
    def _get_processors_from_process_group(process_group: dict) -> List[NifiProcessor]:
        """
        Parse the process_group dictionary to pick up the Processors
        """
        processor_list = (
            process_group.get(PROCESS_GROUP_FLOW).get("flow").get("processors")
        )

        return [
            NifiProcessor(
                id_=processor.get("id"),
                uri=processor.get("uri"),
                name=processor["component"].get("name"),
                type_=processor["component"].get("type"),
            )
            for processor in processor_list
        ]

    def get_pipelines_list(self) -> Iterable[NifiPipelineDetails]:
        """Get List of all pipelines"""
        for process_group in self.connection.list_process_groups():
            try:
                yield NifiPipelineDetails(
                    id_=process_group[PROCESS_GROUP_FLOW].get("id"),
                    name=process_group[PROCESS_GROUP_FLOW][BREADCRUMB][BREADCRUMB].get(
                        "name"
                    ),
                    uri=process_group[PROCESS_GROUP_FLOW].get("uri"),
                    processors=self._get_processors_from_process_group(
                        process_group=process_group
                    ),
                    connections=self._get_connections_from_process_group(
                        process_group=process_group
                    ),
                )
            except (ValueError, KeyError, ValidationError) as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Cannot create NifiPipelineDetails from {process_group} - {err}"
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Wild error encountered when trying to get pipelines from Process Group {process_group} - {err}."
                )

    def get_pipeline_name(self, pipeline_details: NifiPipelineDetails) -> str:
        return pipeline_details.name
