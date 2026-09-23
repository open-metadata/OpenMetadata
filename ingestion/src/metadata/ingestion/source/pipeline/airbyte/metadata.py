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


def _shape_rank(candidate: TableDetails) -> int:
    """
    How specific an FQN shape is, lowest first.

    A level the shape omits is a wildcard in the built FQN, so it can match any table at that
    level. An omitted *schema* is the dangerous one: it matches every schema of the named
    database, while an omitted database only spans the synthetic ``default`` of a
    single-database service. Ranking keeps a wildcard-schema shape in one service from
    winning over an exact-schema shape in another.
    """
    if candidate.database and candidate.schema:
        return 0
    if candidate.schema:
        return 1
    return 2


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
        Find the Table a stream maps to, trying the most specific FQN shape across *every*
        configured service before falling back to a looser one.

        The shapes are ranked by specificity rather than walked service by service, because a
        looser shape drops a level and ``fqn.build`` turns the missing level into a wildcard:
        a single-database service drops the database, and a connector that reports no schema
        leaves the schema open. Either can match a same-named table in an unrelated service,
        so a per-service loop lets an earlier service win with a degraded shape before the
        right service is tried with its exact one -- which is how a MySQL destination resolved
        onto a Postgres table and a Postgres destination onto a MySQL one.

        The entity is still fetched and verified rather than trusting ``fqn.build``, which
        returns a *constructed* FQN whenever service, database and schema are all present,
        even when Elasticsearch matched nothing.
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

        shapes = [
            (_shape_rank(candidate), service_name, candidate)
            for service_name in (self.get_db_service_names() or ["*"])
            for candidate in table_fqn_candidates(table_details, self.db_service_classes.get(service_name))
        ]
        # Stable sort, so services keep their configured order inside a rank.
        for _, service_name, candidate in sorted(shapes, key=lambda shape: shape[0]):
            entity = self._fetch_table(service_name, candidate)
            if entity:
                return entity
        return None

    def _fetch_table(self, service_name: str, candidate: TableDetails) -> Table | None:
        """Fetch the Table one FQN shape points at in one service, or None."""
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
            return None
        return self.metadata.get_by_name(entity=Table, fqn=table_fqn) if table_fqn else None

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

        # The connector type belongs to the connection, not the stream, so both sides are
        # resolved once here rather than re-derived per stream.
        source_resolver = get_resolver(source_connection.resolved_type, SOURCE)
        destination_resolver = get_resolver(destination_connection.resolved_type, DESTINATION)

        # A side with no resolver is only ever claimed by the opt-in API resolver, and whether
        # that worked is not known until a stream has been tried. Collect the unclaimed sides
        # here, drop each one as soon as any stream resolves it, and report what is left once —
        # a per-stream warning would repeat itself for every stream on the connection.
        unresolved_sides = {
            direction: connection.resolved_type
            for direction, connection, resolver in (
                (SOURCE, source_connection, source_resolver),
                (DESTINATION, destination_connection, destination_resolver),
            )
            if resolver is None
        }

        for stream in streams:
            from_reference, from_supported = self._resolve_entity(
                source_resolver, stream, source_connection, SOURCE, pipeline_name
            )
            to_reference, to_supported = self._resolve_entity(
                destination_resolver, stream, destination_connection, DESTINATION, pipeline_name
            )
            if from_reference is not None:
                unresolved_sides.pop(SOURCE, None)
            if to_reference is not None:
                unresolved_sides.pop(DESTINATION, None)

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
            # every case where either side stays None after the anchoring step. The type
            # checker follows that for `from_reference` (the if/elif/else narrows it) but not
            # for `to_reference`, whose non-Noneness comes from the `and` in the second guard.
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

        self._warn_unresolved_sides(unresolved_sides, pipeline_name)

    def _warn_unresolved_sides(self, unresolved_sides: dict[str, str | None], pipeline_name: str) -> None:
        """Report each connection side that no resolver could claim, once per connection."""
        api_services = self.get_api_service_names()
        for direction, resolved_type in unresolved_sides.items():
            if api_services:
                logger.warning(
                    "Airbyte lineage [%s]: %s connector [%s] matched no API collection in %s;"
                    " lineage on that side is anchored on the pipeline.",
                    pipeline_name,
                    direction,
                    resolved_type,
                    api_services,
                )
            else:
                logger.warning(
                    "Airbyte lineage [%s]: %s connector [%s] is not supported yet; lineage on that"
                    " side is anchored on the pipeline. Set lineageInformation.apiServiceNames if"
                    " it is an API service.",
                    pipeline_name,
                    direction,
                    resolved_type,
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

            containers = hits
            if storage_services:
                containers = [
                    container
                    for container in containers
                    if container.service and model_str(container.service.name) in storage_services
                ]
            if not containers:
                continue

            # One path can exist in several storage services (the same bucket ingested twice).
            # Whichever one is picked is arbitrary, so emit nothing rather than a coin-flip edge.
            # This holds whether or not storageServiceNames is set: scoping the search to two
            # services that both hold the bucket narrows the candidates without deciding between
            # them. `fullPath` is unique inside a service (the server matches it with an
            # unglobbed wildcard query), so more than one surviving service is the only way this
            # can happen.
            services = {model_str(container.service.name) for container in containers if container.service}
            if len(services) > 1:
                logger.warning(
                    "While extracting lineage: [%s], path [%s] matches containers in storage services %s;"
                    " skipping. Set lineageInformation.storageServiceNames to a single service to"
                    " disambiguate.",
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
