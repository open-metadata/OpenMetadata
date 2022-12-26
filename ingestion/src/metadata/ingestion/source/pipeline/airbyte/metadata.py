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

from typing import Iterable, Optional

from pydantic import BaseModel

from metadata.clients.airbyte_client import AirbyteClient
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
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
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


STATUS_MAP = {
    "cancelled": StatusType.Failed,
    "succeeded": StatusType.Successful,
    "failed": StatusType.Failed,
    "running": StatusType.Pending,
    "incomplete": StatusType.Failed,
    "pending": StatusType.Pending,
}


class AirbytePipelineDetails(BaseModel):
    """
    Wrapper Class to combine the workspace with connection
    """

    workspace: dict
    connection: dict


class AirbyteSource(PipelineServiceSource):
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

    def yield_pipeline(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from airbyte
        :return: Create Pipeline request with tasks
        """
        connection_url = (
            f"/workspaces/{pipeline_details.workspace.get('workspaceId')}"
            f"/connections/{pipeline_details.connection.get('connectionId')}"
        )
        yield CreatePipelineRequest(
            name=pipeline_details.connection.get("connectionId"),
            displayName=pipeline_details.connection.get("name"),
            description="",
            pipelineUrl=connection_url,
            tasks=self.get_connections_jobs(
                pipeline_details.connection, connection_url
            ),
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
        )

    def yield_pipeline_status(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Optional[OMetaPipelineStatus]:
        """
        Method to get task & pipeline status
        """

        # Airbyte does not offer specific attempt link, just at pipeline level
        log_link = (
            f"{self.service_connection.hostPort}/workspaces/{pipeline_details.workspace.get('workspaceId')}"
            f"/connections/{pipeline_details.connection.get('connectionId')}/status"
        )

        for job in self.client.list_jobs(
            pipeline_details.connection.get("connectionId")
        ):
            if not job or not job.get("attempts"):
                continue
            for attempt in job["attempts"]:

                task_status = [
                    TaskStatus(
                        name=str(pipeline_details.connection.get("connectionId")),
                        executionStatus=STATUS_MAP.get(
                            attempt["status"].lower(), StatusType.Pending
                        ).value,
                        startTime=attempt.get("createdAt"),
                        endTime=attempt.get("endedAt"),
                        logLink=log_link,
                    )
                ]
                pipeline_status = PipelineStatus(
                    executionStatus=STATUS_MAP.get(
                        attempt["status"].lower(), StatusType.Pending
                    ).value,
                    taskStatus=task_status,
                    timestamp=attempt["createdAt"],
                )
                yield OMetaPipelineStatus(
                    pipeline_fqn=self.context.pipeline.fullyQualifiedName.__root__,
                    pipeline_status=pipeline_status,
                )

    def yield_pipeline_lineage_details(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from airbyte
        :return: Lineage from inlets and outlets
        """
        source_connection = self.client.get_source(
            pipeline_details.connection.get("sourceId")
        )
        destination_connection = self.client.get_destination(
            pipeline_details.connection.get("destinationId")
        )
        source_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=source_connection.get("name")
        )
        destination_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=destination_connection.get("name")
        )
        if not source_service or not destination_service:
            return

        for task in (
            pipeline_details.connection.get("syncCatalog", {}).get("streams") or []
        ):
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

            from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
            to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)

            if not from_entity and not to_entity:
                continue

            lineage_details = LineageDetails(
                pipeline=EntityReference(
                    id=self.context.pipeline.id.__root__, type="pipeline"
                )
            )

            yield AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=from_entity.id, type="table"),
                    toEntity=EntityReference(id=to_entity.id, type="table"),
                    lineageDetails=lineage_details,
                )
            )

    def get_pipelines_list(self) -> Iterable[AirbytePipelineDetails]:
        """
        Get List of all pipelines
        """
        for workspace in self.client.list_workspaces():
            for connection in self.client.list_connections(
                workflow_id=workspace.get("workspaceId")
            ):
                yield AirbytePipelineDetails(workspace=workspace, connection=connection)

    def get_pipeline_name(self, pipeline_details: AirbytePipelineDetails) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details.connection.get("connectionId")
