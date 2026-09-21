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
from functools import cached_property

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
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.fqn import FQNBuildingException
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

from .constants import ES_MATCH_LIMIT  # noqa: TID252
from .resolvers import API_RESOLVER, DESTINATION, SOURCE, EntityResolver, get_resolver  # noqa: TID252
from .utils import service_supports_database, table_fqn_candidates  # noqa: TID252

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

        # Job shape follows the API, not the deployment: the public API (Cloud
        # and self-hosted `api/public/v1`) returns flat jobs, while only the
        # internal API nests `attempts`. Route pipeline status on this so a
        # self-hosted instance on the public API is not sent through the
        # attempts-based path (issue #26993).
        self.use_public_api = getattr(self.client, "_use_public_api", False)
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
        if self.use_public_api:
            yield from self._yield_pipeline_status_public(pipeline_details)
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

    def _yield_pipeline_status_public(
        self, pipeline_details: AirbytePipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Task & pipeline status for the public API (Airbyte Cloud and self-hosted
        `api/public/v1`): flat jobs with ISO 8601 timestamps and no `attempts`.
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
                    logger.error("Failed to parse startTime: %s", exc)

            if job.lastUpdatedAt:
                try:
                    end_dt = datetime.fromisoformat(job.lastUpdatedAt.replace("Z", "+00:00"))
                    ended_at = datetime_to_timestamp(end_dt, milliseconds=True)
                except (ValueError, AttributeError) as exc:
                    logger.error("Failed to parse lastUpdatedAt: %s", exc)

            # PipelineStatus requires a timestamp; without a resolvable startTime
            # constructing it would raise a ValidationError that the topology
            # runner swallows (dropping the status silently). Skip visibly instead.
            if created_at is None:
                logger.warning(
                    "Skipping job status for connection %s: job has no parseable startTime",
                    pipeline_details.connection.connectionId,
                )
                continue

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
                timestamp=Timestamp(created_at),  # guaranteed non-None by the guard above
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

    @cached_property
    def db_service_classes(self) -> dict[str, bool | None]:
        """
        Service class per configured database service, resolved once.

        ``dbServiceNames`` is static config, so the map is bounded by it and never grows with
        the number of streams. The value is per service on purpose: a list mixing a
        multi-database service with a single-database one has no single right answer, and
        collapsing it would send every stream through one shape.
        """
        return {name: service_supports_database(self.metadata, name) for name in self.get_db_service_names()}

    def resolve_table(self, table_details: TableDetails) -> Table | None:
        """
        Find the Table a stream maps to: each configured service in turn, and within a service
        each FQN shape that service's class allows.

        The loop is per service because ``fqn.build`` returns a *constructed* FQN whenever
        service, database and schema are all present, even when Elasticsearch matched nothing.
        Accepting the first service's answer would therefore hide a table that lives in the
        second, so the entity is fetched and verified before a service is accepted.
        """
        # Without a database or a schema the search degrades to `*.*.*.<table>`, which
        # `fqn.build` resolves to an arbitrary same-named table in an unrelated service.
        # No qualifier is better than a wrong edge.
        if not table_details.database and not table_details.schema:
            logger.warning(
                "Airbyte lineage: skipping table [%s] — the connector reported neither a database"
                " nor a schema, so it cannot be identified in OpenMetadata",
                table_details.name,
            )
            return None

        service_names = self.get_db_service_names()
        if not service_names:
            # No list configured: search across services, undecided on the service class.
            return self._lookup_table_in_service("*", table_details, None)

        for service_name in service_names:
            entity = self._lookup_table_in_service(
                service_name, table_details, self.db_service_classes.get(service_name)
            )
            if entity:
                return entity
        return None

    def _lookup_table_in_service(
        self, service_name: str, table_details: TableDetails, supports_database: bool | None
    ) -> Table | None:
        """Resolve a table in one service, trying each FQN shape that service's class allows."""
        for candidate in table_fqn_candidates(table_details, supports_database):
            try:
                table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=service_name,
                    database_name=candidate.database,
                    schema_name=candidate.schema,
                    table_name=candidate.name,
                )
            except FQNBuildingException:
                continue
            entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn) if table_fqn else None
            if entity:
                return entity
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
        pipeline_name = pipeline_details.connection.name or pipeline_details.connection.connectionId

        logger.debug(
            "Processing lineage for pipeline: %s, connection_id: %s, workspace_id: %s",
            pipeline_name,
            pipeline_details.connection.connectionId,
            pipeline_details.workspace.workspaceId,
        )
        logger.debug("Pipeline connection details: %s", pipeline_details.connection)

        if not pipeline_details.connection.sourceId or not pipeline_details.connection.destinationId:
            logger.warning(
                "Skipping lineage for connection [%s] — missing sourceId or destinationId",
                pipeline_details.connection.connectionId,
            )
            return

        source_connection = self.client.get_source(pipeline_details.connection.sourceId)
        destination_connection = self.client.get_destination(pipeline_details.connection.destinationId)

        logger.debug("Source connection response: %s", source_connection)
        logger.debug("Destination connection response: %s", destination_connection)

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

        # The connector type belongs to the connection, not the stream, so resolve both sides
        # once and warn once — per-stream selection re-derived the same answer and, when it was
        # "unsupported", either spammed the log or (since the mid-cascade demotion to debug)
        # said nothing at all about a connection that produced no lineage.
        source_resolver = get_resolver(source_connection.resolved_type, SOURCE)
        destination_resolver = get_resolver(destination_connection.resolved_type, DESTINATION)
        if not self.get_api_service_names():
            for direction, connection, resolver in (
                (SOURCE, source_connection, source_resolver),
                (DESTINATION, destination_connection, destination_resolver),
            ):
                if resolver is None:
                    logger.warning(
                        "Airbyte lineage [%s]: %s connector [%s] is not supported yet; lineage on that"
                        " side is anchored on the pipeline. Set lineageInformation.apiServiceNames if"
                        " it is an API service.",
                        pipeline_name,
                        direction,
                        connection.resolved_type,
                    )

        for stream in streams:
            from_reference, from_supported = self._resolve_entity(
                source_resolver, stream, source_connection, SOURCE, pipeline_name
            )
            to_reference, to_supported = self._resolve_entity(
                destination_resolver, stream, destination_connection, DESTINATION, pipeline_name
            )

            # A supported connector whose entity is merely not ingested yet drops the edge — never
            # imply the pipeline is a terminal source/sink for an ordinary table/container/topic.
            if (from_reference is None and from_supported) or (to_reference is None and to_supported):
                continue
            if from_reference is None and to_reference is None:
                continue

            # Anchor the genuinely-unsupported side (an API without apiServiceNames, /dev/null, an
            # unknown connector) on the pipeline so the resolved side is still recorded. The pipeline
            # is a valid lineage node in either direction.
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

            # Both sides are resolved by construction: the two guards above already dropped
            # every case where either side stays None after the anchoring step.
            assert from_reference is not None
            assert to_reference is not None

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
        resolver: EntityResolver | None,
        stream: AirbyteStream,
        connection,
        direction: str,
        pipeline_name: str,
    ) -> tuple[EntityReference | None, bool]:
        """
        Resolve a stream's OpenMetadata entity, returning ``(reference, supported)``.

        A connector type in the registry (table / container / topic / searchIndex) is
        *supported*: a None reference means the entity is simply not ingested yet, and the
        caller drops the edge rather than anchoring it on the pipeline. An unknown type has
        no OpenMetadata counterpart, so only an opt-in API service may claim it (an
        ``apiCollection``, either direction); when even that fails the type is genuinely
        unsupported (``supported=False``) and the caller anchors it on the pipeline. This keeps
        unmapped relational connectors from being mistaken for APIs.
        """
        if resolver is not None:
            return resolver.resolve(self, stream, connection, direction, pipeline_name), True

        api_reference = API_RESOLVER.resolve(self, stream, connection, direction, pipeline_name)
        return api_reference, api_reference is not None

    def _get_container_entity_reference(self, container_path: str, pipeline_name: str) -> EntityReference | None:
        """
        Look up the Container an object-store path maps to, as Glue and KafkaConnect do.

        ``es_search_container_by_path`` matches ``fullPath`` exactly, and a storage manifest
        registers only the prefixes it declares, so walk up one segment at a time
        (``s3://b/raw/public/users`` → ``s3://b/raw/public`` → ``s3://b/raw`` → ``s3://b``)
        and take the deepest container that exists.
        """
        storage_services = self.get_storage_service_names()
        segments = container_path.split("/")
        # Stop at the bucket: segments[:3] is ["s3:", "", "<bucket>"].
        for candidate in ("/".join(segments[:depth]) for depth in range(len(segments), 2, -1)):
            hits = self.metadata.es_search_container_by_path(full_path=candidate, size=ES_MATCH_LIMIT) or []
            if len(hits) >= ES_MATCH_LIMIT:
                # Same reasoning as ApiResolver._match_collection: a full page cannot prove the
                # surviving container is the only one at this path.
                logger.warning(
                    "While extracting lineage: [%s], path [%s] matched at least %d containers;"
                    " skipping rather than picking from a truncated search.",
                    pipeline_name,
                    candidate,
                    ES_MATCH_LIMIT,
                )
                return None

            containers = [container for container in hits if container]
            if storage_services:
                containers = [
                    container
                    for container in containers
                    if container.service and model_str(container.service.name) in storage_services
                ]
            if not containers:
                continue

            # One path can exist in several storage services (the same bucket ingested twice).
            # With no storageServiceNames to choose between them the answer is arbitrary and the
            # user has no way to correct it, so emit nothing rather than a coin-flip edge.
            services = {model_str(container.service.name) for container in containers if container.service}
            if not storage_services and len(services) > 1:
                logger.warning(
                    "While extracting lineage: [%s], path [%s] matches containers in storage services %s;"
                    " skipping. Set lineageInformation.storageServiceNames to disambiguate.",
                    pipeline_name,
                    candidate,
                    sorted(services),
                )
                return None

            logger.debug(
                "Resolved Airbyte destination path [%s] to container [%s]",
                container_path,
                model_str(containers[0].fullyQualifiedName),
            )
            return EntityReference(id=containers[0].id, type="container")

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
