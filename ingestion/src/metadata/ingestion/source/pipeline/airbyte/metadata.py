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

from typing import Iterable, Optional

from pydantic import BaseModel

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
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.ingestion.source.pipeline.openlineage.utils import FQNNotFoundException
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

from .utils import get_destination_table_details, get_source_table_details

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

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AirbyteConnection = config.serviceConnection.root.config
        if not isinstance(connection, AirbyteConnection):
            raise InvalidSourceException(
                f"Expected AirbyteConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(self, connection: dict, connection_url: str):
        """
        Returns the list of tasks linked to connection
        """
        return [
            Task(
                name=connection["connectionId"],
                displayName=connection["name"],
                sourceUrl=SourceUrl(f"{connection_url}/status"),
            )
        ]

    def yield_pipeline(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from airbyte
        :return: Create Pipeline request with tasks
        """
        connection_url = (
            f"{clean_uri(self.service_connection.hostPort)}/workspaces"
            f"/{pipeline_details.workspace.get('workspaceId')}"
            f"/connections/{pipeline_details.connection.get('connectionId')}"
        )
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.connection.get("connectionId")),
            displayName=pipeline_details.connection.get("name"),
            sourceUrl=SourceUrl(connection_url),
            tasks=self.get_connections_jobs(
                pipeline_details.connection, connection_url
            ),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def yield_pipeline_status(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Method to get task & pipeline status
        """

        # Airbyte does not offer specific attempt link, just at pipeline level
        log_link = (
            f"{self.service_connection.hostPort}workspaces/{pipeline_details.workspace.get('workspaceId')}"
            f"/connections/{pipeline_details.connection.get('connectionId')}/status"
        )

        for job in self.client.list_jobs(
            pipeline_details.connection.get("connectionId")
        ):
            if not job or not job.get("attempts"):
                continue
            for attempt in job["attempts"]:
                created_at = (
                    convert_timestamp_to_milliseconds(attempt["createdAt"])
                    if attempt.get("createdAt")
                    else None
                )
                ended_at = (
                    convert_timestamp_to_milliseconds(attempt["endedAt"])
                    if attempt.get("endedAt")
                    else None
                )
                task_status = [
                    TaskStatus(
                        name=str(pipeline_details.connection.get("connectionId")),
                        executionStatus=STATUS_MAP.get(
                            attempt["status"].lower(), StatusType.Pending
                        ).value,
                        startTime=created_at,
                        endTime=ended_at,
                        logLink=log_link,
                    )
                ]
                pipeline_status = PipelineStatus(
                    executionStatus=STATUS_MAP.get(
                        attempt["status"].lower(), StatusType.Pending
                    ).value,
                    taskStatus=task_status,
                    timestamp=Timestamp(created_at),
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

    def _get_table_fqn(self, table_details: TableDetails) -> Optional[str]:
        """
        Get the FQN of the table
        """
        try:
            if self.get_db_service_names():
                return self._get_table_fqn_from_om(table_details)

            return fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name="*",
                database_name=table_details.database,
                schema_name=table_details.schema,
                table_name=table_details.name,
            )
        except FQNNotFoundException:
            return None

    # pylint: disable=too-many-locals
    def yield_pipeline_lineage_details(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from airbyte
        :return: Lineage from inlets and outlets
        """
        pipeline_name = pipeline_details.connection.get("name")
        source_connection = self.client.get_source(
            pipeline_details.connection.get("sourceId")
        )
        destination_connection = self.client.get_destination(
            pipeline_details.connection.get("destinationId")
        )
        source_name = source_connection.get("sourceName")
        destination_name = destination_connection.get("destinationName")

        for task in (
            pipeline_details.connection.get("syncCatalog", {}).get("streams") or []
        ):
            stream = task.get("stream")

            source_table_details = get_source_table_details(stream, source_connection)
            destination_table_details = get_destination_table_details(
                stream, destination_connection
            )

            if not source_table_details or not destination_table_details:
                continue

            from_fqn = self._get_table_fqn(source_table_details)
            to_fqn = self._get_table_fqn(destination_table_details)

            if not from_fqn:
                logger.warning(
                    f"While extracting lineage: [{pipeline_name}],"
                    f" source table: [{source_table_details.database or '*'}]"
                    f".[{source_table_details.schema}].[{source_table_details.name}]"
                    f" (type: {source_name}) not found in openmetadata"
                )
                continue
            if not to_fqn:
                logger.warning(
                    f"While extracting lineage: [{pipeline_name}],"
                    f" destination table: [{destination_table_details.database or '*'}]"
                    f".[{destination_table_details.schema}].[{destination_table_details.name}]"
                    f" (type: {destination_name}) not found in openmetadata"
                )
                continue

            from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
            to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)

            if not from_entity:
                logger.warning(
                    f"While extracting lineage: [{pipeline_name}],"
                    f" source table (fqn: [{from_fqn}], type: {source_name}) not found"
                    " in openmetadata"
                )
                continue
            if not to_entity:
                logger.warning(
                    f"While extracting lineage: [{pipeline_name}],"
                    f" destination table (fqn: [{to_fqn}], type: {destination_name}) not found"
                    " in openmetadata"
                )
                continue

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )

            lineage_details = LineageDetails(
                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
                source=LineageSource.PipelineLineage,
            )

            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=from_entity.id, type="table"),
                        toEntity=EntityReference(id=to_entity.id, type="table"),
                        lineageDetails=lineage_details,
                    )
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
        return pipeline_details.connection.get("name")
