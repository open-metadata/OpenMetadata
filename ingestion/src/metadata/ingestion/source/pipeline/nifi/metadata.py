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
Nifi source to extract metadata
"""
import traceback
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from pydantic import BaseModel, ValidationError

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
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
PARENT_BREADCRUMB = "parentBreadcrumb"


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
    parent_pipeline_id: Optional[str] = None


class NifiSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.pipeline_parents_mapping: Dict[str, List[str]] = defaultdict(list)
        self.process_group_connections: List[NifiProcessorConnections] = []

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
                nifi_pipeline_details = NifiPipelineDetails(
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
                    parent_pipeline_id=process_group[PROCESS_GROUP_FLOW][BREADCRUMB]
                    .get(PARENT_BREADCRUMB, {})
                    .get("id"),
                )
                if nifi_pipeline_details.parent_pipeline_id:
                    self.pipeline_parents_mapping[nifi_pipeline_details.id_].append(
                        nifi_pipeline_details.parent_pipeline_id
                    )
                self.process_group_connections.extend(
                    self.get_process_group_connections(process_group)
                )
                yield nifi_pipeline_details
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

    def get_process_group_connections(
        self, process_group: dict
    ) -> List[NifiProcessorConnections]:
        """Get all connections for a process group"""
        connections_list = (
            process_group.get(PROCESS_GROUP_FLOW).get("flow").get("connections")
        )
        connections = []

        for connection in connections_list:
            try:
                source = connection.get("component", {}).get("source", {})
                destination = connection.get("component", {}).get("destination", {})
                if (
                    source.get("type") == "OUTPUT_PORT"
                    and destination.get("type") == "INPUT_PORT"
                    and source.get("groupId") != destination.get("groupId")
                ):
                    connections.append(
                        NifiProcessorConnections(
                            id_=connection.get("id"),
                            source_id=source.get("groupId"),
                            destination_id=destination.get("groupId"),
                        )
                    )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Wild error encountered when trying to get process group connections from \
                    {process_group[PROCESS_GROUP_FLOW][BREADCRUMB][BREADCRUMB].get('name')} - {err}."
                )
        return connections

    def yield_pipeline_bulk_lineage_details(
        self,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Process the pipeline bulk lineage details
        """
        # Process the lineage between parent and child pipelines
        for pipeline_id, parent_pipeline_ids in self.pipeline_parents_mapping.items():
            to_entity = self.metadata.get_by_name(
                entity=Pipeline,
                fqn=f"{self.context.get().pipeline_service}.{pipeline_id}",
            )
            if not to_entity:
                logger.warning(
                    f"Pipeline {pipeline_id} not found in metadata, skipping lineage"
                )
                continue
            for parent_pipeline_id in parent_pipeline_ids:
                from_entity = self.metadata.get_by_name(
                    entity=Pipeline,
                    fqn=f"{self.context.get().pipeline_service}.{parent_pipeline_id}",
                )
                if not from_entity:
                    logger.warning(
                        f"Parent Pipeline {parent_pipeline_id} not found in metadata, skipping lineage"
                    )
                    continue
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id, type="pipeline"
                            ),
                            toEntity=EntityReference(id=to_entity.id, type="pipeline"),
                            lineageDetails=LineageDetails(
                                source=LineageSource.PipelineLineage
                            ),
                        )
                    )
                )

        # Process the lineage between connected pipelines
        for connection in self.process_group_connections:
            from_entity = self.metadata.get_by_name(
                entity=Pipeline,
                fqn=f"{self.context.get().pipeline_service}.{connection.source_id}",
            )
            if not from_entity:
                logger.warning(
                    f"Pipeline {connection.source_id} not found in metadata, skipping lineage"
                )
                continue

            to_entity = self.metadata.get_by_name(
                entity=Pipeline,
                fqn=f"{self.context.get().pipeline_service}.{connection.destination_id}",
            )
            if not to_entity:
                logger.warning(
                    f"Pipeline {connection.destination_id} not found in metadata, skipping lineage"
                )
                continue

            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=from_entity.id, type="pipeline"),
                        toEntity=EntityReference(id=to_entity.id, type="pipeline"),
                        lineageDetails=LineageDetails(
                            source=LineageSource.PipelineLineage
                        ),
                    )
                )
            )

    def get_pipeline_name(self, pipeline_details: NifiPipelineDetails) -> str:
        return pipeline_details.name
