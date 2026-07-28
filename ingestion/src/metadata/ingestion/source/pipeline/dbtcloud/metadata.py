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
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.progress.modes import TotalsDeclarer
from metadata.ingestion.source.pipeline.dbtcloud.models import DBTJob, DBTModel
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "Success": StatusType.Successful.value,
    "Error": StatusType.Failed.value,
    "Cancelled": StatusType.Skipped.value,
    "Running": StatusType.Pending.value,
    "Starting": StatusType.Pending.value,
    "Queued": StatusType.Pending.value,
    0: StatusType.Pending.value,
    1: StatusType.Successful.value,
    2: StatusType.Skipped.value,
}

WILDCARD_SERVICE = "*"

# Number of (job, run) observability entries kept in memory at once
OBSERVABILITY_CACHE_SIZE = 100

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
        self._warn_on_missing_db_service_names()

    def _warn_on_missing_db_service_names(self) -> None:
        """
        Without ``dbServiceNames`` every dbt node has to be resolved across all
        database services, which is both slower and ambiguous when the same
        database.schema.table exists in more than one service. Say so once at
        startup instead of leaving the user with silently empty lineage.
        """
        if self.source_config.includeLineage and not self.get_db_service_names():
            logger.warning(
                "No 'dbServiceNames' configured for this dbt Cloud service. dbt models will be resolved by "
                "searching every database service, and the first match wins. Set 'dbServiceNames' in the "
                "lineage information to scope resolution to the warehouse dbt actually builds into."
            )

    def _resolve_table_entity(self, db_service_name: Optional[str], node: DBTModel) -> Optional[Table]:  # noqa: UP045
        """
        Resolve the OpenMetadata table backing a dbt model, seed or source.

        Resolution goes through the search index rather than an exact
        ``get_by_name``: ``dbServiceNames`` is optional, and dbt Cloud reports
        database/schema/table names as the warehouse spells them, which does not
        always match the casing OpenMetadata ingested. When no database service
        is configured the service slot becomes a wildcard so the table is looked
        up across every service.
        """
        fqn_search_string = fqn.build_es_fqn_search_string(
            service_name=db_service_name or WILDCARD_SERVICE,
            database_name=node.database,
            schema_name=node.dbtschema,
            table_name=node.name,
        )
        table_entity = self.metadata.search_in_any_service(entity_type=Table, fqn_search_string=fqn_search_string)
        if table_entity is None:
            logger.debug(f"No table found in OpenMetadata for dbt node search string {fqn_search_string}")
        return table_entity

    def _get_task_list(self, job_id: int) -> Optional[List[Task]]:  # noqa: UP006, UP045
        """
        Method to collect all the tasks from dbt cloud job and return it in a task list
        """
        self.context.get().latest_run_id = None
        self.context.get().latest_run = None
        self.context.get().current_job_id = job_id
        self.context.get().current_runs = None
        try:
            task_list: List[Task] = []  # noqa: UP006
            runs_list: List = []  # noqa: UP006
            # Consume generator and store runs for later use
            for run in self.client.get_runs(job_id=job_id):
                runs_list.append(run)
                task = Task(
                    name=str(run.id),
                    sourceUrl=SourceUrl(run.href),
                    startDate=str(run.started_at),
                    endDate=str(run.finished_at),
                )
                task_list.append(task)

            if task_list:
                self.context.get().latest_run_id = runs_list[0].id
                # Store full run object and all runs for observability
                self.context.get().latest_run = runs_list[0] if runs_list else None
                self.context.get().current_runs = runs_list
            return task_list or None  # noqa: TRY300
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

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

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                description=Markdown(pipeline_details.description),
                sourceUrl=SourceUrl(connection_url),
                tasks=self._get_task_list(job_id=pipeline_details.id),
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
                    to_entity_fqn = str(to_entity.fullyQualifiedName.root)
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
                        self._track_table_fqn(str(from_entity.fullyQualifiedName.root), cache_key)

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
                    pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
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

    def _map_run_status(self, status: Any) -> str:
        """Map dbt Cloud run status to OpenMetadata StatusType."""
        if status is None:
            return StatusType.Pending.value
        status_map = {
            "Success": StatusType.Successful.value,
            "Error": StatusType.Failed.value,
            "Cancelled": StatusType.Skipped.value,
            "Running": StatusType.Pending.value,
            "Queued": StatusType.Pending.value,
            0: StatusType.Pending.value,
            1: StatusType.Successful.value,
            2: StatusType.Skipped.value,
        }
        return status_map.get(status, StatusType.Pending.value)

    def _build_observability_from_run(
        self,
        run,
        pipeline_entity: Pipeline,
        schedule_interval: Optional[str] = None,  # noqa: UP045
    ) -> PipelineObservability:
        """Build PipelineObservability object from run data."""
        return PipelineObservability(
            pipeline=EntityReference(
                id=pipeline_entity.id.root if hasattr(pipeline_entity.id, "root") else pipeline_entity.id,
                type="pipeline",
                fullyQualifiedName=pipeline_entity.fullyQualifiedName.root
                if hasattr(pipeline_entity.fullyQualifiedName, "root")
                else str(pipeline_entity.fullyQualifiedName),
            ),
            scheduleInterval=schedule_interval,
            startTime=self._parse_timestamp(run.started_at) if run.started_at else None,
            endTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
            lastRunTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
            lastRunStatus=self._map_run_status(run.state or run.status),
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
                runs = self.client.get_runs(job_id=pipeline_details.id)

            for task in runs or []:
                task_name = str(task.id)
                task_status = TaskStatus(
                    name=task_name,
                    executionStatus=STATUS_MAP.get(task.state, StatusType.Pending),
                    startTime=self._parse_timestamp(task.started_at) if task.started_at else None,
                    endTime=self._parse_timestamp(task.finished_at) if task.finished_at else None,
                )

                status_timestamp = task_status.endTime if task_status.endTime else task_status.startTime
                if status_timestamp is None:
                    logger.debug(
                        f"Skipping pipeline status for task '{task_name}' in pipeline {pipeline_fqn}: "
                        f"run has no start or finish timestamp"
                    )
                    continue

                pipeline_status = PipelineStatus(
                    executionStatus=task_status.executionStatus,
                    taskStatus=[task_status],
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
