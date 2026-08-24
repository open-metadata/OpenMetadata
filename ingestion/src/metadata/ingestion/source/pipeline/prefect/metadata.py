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
Prefect connector for OpenMetadata.
Ingests flows, deployments, run history, and lineage from Prefect Cloud
or a self-hosted Prefect Server.
"""

from __future__ import annotations

import traceback
from datetime import datetime
from itertools import product
from typing import TYPE_CHECKING

from cachetools import LRUCache

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
from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.models.ometa_classification import (
        OMetaTagAndClassification,
    )
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.ingestion.source.pipeline.prefect.client import PrefectClient
    from metadata.ingestion.source.pipeline.prefect.models import (
        PrefectDeployment,
        PrefectFlow,
        PrefectFlowRun,
        PrefectTaskRun,
    )

logger = ingestion_logger()

PREFECT_TAG_CATEGORY = "PrefectTags"

# Map Prefect run states (https://docs.prefect.io/v3/concepts/states) to
# OpenMetadata status types. An unrecognized state (including "UNKNOWN")
# defaults to Pending rather than Failed: seeing a state we don't understand
# is not evidence the run failed.
PREFECT_STATE_MAP = {
    "COMPLETED": StatusType.Successful,
    "FAILED": StatusType.Failed,
    "CRASHED": StatusType.Failed,
    "CANCELLED": StatusType.Failed,
    "RUNNING": StatusType.Pending,
    "PENDING": StatusType.Pending,
    "SCHEDULED": StatusType.Pending,
    "PAUSED": StatusType.Pending,
}


def _parse_timestamp(ts_str: str | None) -> int | None:
    """Convert an ISO timestamp string to a Unix timestamp in milliseconds."""
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        logger.debug("Failed to parse timestamp %r", ts_str, exc_info=True)
        return None


def _as_timestamp(epoch_millis: int | None) -> Timestamp | None:
    """Lift epoch millis into the schema Timestamp the entity models declare."""
    return None if epoch_millis is None else Timestamp(epoch_millis)


def _stable_task_names(task_runs: list[PrefectTaskRun]) -> dict[str, str]:
    """
    Map each task run's id to its task's stable name (``task_key``, not
    ``name`` — ``name`` carries a random suffix that's different on every
    run, ``task_key`` is the same across every run of the same task).

    A task called more than once in one run (e.g. inside a loop) shares one
    task_key across all those calls, so they all resolve to the same Task —
    same as a Pipeline stays one entity across many runs. Their executions
    aren't lost: each still gets its own ``TaskStatus`` entry (see
    ``_build_task_status``), just grouped under that one Task's name instead
    of inventing a separate Task per call.
    """
    return {t.id: t.task_key or t.name or t.id for t in task_runs}


class PrefectSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract pipeline metadata
    from Prefect flows.
    """

    client: PrefectClient

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata) -> None:
        super().__init__(config, metadata)
        # Instance-level cache, not @lru_cache on the method — that keys on
        # self and pins this PrefectSource (and its OM client, topology
        # context) alive for as long as the process runs. Same pattern as
        # PrefectClient's caches and the OpenLineage/dbtcloud connectors.
        self._resolve_table_fqn_cache: LRUCache = LRUCache(maxsize=256)

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> PrefectSource:
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: PrefectConnection = config.serviceConnection.root.config  # pyright: ignore[reportAssignmentType, reportOptionalMemberAccess]
        if not isinstance(connection, PrefectConnection):
            raise InvalidSourceException(f"Expected PrefectConnection, got {connection}")  # pyright: ignore[reportUnreachable]
        return cls(config, metadata)

    def _build_task_dag(self, task_runs: list[PrefectTaskRun]) -> list[Task]:
        """
        Builds Tasks from one flow run's real task runs — a deployment is a
        trigger/schedule config, not a pipeline step, so it's never
        represented as a Task. One Task per unique name (see
        _stable_task_names) — a task called more than once in this run
        contributes one Task, not one per call.
        """
        id_to_name = _stable_task_names(task_runs)
        downstream: dict[str, list[str]] = {name: [] for name in id_to_name.values()}
        tags_by_name: dict[str, set[str]] = {name: set() for name in id_to_name.values()}
        for run in task_runs:
            this_name = id_to_name[run.id]
            tags_by_name[this_name].update(run.tags)
            for refs in run.task_inputs.values():
                for ref in refs:
                    upstream_name = id_to_name.get(ref.id) if ref.id else None
                    if upstream_name and this_name not in downstream[upstream_name]:
                        downstream[upstream_name].append(this_name)
        return [
            Task(  # pyright: ignore[reportCallIssue]
                name=name,
                displayName=name,
                downstreamTasks=targets or None,
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=list(tags_by_name[name]),
                    classification_name=PREFECT_TAG_CATEGORY,
                    include_tags=bool(self.source_config.includeTags),
                )
                or None,
            )
            for name, targets in downstream.items()
        ]

    def _schedule_interval(self, deployments: list[PrefectDeployment]) -> str | None:
        """
        First active schedule of the latest deployment (``get_deployments``
        sorts newest-created first). Prefect 3.x deployments carry a
        ``schedules`` list — each entry wraps one of cron/interval/rrule plus
        an ``active`` flag — there is no singular ``schedule`` field.
        See https://docs.prefect.io/v3/concepts/schedules
        """
        result = None
        if deployments:
            for entry in deployments[0].schedules:
                if not entry.active or entry.schedule is None:
                    continue
                schedule = entry.schedule
                if schedule.cron:
                    result = schedule.cron
                elif schedule.interval:
                    result = f"every {schedule.interval}s"
                elif schedule.rrule:
                    result = schedule.rrule
                if result:
                    break
        return result

    def _get_all_tags(
        self, deployments: list[PrefectDeployment], task_runs: list[PrefectTaskRun] | None = None
    ) -> list[str]:
        """
        Collect all unique tags from deployments and (optionally) task runs.
        Flow-level tags are not a source: nothing in the Prefect SDK writes to
        that field (``@flow`` has no ``tags`` param, ``with tags():`` tags the
        run not the flow), so it is always empty in practice.
        """
        all_tags: set[str] = set()
        for dep in deployments:
            all_tags.update(dep.tags)
        for run in task_runs or []:
            all_tags.update(run.tags)
        return list(all_tags)

    def _parse_lineage_from_tags(self, tags: list[str]) -> tuple[list[str], list[str]]:
        """
        Extract source and destination table identifiers from Prefect flow
        tags: 'om-source:database.schema.table' and
        'om-destination:database.schema.table'. The 'om-' prefix avoids
        colliding with unrelated tagging conventions (e.g. a flow tagged
        'source:kafka' for unrelated reasons).

        Only the prefix is matched case-insensitively; the database/schema/table segments keep
        their original case, since table lookups in OpenMetadata are case-sensitive.

        Returns (source_identifiers, destination_identifiers)
        """
        prefixes = (
            ("om-source:", "source"),
            ("om-destination:", "destination"),
        )

        sources = []
        destinations = []

        for tag in tags or []:
            stripped = tag.strip()
            lowered = stripped.lower()
            for prefix, kind in prefixes:
                if lowered.startswith(prefix):
                    identifier = stripped[len(prefix) :]
                    if identifier:
                        (sources if kind == "source" else destinations).append(identifier)
                    break

        # Remove duplicates while preserving order
        sources = list(dict.fromkeys(sources))
        destinations = list(dict.fromkeys(destinations))

        return sources, destinations

    def _resolve_table_fqn(self, database: str | None, schema: str | None, table: str) -> str | None:
        """
        Resolve a (database, schema, table) triple — either of the first two
        may be ``None`` — to the table's real OpenMetadata FQN by searching
        the configured lineage database services
        (``sourceConfig.lineageInformation.dbServiceNames``).

        Tries each configured service in turn and only accepts a candidate
        FQN once ``get_by_name`` confirms it resolves to a real Table —
        ``fqn.build`` can hand back a guessed FQN for a service that doesn't
        actually have the table, same reasoning as Dagster's
        ``_resolve_asset_to_table``. Rolls its own loop instead of the shared
        ``_get_table_fqn_from_om`` for that reason.

        Cached: the same (database, schema, table) is looked up once per
        flow with tag-based lineage and once per materialization with
        asset-based lineage — across many flows sharing the same source/
        destination table this collapses repeat REST round-trips to one,
        same pattern as ``PrefectClient``'s caches on
        ``get_deployments``/``get_flow_runs``/``get_task_runs``.
        """
        cache_key = (database, schema, table)
        if cache_key in self._resolve_table_fqn_cache:
            return self._resolve_table_fqn_cache[cache_key]
        for db_service in self.get_db_service_names():
            candidate = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=db_service,
                database_name=database,
                schema_name=schema,
                table_name=table,
            )
            if candidate and self.metadata.get_by_name(entity=Table, fqn=candidate):
                self._resolve_table_fqn_cache[cache_key] = candidate
                return candidate
        self._resolve_table_fqn_cache[cache_key] = None
        return None

    @staticmethod
    def _split_lineage_tag_identifier(identifier: str) -> tuple[str, str, str] | None:
        """
        Split a lineage tag's ``<database>.<schema>.<table>`` identifier into
        its three parts. Always required, even for schema-less databases
        (e.g. MySQL) — OpenMetadata still assigns those a real database
        segment (``default``, or the connector's configured
        ``databaseName``), so every table is addressable in exactly 3 parts.
        Tags carry no marker for which segment is missing, so — unlike asset
        keys (see ``_parse_asset_key``, which parses Prefect's own
        already-fixed URI format) — anything but exactly 3 dot-separated
        parts is rejected rather than guessed.
        """
        parts = identifier.split(".")
        if len(parts) != 3:
            logger.warning("Lineage tag must be <database>.<schema>.<table>, got: %s", identifier)
            return None
        return parts[0], parts[1], parts[2]

    @staticmethod
    def _parse_asset_key(asset_key: str) -> tuple[str | None, str | None, str] | None:
        """
        Parse a Prefect asset key URI into (database, schema, table).

        The number of real segments after the host varies by platform —
        Postgres has a schema layer, MySQL doesn't — so this mirrors
        Dagster's ``_resolve_asset_to_table`` length fallback: 3 segments =
        db/schema/table, 2 = db/table, 1 = table only. Non-table assets (e.g.
        ``s3://bucket/key.csv``) and malformed keys return ``None`` — same
        "skip rather than guess" rule ``_split_lineage_tag_identifier`` uses
        for tags.
        """
        if "://" not in asset_key:
            return None
        _, rest = asset_key.split("://", 1)
        parts = [part for part in rest.split("/")[1:] if part]  # drop host segment + empties
        if len(parts) == 3:
            return parts[0], parts[1], parts[2]
        if len(parts) == 2:
            return None, parts[0], parts[1]
        if len(parts) == 1:
            return None, None, parts[0]
        return None

    def _build_task_status(self, task_runs: list[PrefectTaskRun], valid_names: set[str]) -> list[TaskStatus]:
        """
        A historical run's tasks can differ from the pipeline's current task
        list (same flow_id persists across code changes and conditional task
        execution — Prefect looks up flows by name, not by code version).
        The server rejects any taskStatus name absent from Pipeline.tasks, so
        entries outside ``valid_names`` are dropped rather than sent — same
        approach the Airflow connector uses for the identical DAG-drift issue.
        """
        id_to_name = _stable_task_names(task_runs)
        return [
            TaskStatus(  # pyright: ignore[reportCallIssue]
                name=id_to_name[run.id],
                executionStatus=PREFECT_STATE_MAP.get((run.state_type or "UNKNOWN").upper(), StatusType.Pending),
                startTime=_as_timestamp(_parse_timestamp(run.start_time or run.expected_start_time)),
                endTime=_as_timestamp(_parse_timestamp(run.end_time)),
            )
            for run in task_runs
            if id_to_name[run.id] in valid_names
        ]

    def _build_pipeline_status(self, flow_runs: list[PrefectFlowRun], valid_names: set[str]) -> list[PipelineStatus]:
        """
        Convert Prefect flow runs to OpenMetadata PipelineStatus, with each
        run's real task runs nested as ``taskStatus``. Always a list, never
        ``None`` — the server iterates ``taskStatus`` without a null guard, so
        a `null` here 500s even though the schema marks the field optional.
        """
        statuses = []
        task_runs_by_run = self.client.get_task_runs_for_flow_runs([run.id for run in flow_runs])
        for run in flow_runs:
            # In Prefect 3.x, use state_type (top-level) or state.type (nested)
            state_type = run.state_type or (run.state.type if run.state else None) or "UNKNOWN"
            state_type = state_type.upper()
            om_status = PREFECT_STATE_MAP.get(state_type, StatusType.Pending)

            start_time = _parse_timestamp(run.start_time or run.expected_start_time)
            if start_time is None:
                # PipelineStatus.timestamp is a required field — a run with
                # neither start_time nor expected_start_time can't produce
                # one, so skip it rather than fail the whole status batch.
                logger.debug("Skipping status for run %s: no start_time or expected_start_time", run.id)
                continue
            end_time = _parse_timestamp(run.end_time)

            task_runs = task_runs_by_run.get(run.id, [])
            pipeline_status = PipelineStatus(  # pyright: ignore[reportCallIssue]
                executionStatus=om_status,
                taskStatus=self._build_task_status(task_runs, valid_names),
                timestamp=Timestamp(start_time),
                endTime=_as_timestamp(end_time),
            )
            statuses.append(pipeline_status)
        return statuses

    def yield_tag(self, pipeline_details: PrefectFlow) -> Iterable[Either[OMetaTagAndClassification]]:
        """Create the classification and tags for this flow's deployments and its latest run's task tags."""
        flow_id = pipeline_details.id
        deployments = self.client.get_deployments(flow_id)
        latest_run = self.client.get_flow_runs(flow_id, limit=1)
        task_runs = self.client.get_task_runs(latest_run[0].id) if latest_run else []
        all_tags = self._get_all_tags(deployments, task_runs)
        yield from get_ometa_tag_and_classification(
            tags=all_tags,
            classification_name=PREFECT_TAG_CATEGORY,
            tag_description="Prefect Tag",
            classification_description="Tags associated with Prefect flows, deployments, and tasks",
            include_tags=bool(self.source_config.includeTags),
        )

    def yield_pipeline(self, pipeline_details: PrefectFlow) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Prefect flow into an OpenMetadata CreatePipelineRequest.
        """
        try:
            flow_id = pipeline_details.id
            flow_name = pipeline_details.name
            logger.info("Processing flow: %s", flow_name)

            deployments = self.client.get_deployments(flow_id)
            logger.debug("Found %d deployments for %s", len(deployments), flow_name)

            all_tags = self._get_all_tags(deployments)
            logger.debug("Tags for %s: %s", flow_name, all_tags)

            tag_labels = get_tag_labels(
                metadata=self.metadata,
                tags=all_tags,
                classification_name=PREFECT_TAG_CATEGORY,
                include_tags=bool(self.source_config.includeTags),
            )

            schedule_interval = self._schedule_interval(deployments)

            latest_run = self.client.get_flow_runs(flow_id, limit=1)
            task_runs = self.client.get_task_runs(latest_run[0].id) if latest_run else []
            tasks = self._build_task_dag(task_runs)
            # Stashed for yield_pipeline_status to filter historical taskStatus
            # entries against, same pattern as the Airflow connector — avoids
            # re-fetching the same latest run's tasks a second time.
            self.context.get().task_names = {task.name for task in tasks}  # pyright: ignore[reportAttributeAccessIssue]

            auth = self.service_connection.authType
            if isinstance(auth, PrefectCloudAuthentication):
                source_url = (
                    f"https://app.prefect.cloud/account/{auth.accountId}"
                    f"/workspace/{auth.workspaceId}/flows/flow/{flow_id}"
                )
            else:
                # Self-hosted Prefect Server mode. hostPort may carry the
                # /api suffix (the client strips it the same way for API
                # calls) — the Prefect UI itself is served without it.
                ui_host = clean_uri(str(self.service_connection.hostPort)).removesuffix("/api")
                source_url = f"{ui_host}/flows/flow/{flow_id}"

            service_fqn = self.context.get().pipeline_service  # pyright: ignore[reportAttributeAccessIssue]

            create_request = CreatePipelineRequest(  # pyright: ignore[reportCallIssue]
                name=EntityName(flow_name),
                displayName=flow_name,
                scheduleInterval=schedule_interval,
                sourceUrl=SourceUrl(source_url),
                tasks=tasks or None,
                tags=tag_labels if tag_labels else None,
                service=FullyQualifiedEntityName(service_fqn),
            )

            logger.info("Yielding pipeline request for %s", flow_name)
            yield Either(right=create_request)  # pyright: ignore[reportCallIssue]
            self.register_record(pipeline_request=create_request)

        except Exception as exc:
            # Defensive default: yield_pipeline_status reads context.task_names
            # back — without this, a flow that fails here leaves it unset.
            self.context.get().task_names = set()  # pyright: ignore[reportAttributeAccessIssue]
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Failed to yield pipeline for flow {pipeline_details.name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(self, pipeline_details: PrefectFlow) -> Iterable[Either[OMetaPipelineStatus]]:
        """Yield run history for each flow as pipeline status, each with that run's real task statuses nested."""
        try:
            flow_id = pipeline_details.id
            flow_runs = self.client.get_flow_runs(flow_id, limit=self.service_connection.numberOfStatus)
            valid_names = self.context.get().task_names or set()  # pyright: ignore[reportAttributeAccessIssue]
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,  # pyright: ignore[reportAttributeAccessIssue]
                pipeline_name=self.context.get().pipeline,  # pyright: ignore[reportAttributeAccessIssue]
            )
            for status in self._build_pipeline_status(flow_runs, valid_names):
                yield Either(right=OMetaPipelineStatus(pipeline_fqn=pipeline_fqn, pipeline_status=status))  # pyright: ignore[reportCallIssue, reportArgumentType]
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Failed to yield status for flow {pipeline_details.name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_lineage_from_assets(
        self, flow_run_id: str, pipeline_entity: Pipeline
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Cloud-only lineage: exact upstream/downstream asset pairs for one flow
        run, from Prefect's native Assets API
        (https://docs.prefect.io/v3/concepts/assets). Unlike tags this is
        scoped to a single run — no cross-deployment mixing — and needs no
        user-authored convention, just normal ``@materialize``/``asset_deps``
        usage. Yields nothing if this run has no materializations, so the
        caller falls back to tag-based lineage.
        """
        materializations = self.client.get_asset_materializations(flow_run_id)
        if not materializations:
            return

        lineage_details = LineageDetails(  # pyright: ignore[reportCallIssue]
            pipeline=EntityReference(id=pipeline_entity.id, type="pipeline"),  # pyright: ignore[reportCallIssue]
            source=LineageSource.PipelineLineage,
        )
        for entry in materializations:
            downstream_parts = self._parse_asset_key(entry.asset_key or "")
            dest_table_fqn = downstream_parts and self._resolve_table_fqn(*downstream_parts)
            dest_table = dest_table_fqn and self.metadata.get_by_name(entity=Table, fqn=dest_table_fqn)
            if not dest_table:
                continue

            for upstream_key in entry.upstream_assets:
                upstream_parts = self._parse_asset_key(upstream_key)
                source_table_fqn = upstream_parts and self._resolve_table_fqn(*upstream_parts)
                source_table = source_table_fqn and self.metadata.get_by_name(entity=Table, fqn=source_table_fqn)
                if not source_table:
                    continue
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(id=source_table.id, type="table"),  # pyright: ignore[reportCallIssue]
                            toEntity=EntityReference(id=dest_table.id, type="table"),  # pyright: ignore[reportCallIssue]
                            lineageDetails=lineage_details,
                        )
                    )
                )

    def yield_pipeline_lineage_details(self, pipeline_details: PrefectFlow) -> Iterable[Either[AddLineageRequest]]:
        """
        Yield table-to-table lineage edges for this pipeline. On Prefect
        Cloud, tries the native Assets API first (``_yield_lineage_from_assets``)
        since it gives exact per-run pairs with no cross-deployment ambiguity;
        falls back to lineage tags — self-hosted always does, since it has no
        Assets API at all, and so does Cloud when a run has no materializations.

        Tag-based fallback: re-derives tags from ``get_deployments`` directly
        (the same deployment tags ``yield_pipeline`` used to build
        ``Pipeline.tags``) instead of reading them off the persisted entity —
        that entity has no tags at all when ``includeTags=False``, which
        silently dropped lineage. ``get_deployments`` caches on ``PrefectClient``'s
        instance-level ``_deployments_cache``, so this costs no extra call
        within one ingestion run.
        Lineage is detected from tags: 'om-source:<database>.<schema>.<table>'
        and 'om-destination:<database>.<schema>.<table>'. Every detected
        source is linked to every detected destination, since tags carry no
        per-pair mapping. Requires ``sourceConfig.lineageInformation
        .dbServiceNames`` to be configured with the database service(s) the
        tagged tables live in.
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,  # pyright: ignore[reportAttributeAccessIssue]
                pipeline_name=self.context.get().pipeline,  # pyright: ignore[reportAttributeAccessIssue]
            )
            pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)  # pyright: ignore[reportArgumentType]
            if not pipeline_entity:
                logger.warning("Pipeline entity not found for %s", pipeline_fqn)
                return

            if isinstance(self.service_connection.authType, PrefectCloudAuthentication):
                latest_run = self.client.get_flow_runs(pipeline_details.id, limit=1)
                if latest_run:
                    asset_edges = list(self._yield_lineage_from_assets(latest_run[0].id, pipeline_entity))
                    if asset_edges:
                        yield from asset_edges
                        return

            all_tags = self._get_all_tags(self.client.get_deployments(pipeline_details.id))
            sources, destinations = self._parse_lineage_from_tags(all_tags)

            if not sources or not destinations:
                # A table-to-table edge needs both ends; nothing to draw otherwise
                logger.debug("No source/destination lineage tag pair for flow %s", pipeline_details.name)
                return

            lineage_details = LineageDetails(  # pyright: ignore[reportCallIssue]
                pipeline=EntityReference(id=pipeline_entity.id, type="pipeline"),  # pyright: ignore[reportCallIssue]
                source=LineageSource.PipelineLineage,
            )

            # Resolve each side once — every source is linked to every
            # destination (see docstring), so re-resolving a destination
            # inside the source loop repeats the same lookup once per source.
            # Same resolve-once-then-product shape as the OpenLineage connector.
            resolved_sources = []
            for source_identifier in sources:
                source_parts = self._split_lineage_tag_identifier(source_identifier)
                source_table_fqn = source_parts and self._resolve_table_fqn(*source_parts)
                source_table = source_table_fqn and self.metadata.get_by_name(entity=Table, fqn=source_table_fqn)
                if source_table:
                    resolved_sources.append((source_identifier, source_table))
                else:
                    logger.warning("Source table not found in OpenMetadata: %s", source_identifier)

            resolved_destinations = []
            for dest_identifier in destinations:
                dest_parts = self._split_lineage_tag_identifier(dest_identifier)
                dest_table_fqn = dest_parts and self._resolve_table_fqn(*dest_parts)
                dest_table = dest_table_fqn and self.metadata.get_by_name(entity=Table, fqn=dest_table_fqn)
                if dest_table:
                    resolved_destinations.append((dest_identifier, dest_table))
                else:
                    logger.warning("Destination table not found in OpenMetadata: %s", dest_identifier)

            for (source_identifier, source_table), (dest_identifier, dest_table) in product(
                resolved_sources, resolved_destinations
            ):
                logger.info("Creating lineage: %s -> %s", source_identifier, dest_identifier)
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(id=source_table.id, type="table"),  # pyright: ignore[reportCallIssue]
                            toEntity=EntityReference(id=dest_table.id, type="table"),  # pyright: ignore[reportCallIssue]
                            lineageDetails=lineage_details,
                        )
                    )
                )

        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Failed to yield lineage for flow {pipeline_details.name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[PrefectFlow]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Get List of all Prefect flows."""
        yield from self.client.get_flows()

    def get_pipeline_name(self, pipeline_details: PrefectFlow) -> str:
        """Return the flow name to use as pipeline name."""
        return pipeline_details.name
