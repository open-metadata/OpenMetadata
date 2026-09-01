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

from datetime import datetime, timezone
from typing import Iterable, Optional  # noqa: UP035

from pydantic import BaseModel

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.apiCollection import APICollection
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
    AirbyteDestinationResponse,
    AirbyteSourceResponse,
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

from .utils import (  # noqa: TID252
    get_destination_container_path,
    get_destination_table_details,
    get_source_container_path,
    get_source_table_details,
    is_object_store_connector,
)

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
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
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

    def _get_table_fqn(self, table_details: TableDetails) -> Optional[str]:  # noqa: UP045
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

        # The public API reports the connector as `sourceType`/`destinationType`, so reading
        # `sourceName`/`destinationName` directly makes every diagnostic log read "type: None".
        source_name = source_connection.resolved_type
        destination_name = destination_connection.resolved_type

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
        pipeline_reference = EntityReference(id=pipeline_entity.id.root, type="pipeline")

        for stream in streams:
            to_reference = self._get_destination_entity_reference(
                stream, destination_connection, pipeline_name, destination_name
            )

            if not to_reference:
                continue

            from_reference = self._get_source_entity_reference(stream, source_connection, pipeline_name, source_name)

            # An API (or otherwise unsupported) source has no OpenMetadata entity to anchor
            # the upstream side. Anchoring on the pipeline still records where the data
            # landed instead of dropping the edge entirely.
            if from_reference is None:
                from_reference = pipeline_reference
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

    def _get_source_entity_reference(
        self,
        stream: AirbyteStream,
        source_connection: AirbyteSourceResponse,
        pipeline_name: str,
        source_name: Optional[str],  # noqa: UP045
    ) -> Optional[EntityReference]:  # noqa: UP045
        """
        Resolve the table a stream is read from, or None when the source connector has no
        OpenMetadata counterpart (API connectors, unsupported databases).
        """
        # Object stores must be checked first: they resolve to a Container, and letting
        # them fall through would match them against an unrelated API collection.
        if is_object_store_connector(source_connection.resolved_type):
            container_path = get_source_container_path(stream, source_connection)
            return self._get_container_entity_reference(container_path, pipeline_name) if container_path else None

        source_table_details = get_source_table_details(stream, source_connection)
        if not source_table_details:
            # Not relational and not an object store. Only an explicitly configured API
            # service may claim it; otherwise the connector is simply unsupported.
            return self._get_api_entity_reference(stream, pipeline_name)

        from_fqn = self._get_table_fqn(source_table_details)
        if not from_fqn:
            logger.warning(
                "While extracting lineage: [%s], source table: [%s].[%s].[%s] (type: %s) not found in openmetadata",
                pipeline_name,
                source_table_details.database or "*",
                source_table_details.schema,
                source_table_details.name,
                source_name,
            )
            return None

        from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
        if not from_entity:
            logger.warning(
                "While extracting lineage: [%s], source table (fqn: [%s], type: %s) not found in openmetadata",
                pipeline_name,
                from_fqn,
                source_name,
            )
            return None

        return EntityReference(id=from_entity.id, type="table")

    def _get_destination_entity_reference(
        self,
        stream: AirbyteStream,
        destination_connection: AirbyteDestinationResponse,
        pipeline_name: str,
        destination_name: Optional[str],  # noqa: UP045
    ) -> Optional[EntityReference]:  # noqa: UP045
        """
        Resolve the entity a stream is written to.

        Object-store destinations land in a Container addressed by S3 path; every other
        supported destination lands in a Table addressed by FQN.
        """
        if is_object_store_connector(destination_connection.resolved_type):
            container_path = get_destination_container_path(stream, destination_connection)
            return self._get_container_entity_reference(container_path, pipeline_name) if container_path else None

        destination_table_details = get_destination_table_details(stream, destination_connection)
        if not destination_table_details:
            # Not relational and not an object store. Only an explicitly configured API
            # service may claim it; otherwise the connector is simply unsupported.
            return self._get_api_entity_reference(stream, pipeline_name)

        to_fqn = self._get_table_fqn(destination_table_details)
        if not to_fqn:
            logger.warning(
                "While extracting lineage: [%s], destination table: [%s].[%s].[%s] (type: %s)"
                " not found in openmetadata",
                pipeline_name,
                destination_table_details.database or "*",
                destination_table_details.schema,
                destination_table_details.name,
                destination_name,
            )
            return None

        to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
        if not to_entity:
            logger.warning(
                "While extracting lineage: [%s], destination table (fqn: [%s], type: %s) not found in openmetadata",
                pipeline_name,
                to_fqn,
                destination_name,
            )
            return None

        return EntityReference(id=to_entity.id, type="table")

    def _get_api_entity_reference(self, stream: AirbyteStream, pipeline_name: str) -> Optional[EntityReference]:  # noqa: UP045
        """
        Resolve the API collection a stream is read from or written to.

        Airbyte API connectors expose no endpoint URL in their configuration, so the stream
        name is the only join key available. That key is weak: Airbyte ships many connectors
        that are neither relational nor object stores (Kafka, MongoDB, Pinecone, /dev/null),
        and matching those on name alone would invent lineage to an unrelated API.

        Resolution is therefore opt-in: it only runs when ``apiServiceNames`` names the API
        services this pipeline actually talks to, and only when the match is unambiguous.
        """
        api_services = self.get_api_service_names()
        if not api_services:
            logger.debug(
                "Skipping API lineage for stream [%s] in pipeline [%s]:"
                " set lineageInformation.apiServiceNames to enable it",
                stream.name,
                pipeline_name,
            )
            return None

        collections = [
            collection
            for collection in self.metadata.es_search_from_fqn(
                entity_type=APICollection,
                fqn_search_string=f"*.{stream.name}",
            )
            or []
            if collection.service and model_str(collection.service.name) in api_services
        ]

        if len(collections) != 1:
            logger.warning(
                "While extracting lineage: [%s], stream [%s] matched %d API collections;"
                " skipping. Set lineageInformation.apiServiceNames to disambiguate.",
                pipeline_name,
                stream.name,
                len(collections),
            )
            return None

        logger.debug(
            "Resolved Airbyte stream [%s] to API collection [%s]",
            stream.name,
            model_str(collections[0].fullyQualifiedName),
        )
        return EntityReference(id=collections[0].id, type="apiCollection")

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
