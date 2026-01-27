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
from typing import Any, Dict, Iterable, List, Optional, Tuple

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
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.dbtcloud.models import DBTJob
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


class DbtcloudSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from DBT cloud
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DBTCloudConnection = config.serviceConnection.root.config
        if not isinstance(connection, DBTCloudConnection):
            raise InvalidSourceException(
                f"Expected DBTCloudConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        # Cache for observability data: {(job_id, run_id): {models, parents, pipeline_entity, ...}}
        self.observability_cache: Dict[Tuple[int, str], Dict[str, Any]] = {}
        # Cache for table entity lookups to avoid redundant API calls
        self._table_entity_cache: Dict[str, Optional[Table]] = {}

    def _get_table_entity(self, table_fqn: str) -> Optional[Table]:
        """
        Cached table entity lookup to avoid redundant API calls.
        """
        if table_fqn not in self._table_entity_cache:
            self._table_entity_cache[table_fqn] = self.metadata.get_by_name(
                entity=Table, fqn=table_fqn
            )
        return self._table_entity_cache[table_fqn]

    def _get_task_list(self, job_id: int) -> Optional[List[Task]]:
        """
        Method to collect all the tasks from dbt cloud job and return it in a task list
        """
        self.context.get().latest_run_id = None
        self.context.get().latest_run = None
        self.context.get().current_job_id = job_id
        self.context.get().current_runs = None
        try:
            task_list: List[Task] = []
            runs_list: List = []
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
            return task_list or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

    def yield_pipeline(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[CreatePipelineRequest]]:
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
                scheduleInterval=(
                    str(pipeline_details.schedule.cron)
                    if pipeline_details.schedule
                    else None
                ),
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

    def yield_pipeline_lineage_details(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources.
        Uses combined GraphQL call for models and seeds, with optimized caching.
        """
        try:  # pylint: disable=too-many-nested-blocks

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )

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
            self.context.get().current_table_fqns = []
            # Store pipeline FQN from entity to ensure exact match for status updates
            self.context.get().pipeline_fqn = str(
                pipeline_entity.fullyQualifiedName.root
            )

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

            for model in dbt_models or []:
                if not model.runGeneratedAt:
                    logger.debug(
                        f"Skipping model with missing runGeneratedAt: name={getattr(model, 'name', None)}"
                    )
                    continue

                if not all([model.name, model.database, model.dbtschema]):
                    logger.debug(
                        f"Skipping model with missing attributes: name={getattr(model, 'name', None)}, "
                        f"database={getattr(model, 'database', None)}, schema={getattr(model, 'dbtschema', None)}"
                    )
                    continue

                for dbservicename in self.get_db_service_names() or ["*"]:
                    to_entity_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        table_name=model.name,
                        database_name=model.database,
                        schema_name=model.dbtschema,
                        service_name=dbservicename,
                    )

                    # Use cached table entity lookup
                    to_entity = self._get_table_entity(to_entity_fqn)

                    if to_entity is None:
                        continue

                    # Add to context table FQNs
                    if to_entity_fqn not in self.context.get().current_table_fqns:
                        self.context.get().current_table_fqns.append(to_entity_fqn)

                    # Add to observability cache using set.add() for O(1)
                    if cache_key and cache_key in self.observability_cache:
                        self.observability_cache[cache_key]["table_fqns"].add(
                            to_entity_fqn
                        )

                    for unique_id in model.dependsOn or []:
                        # Use dict lookup instead of list comprehension
                        parent = parent_by_unique_id.get(unique_id)
                        if not parent:
                            continue

                        # Check runGeneratedAt for models and seeds (not sources)
                        # Sources are auto-generated and don't have runGeneratedAt
                        is_source = unique_id.startswith("source.")
                        if not is_source and not parent.runGeneratedAt:
                            logger.debug(
                                f"Skipping parent with missing runGeneratedAt: uniqueId={unique_id}"
                            )
                            continue

                        if not all([parent.name, parent.database, parent.dbtschema]):
                            logger.debug(
                                f"Skipping parent with missing attributes: name={getattr(parent, 'name', None)}, "
                                f"database={getattr(parent, 'database', None)}, schema={getattr(parent, 'dbtschema', None)}"
                            )
                            continue

                        from_entity_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=parent.name,
                            database_name=parent.database,
                            schema_name=parent.dbtschema,
                            service_name=dbservicename,
                        )

                        # Use cached table entity lookup
                        from_entity = self._get_table_entity(from_entity_fqn)

                        if from_entity is None:
                            continue

                        # Add to context table FQNs
                        if from_entity_fqn not in self.context.get().current_table_fqns:
                            self.context.get().current_table_fqns.append(
                                from_entity_fqn
                            )

                        # Add to observability cache using set.add() for O(1)
                        if cache_key and cache_key in self.observability_cache:
                            self.observability_cache[cache_key]["table_fqns"].add(
                                from_entity_fqn
                            )

                        lineage_details = LineageDetails(
                            pipeline=EntityReference(
                                id=pipeline_entity.id.root, type="pipeline"
                            ),
                            source=LineageSource.PipelineLineage,
                        )

                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=from_entity.id,
                                        type="table",
                                    ),
                                    toEntity=EntityReference(
                                        id=to_entity.id,
                                        type="table",
                                    ),
                                    lineageDetails=lineage_details,
                                )
                            )
                        )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

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

    def _parse_timestamp(self, timestamp_str: str) -> Optional[Timestamp]:
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
        self, run, pipeline_entity: Pipeline, schedule_interval: Optional[str] = None
    ) -> PipelineObservability:
        """Build PipelineObservability object from run data."""
        return PipelineObservability(
            pipeline=EntityReference(
                id=pipeline_entity.id.root
                if hasattr(pipeline_entity.id, "root")
                else pipeline_entity.id,
                type="pipeline",
                fullyQualifiedName=pipeline_entity.fullyQualifiedName.root
                if hasattr(pipeline_entity.fullyQualifiedName, "root")
                else str(pipeline_entity.fullyQualifiedName),
            ),
            scheduleInterval=schedule_interval,
            startTime=self._parse_timestamp(run.started_at) if run.started_at else None,
            endTime=self._parse_timestamp(run.finished_at) if run.finished_at else None,
            lastRunTime=self._parse_timestamp(run.finished_at)
            if run.finished_at
            else None,
            lastRunStatus=self._map_run_status(run.state or run.status),
        )

    def get_table_pipeline_observability(
        self, pipeline_details: DBTJob
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:
        """
        Extract pipeline observability data from cached lineage artifacts.
        Uses context data first (current job), falls back to cache for historical data.
        """
        try:
            table_pipeline_map: Dict[str, List[PipelineObservability]] = defaultdict(
                list
            )

            ctx = self.context.get()
            if (
                hasattr(ctx, "current_table_fqns")
                and hasattr(ctx, "latest_run")
                and hasattr(ctx, "current_pipeline_entity")
                and ctx.latest_run
                and ctx.current_pipeline_entity
                and ctx.current_table_fqns
            ):
                logger.debug(
                    f"Using context data for observability - {len(ctx.current_table_fqns)} tables"
                )

                schedule_interval = (
                    str(pipeline_details.schedule.cron)
                    if pipeline_details.schedule
                    else None
                )

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
                    if job_details
                    and job_details.schedule
                    and job_details.schedule.cron
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

    def yield_pipeline_status(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:

            # Use stored FQN from context instead of reconstructing
            # This ensures exact match with database format, especially for special characters
            ctx = self.context.get()
            pipeline_fqn = (
                ctx.pipeline_fqn
                if hasattr(ctx, "pipeline_fqn") and ctx.pipeline_fqn
                else fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=ctx.pipeline_service,
                    pipeline_name=ctx.pipeline,
                )
            )

            # using cached runs from context instead of making another API call
            runs = (
                ctx.current_runs
                if hasattr(ctx, "current_runs") and ctx.current_runs
                else None
            )
            if not runs:
                runs = self.client.get_runs(job_id=pipeline_details.id)

            for task in runs or []:
                task_status = TaskStatus(
                    name=str(task.id),
                    executionStatus=STATUS_MAP.get(task.state, StatusType.Pending),
                    startTime=self._parse_timestamp(task.started_at)
                    if task.started_at
                    else None,
                    endTime=self._parse_timestamp(task.finished_at)
                    if task.finished_at
                    else None,
                )

                pipeline_status = PipelineStatus(
                    executionStatus=task_status.executionStatus,
                    taskStatus=[task_status],
                    timestamp=task_status.endTime
                    if task_status.endTime
                    else task_status.startTime,
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
