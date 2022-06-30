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
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.airbyte_client import AirbyteClient
from metadata.utils.filters import filter_by_pipeline
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class AirbyteSourceStatus(SourceStatus):
    pipelines_scanned: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def pipeline_scanned(self, topic: str) -> None:
        self.pipelines_scanned.append(topic)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


STATUS_MAP = {
    "cancelled": StatusType.Failed,
    "succeeded": StatusType.Successful,
    "failed": StatusType.Failed,
    "running": StatusType.Pending,
    "incomplete": StatusType.Failed,
    "pending": StatusType.Pending,
}


class AirbyteSource(Source[CreatePipelineRequest]):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    config: WorkflowSource
    report: AirbyteSourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.source_config: PipelineServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection = self.config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(self.metadata_config)
        self.status = AirbyteSourceStatus()
        self.service: PipelineService = self.metadata.get_service_or_create(
            entity=PipelineService, config=config
        )

        self.client = AirbyteClient(self.service_connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AirbyteConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AirbyteConnection):
            raise InvalidSourceException(
                f"Expected AirbyteConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def get_connections_jobs(self, connection: dict, connection_url: str):
        """
        Returns the list of tasks linked to connection
        """
        return [
            Task(
                name=connection["connectionId"],
                displayName=connection["name"],
                description="",
                taskUrl=f"{connection_url}/status",
            )
        ]

    def fetch_pipeline(
        self, connection: dict, workspace: dict
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a Connection into a Pipeline Entity
        :param connection: connection object from airbyte
        :param connection: workspace object from airbyte
        :return: Create Pipeline request with tasks
        """
        connection_url = f"/workspaces/{workspace.get('workspaceId')}/connections/{connection.get('connectionId')}"
        yield CreatePipelineRequest(
            name=connection.get("connectionId"),
            displayName=connection.get("name"),
            description="",
            pipelineUrl=connection_url,
            tasks=self.get_connections_jobs(connection, connection_url),
            service=EntityReference(id=self.service.id, type="pipelineService"),
        )

    def fetch_pipeline_status(
        self, connection: dict, pipeline_fqn: str
    ) -> OMetaPipelineStatus:
        """
        Method to get task & pipeline status
        """
        for job in self.client.list_jobs(connection.get("connectionId")):
            if not job or not job.get("attempts"):
                continue
            for attempt in job["attempts"]:
                task_status = [
                    TaskStatus(
                        name=str(connection.get("connectionId")),
                        executionStatus=STATUS_MAP.get(
                            attempt["status"].lower(), StatusType.Pending
                        ).value,
                    )
                ]
                pipeline_status = PipelineStatus(
                    executionStatus=STATUS_MAP.get(
                        attempt["status"].lower(), StatusType.Pending
                    ).value,
                    taskStatus=task_status,
                    executionDate=attempt["createdAt"],
                )
                yield OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn, pipeline_status=pipeline_status
                )

    def fetch_lineage(
        self, connection: dict, pipeline_entity: Pipeline
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param connection: connection object from airbyte
        :param pipeline_entity: Pipeline we just ingested
        :return: Lineage from inlets and outlets
        """
        source_connection = self.client.get_source(connection.get("sourceId"))
        destination_connection = self.client.get_destination(
            connection.get("destinationId")
        )
        source_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=source_connection.get("name")
        )
        destination_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=destination_connection.get("name")
        )
        if not source_service or not destination_service:
            return

        for task in connection.get("syncCatalog", {}).get("streams") or []:
            stream = task.get("stream")
            from_fqn = fqn.build(
                self.metadata,
                Table,
                table_name=stream.get("name"),
                database_name=None,
                schema_name=stream.get("namespace"),
                service_name=source_connection.get("name"),
            )

            to_fqn = fqn.build(
                self.metadata,
                Table,
                table_name=stream.get("name"),
                database_name=None,
                schema_name=stream.get("namespace"),
                service_name=destination_connection.get("name"),
            )

            if not from_fqn and not to_fqn:
                continue

            from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
            to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
            yield AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=from_entity.id, type="table"),
                    toEntity=EntityReference(id=pipeline_entity.id, type="pipeline"),
                )
            )
            yield AddLineageRequest(
                edge=EntitiesEdge(
                    toEntity=EntityReference(id=to_entity.id, type="table"),
                    fromEntity=EntityReference(id=pipeline_entity.id, type="pipeline"),
                )
            )

    def next_record(self) -> Iterable[Entity]:
        """
        Extract metadata information to create Pipelines with Tasks
        """
        for workspace in self.client.list_workspaces():
            for connection in self.client.list_connections(
                workflow_id=workspace.get("workspaceId")
            ):
                try:
                    if filter_by_pipeline(
                        self.source_config.pipelineFilterPattern,
                        connection.get("connectionId"),
                    ):
                        continue
                    yield from self.fetch_pipeline(connection, workspace)
                    pipeline_fqn = fqn.build(
                        self.metadata,
                        entity_type=Pipeline,
                        service_name=self.service.name.__root__,
                        pipeline_name=connection.get("connectionId"),
                    )
                    yield from self.fetch_pipeline_status(connection, pipeline_fqn)
                    if self.source_config.includeLineage:
                        pipeline_entity: Pipeline = self.metadata.get_by_name(
                            entity=Pipeline,
                            fqn=pipeline_fqn,
                        )
                        yield from self.fetch_lineage(connection, pipeline_entity) or []

                except Exception as err:
                    logger.error(repr(err))
                    logger.debug(traceback.format_exc())
                    self.status.failure(connection.get("connectionId"), repr(err))

    def get_status(self):
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        pass
