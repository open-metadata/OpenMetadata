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

from metadata.clients.nifi_client import NifiClient
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.nifiConnection import (
    NifiConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


PROCESS_GROUP_FLOW = "processGroupFlow"
BREADCRUMB = "breadcrumb"


class NifiProcessor(BaseModel):
    """
    Processor (task) description to be ingested
    """

    id_: str
    name: Optional[str]
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
    name: Optional[str]
    uri: str
    processors: List[NifiProcessor]
    connections: List[NifiProcessorConnections]


class NifiSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.client: NifiClient = self.connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: NifiConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, NifiConnection):
            raise InvalidSourceException(
                f"Expected NifiConnection, but got {connection}"
            )
        return cls(config, metadata_config)

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
                    taskUrl=processor.uri.replace(self.service_connection.hostPort, ""),
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
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from Nifi
        :return: Create Pipeline request with tasks
        """
        yield CreatePipelineRequest(
            name=pipeline_details.id_,
            displayName=pipeline_details.name,
            pipelineUrl=pipeline_details.uri.replace(
                self.service_connection.hostPort, ""
            ),
            tasks=self._get_tasks_from_details(pipeline_details),
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
        )

    def yield_pipeline_status(
        self, pipeline_details: NifiPipelineDetails
    ) -> Optional[OMetaPipelineStatus]:
        """
        Method to get task & pipeline status.
        Based on the latest refresh data.
        https://github.com/open-metadata/OpenMetadata/issues/6955
        """
        logger.info("Pipeline Status is not yet supported on Nifi")

    def yield_pipeline_lineage_details(
        self, pipeline_details: NifiPipelineDetails
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from Nifi
        :return: Lineage request
        https://github.com/open-metadata/OpenMetadata/issues/6950
        """
        logger.info("Lineage is not yet supported on Nifi")

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
        """
        Get List of all pipelines
        """
        for process_group in self.client.list_process_groups():
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
        """
        Get Pipeline Name
        """
        return pipeline_details.name
