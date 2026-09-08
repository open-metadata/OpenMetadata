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

from collections.abc import Iterable
from datetime import datetime, timezone

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
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient
from metadata.ingestion.source.pipeline.airbyte.models import (
    AirbyteConnectionModel,
    AirbyteStream,
    AirbyteWorkspace,
)
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.ingestion.source.pipeline.openlineage.utils import FQNNotFoundException
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

from .resolvers import DESTINATION, SOURCE, get_resolver  # noqa: TID252

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

    workspace: AirbyteWorkspace
    connection: AirbyteConnectionModel


class AirbyteSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    def __init__(self, config, metadata):
        super().__init__(config, metadata)

        if isinstance(self.client, AirbyteCloudClient):
            self.airbyte_cloud = True
            self.source_url_prefix = "https://cloud.airbyte.com"
        else:
            self.airbyte_cloud = False
            self.source_url_prefix = clean_uri(self.service_connection.hostPort)

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AirbyteConnection = config.serviceConnection.root.config
        if not isinstance(connection, AirbyteConnection):
            raise InvalidSourceException(f"Expected AirbyteConnection, but got {connection}")
        return cls(config, metadata)

    def get_connections_jobs(self, connection: AirbyteConnectionModel, connection_url: str):
        """
        Returns the list of tasks linked to connection
        """
        return [
            Task(
                name=connection.connectionId,
                displayName=connection.name,
                sourceUrl=SourceUrl(f"{connection_url}/status"),
            )
        ]

    def yield_pipeline(self, pipeline_details: AirbytePipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from airbyte
        :return: Create Pipeline request with tasks
        """
        connection_url = (
            f"{self.source_url_prefix}/workspaces"
            f"/{pipeline_details.workspace.workspaceId}"
            f"/connections/{pipeline_details.connection.connectionId}"
        )
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.connection.connectionId),
            displayName=pipeline_details.connection.name,
            sourceUrl=SourceUrl(connection_url),
            tasks=self.get_connections_jobs(pipeline_details.connection, connection_url),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def yield_pipeline_status(self, pipeline_details: AirbytePipelineDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Method to get task & pipeline status
        """
        if self.airbyte_cloud:
            yield from self._yield_pipeline_status_cloud(pipeline_details)
            return

        log_link = (
            f"{self.source_url_prefix}/workspaces/{pipeline_details.workspace.workspaceId}"
            f"/connections/{pipeline_details.connection.connectionId}/status"
        )

        for job in self.client.list_jobs(pipeline_details.connection.connectionId):
            if not job or not job.attempts:
                continue
            for attempt in job.attempts:
                created_at = (
                    datetime_to_timestamp(
                        datetime.fromtimestamp(attempt.createdAt, tz=timezone.utc),
                        milliseconds=True,
                    )
                    if attempt.createdAt is not None
                    else None
                )
                ended_at = (
                    datetime_to_timestamp(
                        datetime.fromtimestamp(attempt.endedAt, tz=timezone.utc),
                        milliseconds=True,
                    )
                    if attempt.endedAt is not None
                    else None
                )
                task_status = [
                    TaskStatus(
                        name=str(pipeline_details.connection.connectionId),
                        executionStatus=STATUS_MAP.get(attempt.status.lower(), StatusType.Pending).value,
                        startTime=created_at,
                        endTime=ended_at,
                        logLink=log_link,
                    )
                ]
                pipeline_status = PipelineStatus(
                    executionStatus=STATUS_MAP.get(attempt.status.lower(), StatusType.Pending).value,
                    taskStatus=task_status,
                    timestamp=Timestamp(created_at) if created_at is not None else None,
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

    def _yield_pipeline_status_cloud(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Method to get task & pipeline status for Airbyte Cloud.
        Handles flat job structure with ISO 8601 timestamps.
        """
        log_link = (
            f"{self.source_url_prefix}/workspaces/{pipeline_details.workspace.workspaceId}"
            f"/connections/{pipeline_details.connection.connectionId}/timeline"
        )

        for job in self.client.list_jobs(pipeline_details.connection.connectionId):
            if not job:
                continue

            created_at = None
            ended_at = None

            if job.startTime:
                try:
                    start_dt = datetime.fromisoformat(job.startTime.replace("Z", "+00:00"))
                    created_at = datetime_to_timestamp(start_dt, milliseconds=True)
                except (ValueError, AttributeError) as exc:
                    logger.error(f"Failed to parse startTime: {exc}")

            if job.lastUpdatedAt:
                try:
                    end_dt = datetime.fromisoformat(job.lastUpdatedAt.replace("Z", "+00:00"))
                    ended_at = datetime_to_timestamp(end_dt, milliseconds=True)
                except (ValueError, AttributeError) as exc:
                    logger.error(f"Failed to parse lastUpdatedAt: {exc}")

            task_status = [
                TaskStatus(
                    name=str(pipeline_details.connection.connectionId),
                    executionStatus=STATUS_MAP.get(job.status.lower(), StatusType.Pending).value,
                    startTime=created_at,
                    endTime=ended_at,
                    logLink=log_link,
                )
            ]

            pipeline_status = PipelineStatus(
                executionStatus=STATUS_MAP.get(job.status.lower(), StatusType.Pending).value,
                taskStatus=task_status,
                timestamp=Timestamp(created_at) if created_at else None,
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

    def _get_table_fqn(self, table_details: TableDetails) -> str | None:
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
        pipeline_name = pipeline_details.connection.name

        logger.debug(
            f"Processing lineage for pipeline: {pipeline_name}, "
            f"connection_id: {pipeline_details.connection.connectionId}, "
            f"workspace_id: {pipeline_details.workspace.workspaceId}"
        )
        logger.debug(f"Pipeline connection details: {pipeline_details.connection}")

        if not pipeline_details.connection.sourceId or not pipeline_details.connection.destinationId:
            logger.warning(
                f"Skipping lineage for connection"
                f" [{pipeline_details.connection.connectionId}]"
                f" — missing sourceId or destinationId"
            )
            return

        source_connection = self.client.get_source(pipeline_details.connection.sourceId)
        destination_connection = self.client.get_destination(pipeline_details.connection.destinationId)

        logger.debug(f"Source connection response: {source_connection}")
        logger.debug(f"Destination connection response: {destination_connection}")

        streams = pipeline_details.connection.resolved_streams
        if not streams:
            logger.warning(
                "Skipping lineage for connection [%s] — Airbyte returned no streams for it",
                pipeline_details.connection.connectionId,
            )
            return

        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
        if not pipeline_entity:
            logger.warning(
                "Skipping lineage for connection [%s]: pipeline [%s] not found in OpenMetadata",
                pipeline_details.connection.connectionId,
                pipeline_fqn,
            )
            return
        pipeline_reference = EntityReference(id=pipeline_entity.id.root, type="pipeline")

        for stream in streams:
            from_reference = self._resolve_entity(stream, source_connection, SOURCE, pipeline_name)
            to_reference = self._resolve_entity(stream, destination_connection, DESTINATION, pipeline_name)

            if from_reference is None and to_reference is None:
                continue

            # Anchor whichever side has no OpenMetadata entity on the pipeline itself, so a
            # resolved side is never dropped. This covers API destinations — OpenMetadata accepts
            # apiCollection only as an upstream node, never as a downstream target — and any
            # otherwise unsupported connector. The pipeline is a valid lineage node either way.
            if from_reference is None:
                from_reference = pipeline_reference
                lineage_details = LineageDetails(source=LineageSource.PipelineLineage)
            elif to_reference is None:
                to_reference = pipeline_reference
                lineage_details = LineageDetails(source=LineageSource.PipelineLineage)
            else:
                lineage_details = LineageDetails(
                    pipeline=pipeline_reference,
                    source=LineageSource.PipelineLineage,
                )

            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=from_reference,
                        toEntity=to_reference,
                        lineageDetails=lineage_details,
                    )
                )
            )

    def _resolve_entity(
        self,
        stream: AirbyteStream,
        connection,
        direction: str,
        pipeline_name: str,
    ) -> Optional[EntityReference]:  # noqa: UP045
        """
        Resolve a stream's OpenMetadata entity via the connector-type registry.

        The registry maps the Airbyte connector type to the resolver for its entity kind
        (table / container / topic / searchIndex / apiCollection). Unknown types fall back
        to the API resolver, which only produces an edge when ``apiServiceNames`` is set — so
        an unsupported connector resolves to None and the caller anchors on the pipeline.
        """
        resolver = get_resolver(connection.resolved_type)
        return resolver.resolve(self, stream, connection, direction, pipeline_name)

    def _get_container_entity_reference(self, container_path: str, pipeline_name: str) -> Optional[EntityReference]:  # noqa: UP045
        """
        Look up the Container an object-store path maps to, as Glue and KafkaConnect do.

        Falls back to the bucket-level container because a storage manifest often registers
        only the bucket, leaving the per-stream prefix un-ingested.
        """
        storage_services = self.get_storage_service_names()
        bucket_root = "/".join(container_path.split("/")[:3])

        for candidate in dict.fromkeys([container_path, bucket_root]):
            for container in self.metadata.es_search_container_by_path(full_path=candidate) or []:
                if not container:
                    continue
                if storage_services and container.service and model_str(container.service.name) not in storage_services:
                    continue
                logger.debug(
                    "Resolved Airbyte destination path [%s] to container [%s]",
                    container_path,
                    model_str(container.fullyQualifiedName),
                )
                return EntityReference(id=container.id, type="container")

        logger.warning(
            "While extracting lineage: [%s], destination container for path [%s] not found in"
            " openmetadata. Ensure the storage service holding this bucket has been ingested.",
            pipeline_name,
            container_path,
        )
        return None

    def get_pipelines_list(self) -> Iterable[AirbytePipelineDetails]:
        """
        Get List of all pipelines
        """
        for workspace in self.client.list_workspaces():
            for connection in self.client.list_connections(workflow_id=workspace.workspaceId):
                yield AirbytePipelineDetails(workspace=workspace, connection=connection)

    def get_pipeline_name(self, pipeline_details: AirbytePipelineDetails) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details.connection.name
