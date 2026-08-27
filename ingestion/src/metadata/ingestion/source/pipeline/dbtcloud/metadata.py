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
DBTcloud source to extract metadata from OM UI
"""

import traceback
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple  # noqa: UP035

from cachetools import LRUCache
from pydantic import AnyUrl

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
from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection,
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
    Markdown,
    SourceUrl,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.pipelineObservability import (
    LastRunStatus,
    PipelineObservability,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.progress.modes import TotalsDeclarer
from metadata.ingestion.source.pipeline.dbtcloud.models import DBTJob, DBTModel, DBTRun
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# dbt Cloud reports a run/step state both as text and as an integer code. The
# integer codes are the ones documented for the v2 API - note that 1 is Queued,
# not Success.
STATUS_MAP = {
    "Success": StatusType.Successful.value,
    "Error": StatusType.Failed.value,
    "Cancelled": StatusType.Skipped.value,
    "Running": StatusType.Pending.value,
    "Starting": StatusType.Pending.value,
    "Queued": StatusType.Pending.value,
    1: StatusType.Pending.value,
    2: StatusType.Pending.value,
    3: StatusType.Pending.value,
    10: StatusType.Successful.value,
    20: StatusType.Failed.value,
    30: StatusType.Skipped.value,
}

WILDCARD_SERVICE = "*"

# A dbt Cloud job is modelled as this single task, against which every run is
# reported. The job's run steps are the same clone/profile/deps/invoke sequence on
# every pipeline, and materialising them as tasks costs an expanded API call per
# job (~1.5s per run) while telling the user nothing the run status does not.
DEFAULT_TASK_NAME = "Run"

# Number of (job, run) observability entries kept in memory at once
OBSERVABILITY_CACHE_SIZE = 100

# Number of exact-FQN table lookups kept in memory at once
EXACT_FQN_CACHE_SIZE = 1024

# Number of unmatched dbt node ids listed in the "no lineage created" warning
UNMATCHED_NODES_SAMPLE_SIZE = 10


class DbtcloudSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from DBT cloud
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DBTCloudConnection = config.serviceConnection.root.config
        if not isinstance(connection, DBTCloudConnection):
            raise InvalidSourceException(f"Expected DBTCloudConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        # Bounded cache for observability data: {(job_id, run_id): {pipeline_entity, runs, ...}}.
        # Each entry retains a full Pipeline entity plus its run history, so it has to be
        # capped: an unbounded dict grows with the number of jobs in the dbt Cloud account.
        self.observability_cache: LRUCache = LRUCache(maxsize=OBSERVABILITY_CACHE_SIZE)
        # Bounded cache for resolved SQL dialects keyed by database service name
        self._dialect_cache: LRUCache = LRUCache(maxsize=128)
        # Bounded cache for the exact-FQN table fallback, keyed by table FQN
        self._exact_fqn_cache: LRUCache = LRUCache(maxsize=EXACT_FQN_CACHE_SIZE)

    def _resolve_table_entity(self, db_service_name: Optional[str], node: DBTModel) -> Optional[Table]:  # noqa: UP045
        """
        Resolve the OpenMetadata table backing a dbt model, seed or source.

        The search index is the primary lookup: ``dbServiceNames`` is optional,
        and with no configured service the slot becomes a wildcard so the table
        is found across every service. The entity comes straight out of the
        search hit, which saves the extra ``get_by_name`` round trip the caller
        used to pay on top of the search ``fqn.build`` already performed.

        A configured service falls back to an exact lookup, because the FQN is
        then deterministic and must stay resolvable while the search index is
        stale, still building, or unreachable.
        """
        fqn_search_string = fqn.build_es_fqn_search_string(
            service_name=db_service_name or WILDCARD_SERVICE,
            database_name=node.database,
            schema_name=node.dbtschema,
            table_name=node.name,
        )
        matches = (
            self.metadata.search_in_any_service(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
                fetch_multiple_entities=True,
            )
            or []
        )
        table_entity = self._pick_matching_table(matches, node)
        if table_entity is None and db_service_name:
            table_entity = self._get_table_by_exact_fqn(db_service_name, node)
        if table_entity is None:
            logger.debug(f"No table found in OpenMetadata for dbt node search string {fqn_search_string}")
        return table_entity

    @staticmethod
    def _pick_matching_table(matches: List[Table], node: DBTModel) -> Optional[Table]:  # noqa: UP006, UP045
        """
        Pick one table out of a search page.

        The search is scored, not exact, so hits are first narrowed to the ones
        whose database/schema/name actually equal the dbt node's - case
        insensitively, since the warehouse and OpenMetadata may not agree on
        casing. The remainder is sorted before picking: the wildcard search can
        legitimately match the same table in several services, and taking the
        raw first hit would make the chosen edge flip between runs.
        """
        wanted = [str(part).lower() for part in (node.database, node.dbtschema, node.name)]
        exact = [
            table
            for table in matches
            if [part.lower() for part in fqn.split(DbtcloudSource._table_fqn(table))[-3:]] == wanted
        ]
        picked = None
        if exact:
            exact.sort(key=DbtcloudSource._table_fqn)
            picked = exact[0]
            if len(exact) > 1:
                logger.warning(
                    f"dbt node {node.uniqueId} matches {len(exact)} tables across services "
                    f"({[DbtcloudSource._table_fqn(table) for table in exact]}); using "
                    f"{DbtcloudSource._table_fqn(picked)}. Set 'dbServiceNames' to disambiguate."
                )
        return picked

    @staticmethod
    def _table_fqn(table: Table) -> str:
        """FQN of a resolved table as a plain string."""
        return model_str(table.fullyQualifiedName) if table.fullyQualifiedName else ""

    def _get_table_by_exact_fqn(self, db_service_name: str, node: DBTModel) -> Optional[Table]:  # noqa: UP045
        """
        Look the table up by its deterministic FQN, bypassing the search index.

        Cached, unlike the search that precedes it: ``_search_es_entity`` already
        memoises every search behind an LRU, but ``get_by_name`` is a plain REST
        call and a table shared by several dbt models is resolved once per model.
        Misses are cached too - this only runs once the search has already
        failed, so an unresolvable node is the hot path here.
        """
        table_fqn = fqn.build(
            metadata=None,
            entity_type=Table,
            service_name=db_service_name,
            database_name=node.database,
            schema_name=node.dbtschema,
            table_name=node.name,
            skip_es_search=True,
        )
        if not table_fqn:
            return None
        if table_fqn not in self._exact_fqn_cache:
            self._exact_fqn_cache[table_fqn] = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        return self._exact_fqn_cache[table_fqn]

    def _fetch_runs(self, job_id: int) -> List[DBTRun]:  # noqa: UP006
        """
        Runs backing the pipeline status time series.

        The lookback window is pushed to the API, so runs older than
        ``statusLookbackDays`` are never transferred or paginated over. A job
        that has not run inside the window still falls back to its most recent
        run whatever its age, so a dormant pipeline keeps its last known
        execution instead of showing none.
        """
        lookback_days = self.source_config.statusLookbackDays
        runs = list(self.client.get_runs(job_id=job_id, lookback_days=lookback_days))
        if not runs:
            logger.debug(
                f"No dbt Cloud run for job {job_id} within the last {lookback_days} day(s); "
                f"falling back to the latest run"
            )
            latest_run = self.client.get_latest_run(job_id=job_id)
            runs = [latest_run] if latest_run else []
        return runs

    def _load_runs(self, job: DBTJob) -> None:
        """
        Fetch the job's runs once and hold them on the context.

        The status stage reports them and the lineage stage needs the newest run
        id for its GraphQL query, so fetching here keeps both stages to a single
        call per job.
        """
        ctx = self.context.get()
        ctx.latest_run_id = None
        ctx.latest_run = None
        ctx.current_job_id = job.id
        ctx.current_runs = None
        try:
            runs = self._fetch_runs(job_id=job.id)
            if runs:
                ctx.latest_run_id = runs[0].id
                ctx.latest_run = runs[0]
                ctx.current_runs = runs
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get runs of job {job.name} due to : {exc}")

    @staticmethod
    def _get_task_list(job_url: str) -> List[Task]:  # noqa: UP006
        """
        The job's single task, carrying its whole run history.

        Deriving tasks from the job's run steps would need a step-expanded API
        call per job and yields the same clone/profile/deps/invoke sequence for
        every pipeline. Reporting each run against one task keeps the executions
        visible instead: the UI builds the Executions tab purely out of task
        statuses, so a run recorded at pipeline level alone renders as nothing.
        """
        return [
            Task(
                name=DEFAULT_TASK_NAME,
                displayName=DEFAULT_TASK_NAME,
                sourceUrl=SourceUrl(job_url) if job_url else None,
            )
        ]

    def yield_pipeline(self, pipeline_details: DBTJob) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Method to Get Pipeline Entity
        """
        try:
            connection_url = (
                f"{clean_uri(self.service_connection.host)}/deploy/"
                f"{self.service_connection.accountId}/projects/"
                f"{pipeline_details.project_id}/jobs/{pipeline_details.id}"
            )

            self._load_runs(pipeline_details)

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                description=Markdown(pipeline_details.description),
                sourceUrl=SourceUrl(connection_url),
                tasks=self._get_task_list(job_url=connection_url),
                scheduleInterval=(str(pipeline_details.schedule.cron) if pipeline_details.schedule else None),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(self, pipeline_details: DBTJob) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources.
        Uses combined GraphQL call for models and seeds, with optimized caching.
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)

            if not pipeline_entity:
                logger.warning(f"Pipeline entity not found for FQN: {pipeline_fqn}")
                return

            # Use combined GraphQL call instead of two separate calls
            dbt_models, dbt_seeds, dbt_sources = self.client.get_models_with_lineage(
                job_id=pipeline_details.id, run_id=self.context.get().latest_run_id
            )

            # Combine models and seeds for parent lookup
            dbt_parents = (dbt_models or []) + (dbt_seeds or []) + (dbt_sources or [])

            # Build parent lookup dict for O(1) access instead of O(n) list search
            parent_by_unique_id = {p.uniqueId: p for p in dbt_parents if p.uniqueId}

            # Cache observability details - store in context for current job
            self.context.get().current_pipeline_entity = pipeline_entity
            self.context.get().current_table_fqns = set()
            # Store pipeline FQN from entity to ensure exact match for status updates
            self.context.get().pipeline_fqn = str(pipeline_entity.fullyQualifiedName.root)

            # Create cache_key once at the start
            cache_key = (
                (pipeline_details.id, str(self.context.get().latest_run_id))
                if self.context.get().latest_run_id
                else None
            )

            if cache_key:
                self.observability_cache[cache_key] = {
                    "pipeline_entity": pipeline_entity,
                    "job_details": pipeline_details,
                    "table_fqns": set(),  # Use set for O(1) lookup
                    "runs": self.context.get().current_runs,
                }

            # A node is only reported as unmatched when *no* configured database
            # service resolves it, hence the two sets rather than a counter.
            resolved_nodes = set()
            unmatched_nodes = set()

            for model in dbt_models or []:
                if not self._is_lineage_candidate(model, is_source=False):
                    continue

                for db_service_name in self.get_db_service_names() or [None]:
                    to_entity = self._resolve_table_entity(db_service_name, model)

                    if to_entity is None:
                        unmatched_nodes.add(model.uniqueId)
                        continue

                    resolved_nodes.add(model.uniqueId)

                    # The resolved entity's own FQN is used downstream: the FQN built from
                    # the dbt node would carry the "*" wildcard as service name whenever no
                    # dbServiceNames are configured.
                    to_entity_fqn = self._table_fqn(to_entity)
                    self._track_table_fqn(to_entity_fqn, cache_key)

                    if model.compiledCode:
                        yield from self._yield_column_lineage(  # pyright: ignore[reportReturnType]
                            model=model,
                            to_entity_fqn=to_entity_fqn,
                        )

                    for unique_id in model.dependsOn or []:
                        parent = parent_by_unique_id.get(unique_id)
                        if not parent:
                            continue

                        if not self._is_lineage_candidate(parent, is_source=unique_id.startswith("source.")):
                            continue

                        from_entity = self._resolve_table_entity(db_service_name, parent)

                        if from_entity is None:
                            unmatched_nodes.add(unique_id)
                            continue

                        resolved_nodes.add(unique_id)
                        self._track_table_fqn(self._table_fqn(from_entity), cache_key)

                        yield Either(right=self._build_lineage_request(from_entity, to_entity, pipeline_entity))

            self._warn_on_unmatched_nodes(pipeline_details, unmatched_nodes - resolved_nodes)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    @staticmethod
    def _warn_on_unmatched_nodes(pipeline_details: DBTJob, unmatched_nodes: set) -> None:
        """
        Lineage for a dbt node is dropped when its table is not in OpenMetadata.
        Report it: an empty lineage result otherwise looks like a successful run.
        """
        if unmatched_nodes:
            sample = sorted(unmatched_nodes)[:UNMATCHED_NODES_SAMPLE_SIZE]
            logger.warning(
                f"{len(unmatched_nodes)} dbt node(s) of job {pipeline_details.name} could not be matched to a "
                f"table in OpenMetadata, so no lineage was created for them. Ingest the warehouse holding those "
                f"tables first and check the 'dbServiceNames' lineage configuration. Unmatched (first "
                f"{len(sample)}): {sample}"
            )

    @staticmethod
    def _is_lineage_candidate(node: DBTModel, is_source: bool) -> bool:
        """
        A dbt node can only be matched to a table when it carries a full
        database/schema/name triple and the run that produced it is known.
        Sources are exempt from the run check: they are auto-generated and never
        carry a ``runGeneratedAt``.
        """
        is_candidate = True
        if not is_source and not node.runGeneratedAt:
            logger.debug(f"Skipping dbt node with missing runGeneratedAt: name={node.name}")
            is_candidate = False
        elif not all([node.name, node.database, node.dbtschema]):
            logger.debug(
                f"Skipping dbt node with missing attributes: name={node.name}, "
                f"database={node.database}, schema={node.dbtschema}"
            )
            is_candidate = False
        return is_candidate

    def _track_table_fqn(self, table_fqn: str, cache_key: Optional[Tuple[int, str]]) -> None:  # noqa: UP006, UP045
        """
        Record a resolved table FQN so the observability stage can attach the
        job's run data to it, both for the pipeline being processed and for the
        cached historical runs. Both collections are sets: a dbt job routinely
        resolves the same table once per model that depends on it.
        """
        self.context.get().current_table_fqns.add(table_fqn)
        if cache_key and cache_key in self.observability_cache:
            self.observability_cache[cache_key]["table_fqns"].add(table_fqn)

    @staticmethod
    def _build_lineage_request(from_entity: Table, to_entity: Table, pipeline_entity: Pipeline) -> AddLineageRequest:
        """Build the table-to-table edge produced by a dbt job."""
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=from_entity.id, type="table"),
                toEntity=EntityReference(id=to_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    pipeline=EntityReference(id=pipeline_entity.id, type="pipeline"),
                    source=LineageSource.PipelineLineage,
                ),
            )
        )

    def _resolve_dialect(self, db_service_name: str) -> Dialect:
        """
        Resolve the SQL dialect for a configured database service so the compiled
        dbt model SQL can be parsed for column-level lineage.
        """
        if db_service_name not in self._dialect_cache:
            dialect = Dialect.ANSI
            db_service = self.metadata.get_by_name(entity=DatabaseService, fqn=db_service_name)
            if db_service and db_service.serviceType:
                dialect = ConnectionTypeDialectMapper.dialect_of(db_service.serviceType.value)
            self._dialect_cache[db_service_name] = dialect
        return self._dialect_cache[db_service_name]

    def _yield_column_lineage(self, model: DBTModel, to_entity_fqn: str) -> Iterable[Either[LineageRequest]]:
        """
        Parse the compiled dbt model SQL to build column-level lineage from the
        model's upstream tables to the model table.
        """
        try:
            source_elements = fqn.split(to_entity_fqn)
            query_fqn = fqn._build(*source_elements[-3:])  # pylint: disable=protected-access
            query_fqn = ".".join([f'"{element}"' for element in query_fqn.split(".")])
            query = f"create table {query_fqn} as {model.compiledCode}"
            yield from get_lineage_by_query(
                self.metadata,
                query=query,
                service_names=source_elements[0],
                database_name=source_elements[1],
                schema_name=source_elements[2],
                dialect=self._resolve_dialect(source_elements[0]),
                timeout_seconds=LINEAGE_PARSING_TIMEOUT,
                lineage_source=LineageSource.DbtLineage,
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to parse compiled SQL for column lineage of model {model.name}: {exc}")

    def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
        """Seed the ``Pipeline`` denominator from the dbt Cloud job count.

        Skipped when a ``pipelineFilterPattern`` is configured: the count sums
        the API's job ``total_count`` and cannot honor the include/exclude
        regex, so the declared total would overstate the pipelines actually
        processed. Since ``Pipeline`` is a leaf counter that is never reconciled
        down, a filtered run would otherwise sit permanently below 100%; fall
        back to denominator-less progress instead."""
        if self.has_pipeline_filter():
            return
        count = self.client.get_jobs_count()
        if isinstance(count, int) and count > 0:
            totals.set_total("Pipeline", count)

    def get_pipelines_list(self) -> Iterable[DBTJob]:
        """
        Get List of all pipelines
        """
        try:
            yield from self.client.get_jobs()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: DBTJob) -> str:
        """
        Get Pipeline Name
        """
        try:
            return pipeline_details.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def _parse_timestamp(self, timestamp_str: str) -> Optional[Timestamp]:  # noqa: UP045
        """Parse ISO timestamp string to Timestamp."""
        try:
            # Try primary format
            dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f%z")
            return Timestamp(datetime_to_ts(dt))
        except ValueError:
            try:
                # Try fallback format
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                return Timestamp(datetime_to_ts(dt))
            except Exception as exc:
                logger.warning(f"Failed to parse timestamp '{timestamp_str}': {exc}")
                return None

    @staticmethod
    def _map_run_status(status: Any) -> str:
        """Map dbt Cloud run status to OpenMetadata StatusType."""
        return STATUS_MAP.get(status, StatusType.Pending.value)

    def _build_task_statuses(self, run: DBTRun) -> List[TaskStatus]:  # noqa: UP006
        """
        The run's outcome, reported against the pipeline's single task.

        Always one entry: the Executions tab iterates ``taskStatus`` and never
        reads the pipeline level ``executionStatus``, so a run reported without
        one is invisible in the UI - and ``PipelineRepository.addPipelineStatus``
        iterates the list without a null check, answering HTTP 500 on a null.
        """
        return [
            TaskStatus(
                name=DEFAULT_TASK_NAME,
                executionStatus=StatusType(self._map_run_status(run.state or run.status)),
                startTime=self._parse_timestamp(run.started_at) if run.started_at else None,
                endTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
                logLink=AnyUrl(run.href) if run.href else None,
            )
        ]

    def _build_observability_from_run(
        self,
        run,
        pipeline_entity: Pipeline,
        schedule_interval: Optional[str] = None,  # noqa: UP045
    ) -> PipelineObservability:
        """Build PipelineObservability object from run data."""
        return PipelineObservability(
            pipeline=EntityReference(
                id=pipeline_entity.id,
                type="pipeline",
                fullyQualifiedName=pipeline_entity.fullyQualifiedName.root
                if hasattr(pipeline_entity.fullyQualifiedName, "root")
                else str(pipeline_entity.fullyQualifiedName),
            ),
            scheduleInterval=schedule_interval,
            startTime=self._parse_timestamp(run.started_at) if run.started_at else None,
            endTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
            lastRunTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
            lastRunStatus=LastRunStatus(self._map_run_status(run.state or run.status)),
        )

    def get_table_pipeline_observability(
        self, pipeline_details: DBTJob
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:  # noqa: UP006
        """
        Extract pipeline observability data from cached lineage artifacts.
        Uses context data first (current job), falls back to cache for historical data.
        """
        try:
            table_pipeline_map: Dict[str, List[PipelineObservability]] = defaultdict(list)  # noqa: UP006

            ctx = self.context.get()
            if (
                hasattr(ctx, "current_table_fqns")
                and hasattr(ctx, "latest_run")
                and hasattr(ctx, "current_pipeline_entity")
                and ctx.latest_run
                and ctx.current_pipeline_entity
                and ctx.current_table_fqns
            ):
                logger.debug(f"Using context data for observability - {len(ctx.current_table_fqns)} tables")

                schedule_interval = str(pipeline_details.schedule.cron) if pipeline_details.schedule else None

                # using cached table FQNs directly from lineage processing
                for table_fqn in ctx.current_table_fqns:
                    observability = self._build_observability_from_run(
                        run=ctx.latest_run,
                        pipeline_entity=ctx.current_pipeline_entity,
                        schedule_interval=schedule_interval,
                    )

                    table_pipeline_map[table_fqn].append(observability)

            for cache_key, cached_data in self.observability_cache.items():
                job_id, run_id = cache_key

                if hasattr(ctx, "current_job_id") and job_id == ctx.current_job_id:
                    continue

                table_fqns = cached_data.get("table_fqns", set())
                pipeline_entity = cached_data.get("pipeline_entity")
                job_details = cached_data.get("job_details")
                runs = cached_data.get("runs")

                if not pipeline_entity or not table_fqns or not runs:
                    continue

                run = next((r for r in runs if str(r.id) == str(run_id)), None)

                if not run:
                    continue

                schedule_interval = (
                    str(job_details.schedule.cron)
                    if job_details and job_details.schedule and job_details.schedule.cron
                    else None
                )

                # using cached table FQNs directly from lineage processing
                for table_fqn in table_fqns:
                    observability = self._build_observability_from_run(
                        run=run,
                        pipeline_entity=pipeline_entity,
                        schedule_interval=schedule_interval,
                    )

                    table_pipeline_map[table_fqn].append(observability)

            yield table_pipeline_map

        except Exception as exc:
            logger.error(f"Failed to extract pipeline observability data: {exc}")
            logger.debug(traceback.format_exc())

    def yield_pipeline_status(self, pipeline_details: DBTJob) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:
            # Build the FQN from the per-pipeline context every time. The cached
            # ctx.pipeline_fqn is written by yield_pipeline_lineage_details, which
            # runs *after* this stage, so reusing it here would attach the current
            # pipeline's task statuses to the previous pipeline's FQN.
            ctx = self.context.get()
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=ctx.pipeline_service,  # pyright: ignore[reportAttributeAccessIssue]
                pipeline_name=ctx.pipeline,  # pyright: ignore[reportAttributeAccessIssue]
            )

            # using cached runs from context instead of making another API call
            runs = ctx.current_runs if hasattr(ctx, "current_runs") and ctx.current_runs else None
            if not runs:
                runs = self._fetch_runs(job_id=pipeline_details.id)

            for run in runs or []:
                start_time = self._parse_timestamp(run.started_at) if run.started_at else None
                end_time = self._parse_timestamp(run.finished_at) if run.finished_at else None

                status_timestamp = end_time if end_time else start_time
                if status_timestamp is None:
                    logger.debug(
                        f"Skipping pipeline status for run '{run.id}' in pipeline {pipeline_fqn}: "
                        f"run has no start or finish timestamp"
                    )
                    continue

                pipeline_status = PipelineStatus(
                    executionStatus=StatusType(self._map_run_status(run.state or run.status)),
                    taskStatus=self._build_task_statuses(run),
                    timestamp=status_timestamp,
                )

                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline status {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
