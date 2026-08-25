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
Fivetran source to extract metadata
"""

import traceback
from collections import Counter
from datetime import datetime
from itertools import dropwhile
from typing import Iterable, List, Optional, TypeVar, Union, cast  # noqa: UP035

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    PipelineStatus,
    StatusType,
    Task,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
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
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.lineage.topic_lineage import get_topic_field_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient
from metadata.ingestion.source.pipeline.fivetran.fivetran_log import (
    FIVETRAN_TASK_EXTRACT,
    FIVETRAN_TASK_LOAD,
    FIVETRAN_TASK_PROCESS,
    build_fallback_task_statuses,
    build_task_statuses,
    query_sync_logs,
    sort_and_limit_syncs,
)
from metadata.ingestion.source.pipeline.fivetran.models import FivetranPipelineDetails
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

MESSAGING_CONNECTOR_TYPES = {"confluent_cloud", "kafka"}

FIVETRAN_STATUS_MAP = {
    "COMPLETED": StatusType.Successful,
    "SUCCESS_WITH_TASK": StatusType.Successful,
    "FAILURE_WITH_TASK": StatusType.Failed,
    "CANCELED": StatusType.Failed,
    "TRUNCATED": StatusType.Failed,
    "RESCHEDULED": StatusType.Pending,
}

HISTORICAL_SYNC_FIELDS = [
    ("succeeded_at", StatusType.Successful),
    ("failed_at", StatusType.Failed),
]

# Fivetran-side disables ("schema/table disabled in Fivetran") are deliberate
# configuration, not defects - warning on them trains operators to ignore the
# warning. Only resolution failures mean the connector is misconfigured on the
# OpenMetadata side; "self-referencing edge" belongs here too, since under the
# empty-service-name fallback it usually means first-match-wins resolved both
# ends to the same entity, a real resolution problem.
ACTIONABLE_SKIP_REASONS = frozenset(
    {
        "source entity not found",
        "destination entity not found",
        "self-referencing edge",
    }
)


# Constrained (not just bound) so isinstance(x, entity_type) narrows `x` to the concrete
# member type instead of the union - see _search_any_service.
EntityT = TypeVar("EntityT", Table, Topic)


def _resolve_field_fqn(entity: Union[Table, Topic], name: str) -> Optional[str]:  # noqa: UP007, UP045
    if isinstance(entity, Topic):
        return get_topic_field_fqn(entity, name)
    return get_column_fqn(table_entity=entity, column=name)


class FivetranSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Fivetran's REST API
    """

    @property
    def fivetran_client(self) -> FivetranClient:
        return cast(FivetranClient, self.client)  # noqa: TC006

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ) -> "FivetranSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: FivetranConnection = config.serviceConnection.root.config
        if not isinstance(connection, FivetranConnection):
            raise InvalidSourceException(f"Expected FivetranConnection, but got {connection}")
        return cls(config, metadata)

    def get_connections_jobs(
        self,
        pipeline_details: FivetranPipelineDetails,
        source_url: Optional[SourceUrl] = None,  # noqa: UP045
    ) -> List[Task]:  # noqa: UP006
        """Returns the three ELT phase tasks for a Fivetran connector."""
        return [
            Task(
                name=FIVETRAN_TASK_EXTRACT,
                displayName="Extract",
                taskType="Extract",
                sourceUrl=source_url,
                downstreamTasks=[FIVETRAN_TASK_PROCESS],
            ),  # type: ignore
            Task(
                name=FIVETRAN_TASK_PROCESS,
                displayName="Process",
                taskType="Process",
                sourceUrl=source_url,
                downstreamTasks=[FIVETRAN_TASK_LOAD],
            ),  # type: ignore
            Task(
                name=FIVETRAN_TASK_LOAD,
                displayName="Load",
                taskType="Load",
                sourceUrl=source_url,
                downstreamTasks=[],
            ),  # type: ignore
        ]

    def yield_pipeline(self, pipeline_details: FivetranPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        """Convert a Fivetran Connection into a Pipeline Entity."""
        source_url = self.get_source_url(
            connector_id=pipeline_details.source.get("id"),
            group_id=pipeline_details.group.get("id"),
            source_name=pipeline_details.source.get("service"),
        )
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.pipeline_name),
            displayName=pipeline_details.pipeline_display_name,
            tasks=self.get_connections_jobs(pipeline_details=pipeline_details, source_url=source_url),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            sourceUrl=source_url,
            scheduleInterval=self._get_schedule_interval(pipeline_details),
            state=self._get_pipeline_state(pipeline_details),
        )  # type: ignore
        yield Either(left=None, right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    # ------------------------------------------------------------------
    # Pipeline status
    # ------------------------------------------------------------------

    def yield_pipeline_status(self, pipeline_details: FivetranPipelineDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        """Get task & pipeline status.

        Strategy: warehouse DB logs -> REST sync-history -> historical fields.
        """
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )

        db_statuses = self._get_status_from_db(pipeline_details, pipeline_fqn)
        if db_statuses:
            for status in db_statuses:
                yield Either(right=status)
            return

        yield from self._get_status_from_rest(pipeline_details, pipeline_fqn)

    def _resolve_log_source(self, log_service_type: str) -> Optional[DatabaseService]:  # noqa: UP045
        """Resolve the warehouse DatabaseService that holds fivetran_metadata.log.

        Fivetran calls this warehouse the "destination" but from OM's
        perspective it is a *source* of pipeline-status data.
        """
        for service_name in self.get_db_service_names() or []:
            try:
                service = self.metadata.get_by_name(
                    entity=DatabaseService,
                    fqn=service_name,
                    fields=["connection"],
                )
                if not service or not service.connection or not service.connection.config:
                    continue
                if log_service_type and service.serviceType.value.lower() != log_service_type.lower():
                    continue
                return service  # noqa: TRY300
            except Exception as exc:
                logger.debug(f"Could not resolve service [{service_name}]: {exc}")
        return None

    def _get_status_from_db(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_fqn: str,
    ) -> Optional[List[OMetaPipelineStatus]]:  # noqa: UP006, UP045
        # Fivetran's "destination" config holds the warehouse where logs live
        log_database = self._get_database_name(pipeline_details.destination)
        if not log_database:
            return None

        log_service_type = pipeline_details.destination.get("service", "")
        service = self._resolve_log_source(log_service_type)
        if not service:
            return None

        syncs = query_sync_logs(service, log_database, pipeline_details.connector_id)
        if syncs is None:
            return None

        statuses = []
        for sync in sort_and_limit_syncs(syncs):
            task_statuses = build_task_statuses(sync)
            overall_failed = any(ts.executionStatus == StatusType.Failed for ts in task_statuses)
            statuses.append(
                OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn,
                    pipeline_status=PipelineStatus(
                        executionStatus=(StatusType.Failed if overall_failed else StatusType.Successful),
                        taskStatus=task_statuses,
                        timestamp=Timestamp(datetime_to_ts(sync["sync_start_ts"])),
                    ),
                )
            )
        return statuses

    def _get_status_from_rest(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_fqn: str,
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        seen_timestamps: set = set()
        yield from self._yield_sync_history_statuses(pipeline_details, pipeline_fqn, seen_timestamps)
        yield from self._yield_historical_field_statuses(pipeline_details, pipeline_fqn, seen_timestamps)

    def _yield_sync_history_statuses(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_fqn: str,
        seen_timestamps: set,
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        for sync in self.fivetran_client.get_connector_sync_history(pipeline_details.connector_id):
            try:
                start_dt = datetime.fromisoformat(sync["start"].replace("Z", "+00:00"))
                start_ms = datetime_to_ts(start_dt)
                if start_ms in seen_timestamps:
                    continue
                seen_timestamps.add(start_ms)

                end_ms = None
                if sync.get("end"):
                    end_dt = datetime.fromisoformat(sync["end"].replace("Z", "+00:00"))
                    end_ms = datetime_to_ts(end_dt)

                status_type = FIVETRAN_STATUS_MAP.get(sync.get("status", ""), StatusType.Pending)
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=PipelineStatus(
                            executionStatus=status_type,
                            taskStatus=build_fallback_task_statuses(status_type, start_ms, end_ms),
                            timestamp=Timestamp(start_ms),
                        ),
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{pipeline_details.pipeline_name} Sync History",
                        error=f"Error parsing sync history: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_historical_field_statuses(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_fqn: str,
        seen_timestamps: set,
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        for field_name, status_type in HISTORICAL_SYNC_FIELDS:
            try:
                timestamp_str = pipeline_details.source.get(field_name)
                if not timestamp_str:
                    continue
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                ts_ms = datetime_to_ts(dt)
                if ts_ms in seen_timestamps:
                    continue
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=PipelineStatus(
                            executionStatus=status_type,
                            taskStatus=build_fallback_task_statuses(status_type, ts_ms, None),
                            timestamp=Timestamp(ts_ms),
                        ),
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{pipeline_details.pipeline_name} Historical Status",
                        error=f"Error parsing field [{field_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    # ------------------------------------------------------------------
    # Lineage
    # ------------------------------------------------------------------

    def yield_pipeline_lineage_details(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        pipeline_name = self.get_pipeline_name(pipeline_details)

        source_connector_type = pipeline_details.source.get("service")
        is_messaging_source = source_connector_type in MESSAGING_CONNECTOR_TYPES
        is_messaging_destination = pipeline_details.destination.get("service") in MESSAGING_CONNECTOR_TYPES

        source_database_name = self._get_database_name(pipeline_details.source)
        destination_database_name = self._get_database_name(pipeline_details.destination)

        pipeline_entity = None
        edge_count = 0
        skip_reasons: Counter = Counter()

        for (
            schema_name,
            schema_data,
        ) in self.fivetran_client.get_connector_schema_details(connector_id=pipeline_details.source.get("id")).items():
            if not schema_data.get("enabled"):
                logger.debug(
                    f"Skipping schema [{schema_name}] for pipeline [{pipeline_name}] lineage - schema is disabled"
                )
                skip_reasons["schema disabled in Fivetran"] += 1
                continue

            destination_schema_name = schema_data.get("name_in_destination")

            for table_name, table_data in schema_data.get("tables", {}).items():
                if not table_data.get("enabled"):
                    logger.debug(
                        f"Skipping table [{schema_name}].[{table_name}] for pipeline"
                        f" [{pipeline_name}] lineage - table is disabled"
                    )
                    skip_reasons["table disabled in Fivetran"] += 1
                    continue

                destination_table_name = table_data.get("name_in_destination")

                if is_messaging_source:
                    from_entity = self._resolve_topic(topic_name=table_name)
                else:
                    from_entity = self._resolve_table(
                        table_name=table_name,
                        schema_name=schema_name,
                        database_name=source_database_name,
                    )
                if not from_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since source entity [{schema_name}.{table_name}] not found."
                    )
                    skip_reasons["source entity not found"] += 1
                    continue

                if is_messaging_destination:
                    # Guard against fabricating a "None.table" / "schema.None" search string
                    # when name_in_destination is absent - fall through to the not-found skip below.
                    to_entity = (
                        self._resolve_topic(
                            topic_name=(
                                f"{destination_schema_name}.{destination_table_name}"
                                if destination_schema_name
                                else destination_table_name
                            )
                        )
                        if destination_table_name
                        else None
                    )
                else:
                    to_entity = self._resolve_table(
                        table_name=destination_table_name,
                        schema_name=destination_schema_name,
                        database_name=destination_database_name,
                    )
                if not to_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since destination entity [{destination_schema_name}."
                        f"{destination_table_name}] not found."
                    )
                    skip_reasons["destination entity not found"] += 1
                    continue

                if from_entity.id == to_entity.id:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}] - self-referencing lineage is not allowed."
                    )
                    skip_reasons["self-referencing edge"] += 1
                    continue

                try:
                    col_lineage = self._fetch_column_lineage(
                        pipeline_details=pipeline_details,
                        pipeline_name=pipeline_name,
                        schema_name=schema_name,
                        table_name=table_name,
                        from_entity=from_entity,
                        to_entity=to_entity,
                    )
                except Exception as exc:
                    # Column-config endpoint isn't supported for every connector type
                    # (e.g. messaging sources); best-effort - keep the entity-level edge.
                    logger.warning(
                        f"Column lineage skipped for [{schema_name}].[{table_name}] in [{pipeline_name}]: {exc}"
                    )
                    logger.debug(traceback.format_exc())
                    col_lineage = []

                if pipeline_entity is None:
                    pipeline_entity = self._get_pipeline_entity()
                    if not pipeline_entity:
                        logger.warning(f"Pipeline entity not found for [{pipeline_name}], skipping lineage.")
                        return

                edge_count += 1
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(  # type: ignore
                                id=from_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[from_entity.__class__.__name__],
                            ),
                            toEntity=EntityReference(  # type: ignore
                                id=to_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[to_entity.__class__.__name__],
                            ),
                            lineageDetails=LineageDetails(
                                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),  # type: ignore
                                source=LineageSource.PipelineLineage,
                                columnsLineage=col_lineage or None,
                            ),
                        )
                    )
                )  # type: ignore

        actionable_reasons = Counter(
            {reason: count for reason, count in skip_reasons.items() if reason in ACTIONABLE_SKIP_REASONS}
        )
        if not edge_count and actionable_reasons:
            reason, count = actionable_reasons.most_common(1)[0]
            logger.warning(
                f"Pipeline [{pipeline_name}] produced no lineage."
                f" Most common actionable reason: {reason} ({count} of {sum(skip_reasons.values())} candidates)."
                " If dbServiceNames/messagingServiceNames are unset, entities are matched across all"
                " services; if they are set, verify the names match the services holding these entities."
            )

    def _resolve_table(
        self,
        *,
        table_name: str,
        schema_name: Optional[str],  # noqa: UP045
        database_name: Optional[str],  # noqa: UP045
    ) -> Optional[Table]:  # noqa: UP045
        service_names = self.get_db_service_names()
        for service_name in service_names or []:
            entity_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=database_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            if not entity_fqn:
                continue
            entity = self.metadata.get_by_name(entity=Table, fqn=entity_fqn)
            if entity:
                return entity
        if service_names:
            return None
        return self._search_any_service(Table, [database_name, schema_name, table_name])

    def _resolve_topic(self, *, topic_name: str) -> Optional[Topic]:  # noqa: UP045
        service_names = self.get_messaging_service_names()
        for service_name in service_names or []:
            entity_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Topic,
                service_name=service_name,
                topic_name=topic_name,
            )
            if not entity_fqn:
                continue
            entity = self.metadata.get_by_name(entity=Topic, fqn=entity_fqn)
            if entity:
                return entity
        if service_names:
            return None
        return self._search_any_service(Topic, [topic_name])

    def _search_any_service(
        self,
        entity_type: type[EntityT],
        parts: List[Optional[str]],  # noqa: UP006, UP045
    ) -> Optional[EntityT]:  # noqa: UP045
        # search_in_any_service pads missing parent levels with `*` at the front only
        # (prefix_entity_for_wildcard_search), so leading unknown parts can be dropped -
        # padding fills them back in. An interior gap must NOT be dropped: doing so
        # shifts a later, known part into the missing slot (e.g. database landing in the
        # schema slot). A missing leaf can't be searched for at all.
        if not parts or not parts[-1]:
            return None
        known_parts = list(dropwhile(lambda part: not part, parts))
        search_string = fqn.FQN_SEPARATOR.join(fqn.quote_name(part) if part else "*" for part in known_parts)
        result = self.metadata.search_in_any_service(
            entity_type=entity_type,
            fqn_search_string=search_string,
        )
        # search_in_any_service is annotated to allow a list (fetch_multiple_entities=True),
        # which we never request; reject that shape explicitly rather than assume it away.
        if not isinstance(result, entity_type):
            return None
        service_name = result.service.name if result.service else "unknown"
        logger.debug(
            f"Resolved {entity_type.__name__} [{search_string}] via cross-service search in service [{service_name}]"
        )
        return result

    def _get_pipeline_entity(self) -> Optional[Pipeline]:  # noqa: UP045
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        return self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)

    def _fetch_column_lineage(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_name: str,
        schema_name: str,
        table_name: str,
        from_entity: Union[Table, Topic],  # noqa: UP007
        to_entity: Union[Table, Topic],  # noqa: UP007
    ) -> List[ColumnLineage]:  # noqa: UP006
        col_lineage = []
        for (
            column_name,
            column_data,
        ) in self.fivetran_client.get_connector_column_lineage(
            pipeline_details.connector_id,
            schema_name=schema_name,
            table_name=table_name,
        ).items():
            if not column_data.get("enabled"):
                continue

            dest_column_name = column_data.get("name_in_destination")
            if not column_name or not dest_column_name:
                logger.debug(
                    f"Skipping column mapping [{column_name}] -> [{dest_column_name}]"
                    f" for pipeline [{pipeline_name}] - name is None"
                )
                continue

            from_col = _resolve_field_fqn(from_entity, column_name)
            to_col = _resolve_field_fqn(to_entity, dest_column_name)
            if not from_col or not to_col:
                logger.debug(
                    f"Skipping column [{column_name}] -> [{dest_column_name}]"
                    f" for pipeline [{pipeline_name}] - FQN not resolved"
                )
                continue

            col_lineage.append(ColumnLineage(fromColumns=[from_col], toColumn=to_col))

        return col_lineage

    # ------------------------------------------------------------------
    # Pipeline discovery
    # ------------------------------------------------------------------

    def get_pipelines_list(self) -> Iterable[FivetranPipelineDetails]:
        for group in self.fivetran_client.list_groups():
            group_id: str = group.get("id", "")
            try:
                destination = self.fivetran_client.get_destination_details(destination_id=group_id)
            except Exception as exc:
                logger.warning(f"Failed to get destination for group [{group_id}]: {exc}")
                continue
            for connector in self.fivetran_client.list_group_connectors(group_id=group_id):
                connector_id: str = connector.get("id", "")
                try:
                    yield FivetranPipelineDetails(
                        destination=destination,
                        source=self.fivetran_client.get_connector_details(connector_id=connector_id),
                        group=group,
                        connector_id=connector_id,
                    )
                except Exception as exc:
                    logger.warning(f"Failed to get details for connector [{connector_id}] in group [{group_id}]: {exc}")

    def get_pipeline_name(self, pipeline_details: FivetranPipelineDetails) -> str:
        return pipeline_details.pipeline_display_name or pipeline_details.pipeline_name

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_database_name(details: dict) -> Optional[str]:  # noqa: UP045
        """Extract database name from a Fivetran source or destination config.

        Different connector types store the database/catalog/project name
        under different config keys, so we check multiple keys in priority
        order.
        """
        config = details.get("config") or {}
        for key in ("database", "catalog", "project_id", "project"):
            value = config.get(key)
            if value:
                return value
        return None

    @staticmethod
    def _get_schedule_interval(
        pipeline_details: FivetranPipelineDetails,
    ) -> Optional[str]:  # noqa: UP045
        sync_freq = pipeline_details.source.get("sync_frequency")
        if not sync_freq:
            return None
        try:
            minutes = int(sync_freq)
        except (ValueError, TypeError):
            return None
        if minutes <= 0:
            return None
        if minutes < 60:
            return f"*/{minutes} * * * *"
        if minutes % 60 != 0:
            return None
        hours = minutes // 60
        if hours >= 24:
            return "0 0 * * *"
        return f"0 */{hours} * * *"

    @staticmethod
    def _get_pipeline_state(
        pipeline_details: FivetranPipelineDetails,
    ) -> PipelineState:
        if pipeline_details.source.get("paused"):
            return PipelineState.Inactive
        return PipelineState.Active

    def get_source_url(
        self,
        connector_id: Optional[str],  # noqa: UP045
        group_id: Optional[str],  # noqa: UP045
        source_name: Optional[str],  # noqa: UP045
    ) -> Optional[SourceUrl]:  # noqa: UP045
        try:
            if connector_id and group_id and source_name:
                return SourceUrl(
                    f"https://fivetran.com/dashboard/connectors/{connector_id}/status"
                    f"?groupId={group_id}&service={source_name}"
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None
