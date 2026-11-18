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
Glue pipeline source to extract metadata and lineage.
"""

import re
import traceback
from collections.abc import Callable, Iterable, Sequence
from typing import Any
from urllib.parse import urlparse

from cachetools import LRUCache

from metadata.clients.aws_client import AWSClient
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
from metadata.generated.schema.entity.services.connections.pipeline.gluePipelineConnection import (
    GluePipelineConnection,
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.gluepipeline.context_builder import (
    GRAPH,
    JOB_TYPE,
    MAX_INSPECTED_RUNS,
    NAME,
    NODES,
    WorkflowSnapshot,
    build_parameter_contexts,
)
from metadata.ingestion.source.pipeline.gluepipeline.models import (
    AmazonRedshift,
    CatalogSource,
    JDBCSource,
    JobNodeResponse,
    S3Source,
    S3Target,
    SnowflakeNode,
)
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    CatalogRef,
    JDBCRef,
    LineageGroup,
    ParameterContext,
    Resolved,
    S3Ref,
    ScriptLineageResult,
    ScriptRef,
    Side,
    SnowflakeRef,
    parse_glue_script_slices,
    parse_script_lineage_groups,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

GLUE_CONNECTION_CACHE_SIZE = 256
JOB_RUNS_CACHE_SIZE = 256
SCRIPT_CACHE_SIZE = 128
RESOLUTION_CACHE_SIZE = 512

STATUS_MAP = {
    "cancelled": StatusType.Failed,
    "succeeded": StatusType.Successful,
    "failed": StatusType.Failed,
    "running": StatusType.Pending,
    "incomplete": StatusType.Failed,
    "pending": StatusType.Pending,
}
TABLE_MODEL_MAP = {
    "AmazonRedshiftSource": AmazonRedshift,
    "AmazonRedshiftTarget": AmazonRedshift,
    "AthenaConnectorSource": JDBCSource,
    "JDBCConnectorSource": JDBCSource,
    "JDBCConnectorTarget": JDBCSource,
    "DirectJDBCSource": CatalogSource,
    "RedshiftSource": CatalogSource,
    "RedshiftTarget": CatalogSource,
    "DirectJDBC": CatalogSource,
    "SnowflakeSource": SnowflakeNode,
    "SnowflakeTarget": SnowflakeNode,
}
STORAGE_MODEL_MAP = {
    "S3CsvSource": S3Source,
    "S3JsonSource": S3Source,
    "S3ParquetSource": S3Source,
    "S3HudiSource": S3Source,
    "S3DeltaSource": S3Source,
    "S3DirectTarget": S3Target,
    "S3DeltaDirectTarget": S3Target,
    "S3GlueParquetTarget": S3Target,
    "S3HudiDirectTarget": S3Target,
}


def _append_unique_edge(
    requests: list[AddLineageRequest],
    seen_edges: set[tuple[str, str]],
    from_ref: EntityReference,
    to_ref: EntityReference,
    details: LineageDetails,
) -> None:
    edge_key = (model_str(from_ref.id), model_str(to_ref.id))
    if edge_key in seen_edges:
        return
    seen_edges.add(edge_key)
    requests.append(AddLineageRequest(edge=EntitiesEdge(fromEntity=from_ref, toEntity=to_ref, lineageDetails=details)))


def _plan_two_sided_group_edges(
    groups: Sequence[LineageGroup[EntityReference]],
    pipeline_ref: EntityReference,
    requests: list[AddLineageRequest],
    seen_edges: set[tuple[str, str]],
) -> tuple[set[str], set[str]]:
    table_lineage_details = LineageDetails(
        pipeline=pipeline_ref,
        source=LineageSource.PipelineLineage,
    )
    linked_sources: set[str] = set()
    linked_targets: set[str] = set()
    for group in groups:
        if not (isinstance(group.sources, Resolved) and isinstance(group.targets, Resolved)):
            continue
        for source in group.sources.refs:
            for target in group.targets.refs:
                if model_str(source.id) == model_str(target.id):
                    continue
                linked_sources.add(model_str(source.id))
                linked_targets.add(model_str(target.id))
                _append_unique_edge(requests, seen_edges, source, target, table_lineage_details)
    return linked_sources, linked_targets


def plan_lineage_edges(
    groups: Sequence[LineageGroup[EntityReference]],
    pipeline_ref: EntityReference,
) -> list[AddLineageRequest]:
    """
    Pure edge planner over typed `LineageGroup[EntityReference]` contracts:
    - Either side `"unresolved"` -> skip group.
    - Both sides `Resolved` -> `Table -> Table` edges carrying `pipeline_ref`.
    - `sources == "absent"`, `targets` `Resolved` -> `Pipeline -> Table` edges (unless target already linked).
    - `targets == "absent"`, `sources` `Resolved` -> `Table -> Pipeline` edges (unless source already linked).
    """
    direct_lineage_details = LineageDetails(source=LineageSource.PipelineLineage)
    seen_edges: set[tuple[str, str]] = set()
    requests: list[AddLineageRequest] = []
    linked_sources, linked_targets = _plan_two_sided_group_edges(groups, pipeline_ref, requests, seen_edges)

    for group in groups:
        if group.sources == "absent" and isinstance(group.targets, Resolved):
            for target in group.targets.refs:
                if model_str(target.id) not in linked_targets:
                    _append_unique_edge(requests, seen_edges, pipeline_ref, target, direct_lineage_details)
        elif group.targets == "absent" and isinstance(group.sources, Resolved):
            for source in group.sources.refs:
                if model_str(source.id) not in linked_sources:
                    _append_unique_edge(requests, seen_edges, source, pipeline_ref, direct_lineage_details)

    return requests


class GluepipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Glue Pipeline's metadata db
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.task_id_mapping: dict[str, str] = {}
        self.job_name_list: set[str] = set()
        self.glue = self.connection
        self._s3_client = None
        self._glue_connection_cache: LRUCache[str, dict | None] = LRUCache(maxsize=GLUE_CONNECTION_CACHE_SIZE)
        self._job_runs_cache: LRUCache[str, list[dict]] = LRUCache(maxsize=JOB_RUNS_CACHE_SIZE)
        self._script_cache: LRUCache[str, str | None] = LRUCache(maxsize=SCRIPT_CACHE_SIZE)

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GluePipelineConnection = config.serviceConnection.root.config
        if not isinstance(connection, GluePipelineConnection):
            raise InvalidSourceException(f"Expected GlueConnection, but got {connection}")
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[dict]:
        for workflow in self.glue.list_workflows()["Workflows"]:
            jobs = self.glue.get_workflow(Name=workflow, IncludeGraph=True)["Workflow"]
            yield jobs

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        return pipeline_details[NAME]

    def yield_pipeline(self, pipeline_details: Any) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        source_url = SourceUrl(
            f"https://{self.service_connection.awsConfig.awsRegion}.console.aws.amazon.com/glue/home?"
            f"region={self.service_connection.awsConfig.awsRegion}#/v2/etl-configuration/"
            f"workflows/view/{pipeline_details[NAME]}"
        )
        self.job_name_list = set()
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details[NAME]),
            displayName=pipeline_details[NAME],
            tasks=self.get_tasks(pipeline_details),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            sourceUrl=source_url,
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def get_tasks(self, pipeline_details: Any) -> list[Task]:
        self.task_id_mapping = {}
        task_list = []
        for task in pipeline_details[GRAPH][NODES]:
            self.task_id_mapping[task["UniqueId"]] = task["Name"][:128]
            if task["Type"] == JOB_TYPE:
                self.job_name_list.add(task[NAME])
        for task in pipeline_details[GRAPH][NODES]:
            task_list.append(  # noqa: PERF401
                Task(
                    name=task[NAME],
                    displayName=task[NAME],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(task["UniqueId"], pipeline_details[GRAPH]),
                )
            )
        return task_list

    def get_downstream_tasks(self, task_unique_id, tasks):
        downstream_tasks = []
        for edges in tasks["Edges"]:
            if edges["SourceId"] == task_unique_id and self.task_id_mapping.get(edges["DestinationId"]):
                downstream_tasks.append(self.task_id_mapping[edges["DestinationId"]])  # noqa: PERF401
        return downstream_tasks

    @property
    def s3_client(self):
        if self._s3_client is None:
            self._s3_client = AWSClient(self.service_connection.awsConfig).get_s3_client()
        return self._s3_client

    def get_lineage_details(self, job: str, workflow_details: dict | None = None) -> dict[str, list[EntityReference]]:
        """
        Get aggregated lineage details for a single Glue job.

        First tries Visual ETL CodeGenConfigurationNodes, otherwise evaluates the
        job script across bounded execution parameter contexts.
        """
        aggregated: dict[str, list[EntityReference]] = {"sources": [], "targets": []}
        seen_ids: dict[str, set[str]] = {"sources": set(), "targets": set()}
        snapshot_holder: list[WorkflowSnapshot] = []
        for group in self._get_job_lineage_groups(job, workflow_details, snapshot_holder=snapshot_holder):
            if isinstance(group.sources, Resolved):
                for ref in group.sources.refs:
                    ref_id = model_str(ref.id)
                    if ref_id not in seen_ids["sources"]:
                        seen_ids["sources"].add(ref_id)
                        aggregated["sources"].append(ref)
            if isinstance(group.targets, Resolved):
                for ref in group.targets.refs:
                    ref_id = model_str(ref.id)
                    if ref_id not in seen_ids["targets"]:
                        seen_ids["targets"].add(ref_id)
                        aggregated["targets"].append(ref)
        return aggregated

    def _collect_workflow_snapshot(self, workflow_details: dict | None) -> WorkflowSnapshot:
        runs, fetch_ok = self._get_workflow_runs_for_lineage(workflow_details)
        return WorkflowSnapshot.from_workflow_details(workflow_details, runs, runs_fetch_ok=fetch_ok)

    def _get_job_lineage_groups(
        self,
        job: str,
        workflow_details: dict | None = None,
        *,
        snapshot_holder: list[WorkflowSnapshot] | None = None,
    ) -> list[LineageGroup[EntityReference]]:
        try:
            job_details = JobNodeResponse.model_validate(self.glue.get_job(JobName=job)).Job
            if job_details and job_details.config_nodes:
                lineage_details: dict[str, list[EntityReference]] = {"sources": [], "targets": []}
                declared_flags: dict[str, bool] = {"declared_sources": False, "declared_targets": False}
                self._extract_visual_etl_lineage(job_details.config_nodes, lineage_details, declared_flags)
                sources = self._entity_side(lineage_details["sources"], declared=declared_flags["declared_sources"])
                targets = self._entity_side(lineage_details["targets"], declared=declared_flags["declared_targets"])
                if sources == "absent" and targets == "absent":
                    return []
                return [
                    LineageGroup(
                        execution_id=f"{job}:visual_etl",
                        dependency_id="visual_etl",
                        sources=sources,
                        targets=targets,
                    )
                ]
            if job_details and job_details.command and job_details.command.ScriptLocation:
                if snapshot_holder is not None:
                    if not snapshot_holder:
                        snapshot_holder.append(self._collect_workflow_snapshot(workflow_details))
                    snapshot = snapshot_holder[0]
                else:
                    snapshot = self._collect_workflow_snapshot(workflow_details)
                job_runs = self._get_job_runs_for_lineage(job)
                contexts = build_parameter_contexts(job, job_details, snapshot, job_runs)
                return self._extract_script_lineage_groups(job_details.command.ScriptLocation, contexts)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to get lineage details for job : %s due to : %s", job, exc)
        return []

    @staticmethod
    def _entity_side(entities: Sequence[EntityReference], *, declared: bool) -> Side[EntityReference]:
        deduped: list[EntityReference] = []
        seen: set[tuple[str | None, str]] = set()
        for entity in entities:
            key = (entity.type, model_str(entity.id))
            if key not in seen:
                seen.add(key)
                deduped.append(entity)
        if deduped:
            return Resolved(tuple(deduped))
        return "unresolved" if declared else "absent"

    def _get_job_runs(self, job_name: str) -> list[dict]:
        if job_name in self._job_runs_cache:
            return self._job_runs_cache[job_name]
        response = self.glue.get_job_runs(JobName=job_name)
        raw_runs = response.get("JobRuns", []) if isinstance(response, dict) else []
        runs = [r for r in raw_runs if isinstance(r, dict)] if isinstance(raw_runs, list) else []
        self._job_runs_cache[job_name] = runs
        return runs

    def _get_job_runs_for_lineage(self, job_name: str) -> list[dict]:
        try:
            return self._get_job_runs(job_name)[:MAX_INSPECTED_RUNS]
        except Exception as exc:
            logger.debug("Could not fetch Glue job runs for %s: %s", job_name, exc)
            return []

    def _get_workflow_runs_for_lineage(self, workflow_details: dict | None) -> tuple[list[dict], bool]:
        """Inspected workflow runs plus whether `get_workflow_runs` succeeded (False marks run props opaque)."""
        if not isinstance(workflow_details, dict):
            return [], True
        runs: list[dict] = []
        fetch_ok = True
        workflow_name = workflow_details.get(NAME)
        if isinstance(workflow_name, str) and workflow_name:
            try:
                response = self.glue.get_workflow_runs(
                    Name=workflow_name,
                    IncludeGraph=True,
                    MaxResults=MAX_INSPECTED_RUNS,
                )
                raw_runs = response.get("Runs", []) if isinstance(response, dict) else []
                if isinstance(raw_runs, list):
                    runs.extend(r for r in raw_runs[:MAX_INSPECTED_RUNS] if isinstance(r, dict))
            except Exception as exc:
                fetch_ok = False
                logger.debug("Could not fetch Glue workflow runs for %s: %s", workflow_name, exc)

        last_run = workflow_details.get("LastRun")
        if isinstance(last_run, dict):
            last_run_id = last_run.get("WorkflowRunId")
            seen_ids = {r.get("WorkflowRunId") for r in runs if r.get("WorkflowRunId")}
            if (not runs or (last_run_id and last_run_id not in seen_ids)) and len(runs) < MAX_INSPECTED_RUNS:
                runs.append(last_run)
        return runs[:MAX_INSPECTED_RUNS], fetch_ok

    def _extract_visual_etl_lineage(
        self, config_nodes: dict, lineage_details: dict, declared_flags: dict[str, bool] | None = None
    ):
        for _, node in config_nodes.items():  # noqa: PERF102
            for key, entity in node.items():
                table_model, storage_model = None, None
                if key in TABLE_MODEL_MAP:
                    table_model = TABLE_MODEL_MAP[key].model_validate(entity)
                elif "Catalog" in key:
                    table_model = CatalogSource.model_validate(entity)
                elif key in STORAGE_MODEL_MAP:
                    storage_model = STORAGE_MODEL_MAP[key].model_validate(entity)
                if declared_flags is not None and (table_model or storage_model):
                    if key.endswith("Source"):
                        declared_flags["declared_sources"] = True
                    else:
                        declared_flags["declared_targets"] = True
                if table_model:
                    self._add_visual_table_lineage(key, table_model, lineage_details)
                if storage_model:
                    for path in storage_model.Paths or [storage_model.Path]:
                        container = self.metadata.es_search_container_by_path(full_path=path)
                        if container and container[0]:
                            storage_entity = EntityReference(
                                id=container[0].id,
                                type="container",
                                name=model_str(container[0].name),
                                fullyQualifiedName=model_str(container[0].fullyQualifiedName),
                            )
                            if storage_entity:
                                if key.endswith("Source"):
                                    lineage_details["sources"].append(storage_entity)
                                else:
                                    lineage_details["targets"].append(storage_entity)
                                break

    def _add_visual_table_lineage(
        self,
        key: str,
        table_model: AmazonRedshift | JDBCSource | CatalogSource | SnowflakeNode,
        lineage_details: dict,
    ):
        if not table_model.table_name:
            return
        direction = "sources" if key.endswith("Source") else "targets"
        if isinstance(table_model, SnowflakeNode):
            table_entity = self._resolve_snowflake_ref(
                SnowflakeRef(
                    table=table_model.table_name,
                    database=table_model.database_name,
                    schema=table_model.schema_name,
                )
            )
            if table_entity:
                lineage_details[direction].append(table_entity)
            return
        for db_service_name in self.get_db_service_names() or ["*"]:
            table_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                table_name=table_model.table_name,
                database_name=table_model.database_name,
                schema_name=table_model.schema_name,
                service_name=db_service_name,
            )
            table_entity = self.metadata.get_entity_reference(entity=Table, fqn=table_fqn) if table_fqn else None
            if table_entity:
                lineage_details[direction].append(table_entity)
                break

    def _extract_script_lineage(
        self,
        script_location: str,
        lineage_details: dict,
        context: ParameterContext | None = None,
    ) -> None:
        script_content = self._download_s3_script(script_location)
        if not script_content:
            return

        slices = parse_glue_script_slices(script_content, context=context)
        if not slices:
            logger.debug("No lineage found in script: %s", script_location)
            return

        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] = LRUCache(maxsize=RESOLUTION_CACHE_SIZE)
        for slice_result in slices:
            self._resolve_slice_entities(slice_result, lineage_details, resolution_cache)

    def _extract_script_lineage_groups(
        self,
        script_location: str,
        contexts: Sequence[ParameterContext],
    ) -> list[LineageGroup[EntityReference]]:
        script_content = self._download_s3_script(script_location)
        if not script_content:
            return []

        groups: list[LineageGroup[EntityReference]] = []
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] = LRUCache(maxsize=RESOLUTION_CACHE_SIZE)
        for ctx in contexts:
            groups.extend(
                LineageGroup(
                    execution_id=raw_group.execution_id,
                    dependency_id=raw_group.dependency_id,
                    sources=self._resolve_script_side(raw_group.sources, resolution_cache),
                    targets=self._resolve_script_side(raw_group.targets, resolution_cache),
                )
                for raw_group in parse_script_lineage_groups(script_content, context=ctx)
            )

        if not groups:
            logger.debug("No lineage found in script: %s", script_location)
        return groups

    def _resolve_script_side(
        self,
        side: Side[ScriptRef],
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None],
    ) -> Side[EntityReference]:
        if side == "absent":
            return "absent"
        if side == "unresolved":
            return "unresolved"
        resolved_entities: list[EntityReference] = []
        for ref in side.refs:
            entity = self._resolve_script_ref(ref, resolution_cache)
            if entity is not None:
                resolved_entities.append(entity)
        return self._entity_side(resolved_entities, declared=True)

    def _resolve_script_ref(
        self,
        ref: ScriptRef,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ) -> EntityReference | None:
        if isinstance(ref, S3Ref):
            return self._resolve_cached(
                resolution_cache, ("s3", ref.path), lambda s3_path=ref.path: self._resolve_s3_path(s3_path)
            )
        if isinstance(ref, CatalogRef):
            return self._resolve_cached(
                resolution_cache,
                ("catalog", ref.database, ref.table),
                lambda catalog_ref=ref: self._resolve_catalog_ref(catalog_ref),
            )
        if isinstance(ref, JDBCRef):
            return self._resolve_cached(
                resolution_cache,
                ("jdbc", ref.connection_name, ref.jdbc_url, ref.database, ref.table),
                lambda jdbc_ref=ref: self._resolve_jdbc_ref(jdbc_ref),
            )
        return self._resolve_cached(
            resolution_cache,
            ("snowflake", ref.table, ref.database, ref.schema),
            lambda snowflake_ref=ref: self._resolve_snowflake_ref(snowflake_ref),
        )

    def _resolve_slice_entities(
        self,
        result: ScriptLineageResult,
        lineage_details: dict,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ) -> None:
        self._resolve_s3_entities(result.s3_sources, lineage_details, "sources", resolution_cache)
        self._resolve_s3_entities(result.s3_targets, lineage_details, "targets", resolution_cache)
        self._resolve_catalog_entities(result.catalog_sources, lineage_details, "sources", resolution_cache)
        self._resolve_catalog_entities(result.catalog_targets, lineage_details, "targets", resolution_cache)
        self._resolve_jdbc_entities(result.jdbc_sources, lineage_details, "sources", resolution_cache)
        self._resolve_jdbc_entities(result.jdbc_targets, lineage_details, "targets", resolution_cache)
        self._resolve_snowflake_entities(result.snowflake_sources, lineage_details, "sources", resolution_cache)
        self._resolve_snowflake_entities(result.snowflake_targets, lineage_details, "targets", resolution_cache)

    def _download_s3_script(self, s3_uri: str) -> str | None:
        if s3_uri in self._script_cache:
            return self._script_cache[s3_uri]
        try:
            parsed = urlparse(s3_uri)
            bucket = parsed.netloc
            key = parsed.path.lstrip("/")
            if not bucket or not key:
                logger.warning("Invalid S3 URI for script: %s", s3_uri)
                self._script_cache[s3_uri] = None
                return None
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            content = response["Body"].read().decode("utf-8")
            self._script_cache[s3_uri] = content
            return content  # noqa: TRY300
        except Exception as exc:
            logger.error("Failed to download script from %s: %s", s3_uri, exc)
            logger.debug(traceback.format_exc())
            self._script_cache[s3_uri] = None
            return None

    @staticmethod
    def _append_resolved_ref(lineage_details: dict, direction: str, entity: EntityReference | None) -> None:
        if entity is None:
            return
        entity_key = (entity.type, model_str(entity.id))
        if not any((existing.type, model_str(existing.id)) == entity_key for existing in lineage_details[direction]):
            lineage_details[direction].append(entity)

    @staticmethod
    def _resolve_cached(
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None,
        cache_key: tuple[Any, ...],
        resolver: Callable[[], EntityReference | None],
    ) -> EntityReference | None:
        if resolution_cache is None:
            return resolver()
        if cache_key not in resolution_cache:
            resolution_cache[cache_key] = resolver()
        return resolution_cache[cache_key]

    def _resolve_s3_entities(
        self,
        paths: list[str],
        lineage_details: dict,
        direction: str,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ):
        for path in paths:
            storage_entity = self._resolve_cached(
                resolution_cache, ("s3", path), lambda s3_path=path: self._resolve_s3_path(s3_path)
            )
            self._append_resolved_ref(lineage_details, direction, storage_entity)

    def _resolve_s3_path(self, path: str) -> EntityReference | None:
        try:
            normalized = path.rstrip("/")
            container = self.metadata.es_search_container_by_path(full_path=normalized)
            if not container or not container[0]:
                container = self.metadata.es_search_container_by_path(full_path=normalized + "/")
            if container and container[0]:
                return EntityReference(
                    id=container[0].id,
                    type="container",
                    name=model_str(container[0].name),
                    fullyQualifiedName=model_str(container[0].fullyQualifiedName),
                )
            logger.warning(
                "Could not find container entity for S3 path: %s. Ensure the S3 storage service has been ingested.",
                path,
            )
        except Exception as exc:
            logger.debug("Failed to resolve S3 path %s: %s", path, exc)
        return None

    def _resolve_catalog_entities(
        self,
        refs: list,
        lineage_details: dict,
        direction: str,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ):
        for ref in refs:
            table_entity = self._resolve_cached(
                resolution_cache,
                ("catalog", ref.database, ref.table),
                lambda catalog_ref=ref: self._resolve_catalog_ref(catalog_ref),
            )
            self._append_resolved_ref(lineage_details, direction, table_entity)

    def _resolve_catalog_ref(self, ref: CatalogRef) -> EntityReference | None:
        for db_service_name in self.get_db_service_names() or ["*"]:
            try:
                table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    table_name=ref.table,
                    database_name=ref.database,
                    schema_name=None,
                    service_name=db_service_name,
                )
                table_entity = self.metadata.get_entity_reference(entity=Table, fqn=table_fqn) if table_fqn else None
                if table_entity:
                    return table_entity
            except Exception as exc:
                logger.debug(
                    "Failed to resolve catalog ref %s.%s in service %s: %s",
                    ref.database,
                    ref.table,
                    db_service_name,
                    exc,
                )
        return None

    def _resolve_jdbc_entities(
        self,
        refs: list,
        lineage_details: dict,
        direction: str,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ):
        for ref in refs:
            table_entity = self._resolve_cached(
                resolution_cache,
                ("jdbc", ref.connection_name, ref.jdbc_url, ref.database, ref.table),
                lambda jdbc_ref=ref: self._resolve_jdbc_ref(jdbc_ref),
            )
            self._append_resolved_ref(lineage_details, direction, table_entity)

    def _resolve_jdbc_ref(self, ref: JDBCRef) -> EntityReference | None:
        database_name = ref.database
        table_name = ref.table
        schema_name = None

        if ref.connection_name:
            conn_info = self._resolve_glue_connection(ref.connection_name)
            if conn_info:
                database_name = database_name or conn_info.get("database")
                schema_name = conn_info.get("schema")

        if ref.jdbc_url:
            parsed = self._parse_jdbc_url(ref.jdbc_url)
            if parsed:
                database_name = database_name or parsed.get("database")
                schema_name = schema_name or parsed.get("schema")

        if not table_name:
            return None

        for db_service_name in self.get_db_service_names() or ["*"]:
            try:
                table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    table_name=table_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    service_name=db_service_name,
                )
                table_entity = self.metadata.get_entity_reference(entity=Table, fqn=table_fqn) if table_fqn else None
                if table_entity:
                    return table_entity
            except Exception as exc:
                logger.debug("Failed to resolve JDBC ref %s in service %s: %s", table_name, db_service_name, exc)
        return None

    def _resolve_snowflake_entities(
        self,
        refs: list,
        lineage_details: dict,
        direction: str,
        resolution_cache: LRUCache[tuple[Any, ...], EntityReference | None] | None = None,
    ):
        """
        Snowflake refs carry database and schema, so the first attempt is exact.
        When the script's sfDatabase does not match the ingested database name
        fall back to schema.table. The bare table name is only tried when the
        schema is unknown: with a known schema a name-only hit would belong to
        another schema. Every attempt requires an unambiguous match.
        """
        for ref in refs:
            table_entity = self._resolve_cached(
                resolution_cache,
                ("snowflake", ref.table, ref.database, ref.schema),
                lambda snowflake_ref=ref: self._resolve_snowflake_ref(snowflake_ref),
            )
            self._append_resolved_ref(lineage_details, direction, table_entity)

    def _resolve_snowflake_ref(self, ref: SnowflakeRef) -> EntityReference | None:
        """
        The first attempt with any match decides: one match links, several are
        ambiguous (a less specific attempt would only match more), none tries the next.
        ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables
        """
        for database_name, schema_name in self._snowflake_lookup_attempts(ref):
            matches = self._search_tables(ref.table, database_name, schema_name)
            if len(matches) == 1:
                return next(iter(matches.values()))
            if matches:
                logger.warning(
                    "Snowflake table %s matches several tables %s; skipping lineage", ref.table, sorted(matches)
                )
                return None
        logger.warning(
            "Could not find table entity for Snowflake reference %s.%s.%s. "
            "Ensure the Snowflake service has been ingested.",
            ref.database,
            ref.schema,
            ref.table,
        )
        return None

    @staticmethod
    def _snowflake_lookup_attempts(ref: SnowflakeRef) -> list[tuple[str | None, str | None]]:
        attempts = [(ref.database, ref.schema)]
        if ref.schema:
            attempts.append((None, ref.schema))
        else:
            attempts.append((None, None))
        unique = []
        for attempt in attempts:
            if attempt not in unique:
                unique.append(attempt)
        return unique

    def _search_tables(
        self, table_name: str, database_name: str | None, schema_name: str | None
    ) -> dict[str, EntityReference]:
        table_fqns: set[str] = set()
        for db_service_name in self.get_db_service_names() or ["*"]:
            try:
                found = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    table_name=table_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    service_name=db_service_name,
                    fetch_multiple_entities=True,
                )
            except Exception as exc:
                logger.debug("Failed to search table %s in service %s: %s", table_name, db_service_name, exc)
                continue
            table_fqns.update(found or [])
        matches = {}
        for table_fqn in sorted(table_fqns):
            table_entity = self.metadata.get_entity_reference(entity=Table, fqn=table_fqn)
            if table_entity:
                matches[table_fqn] = table_entity
        return matches

    def _resolve_glue_connection(self, connection_name: str) -> dict | None:
        if connection_name in self._glue_connection_cache:
            return self._glue_connection_cache[connection_name]

        try:
            response = self.glue.get_connection(Name=connection_name, HidePassword=True)
            props = response.get("Connection", {}).get("ConnectionProperties", {})
            jdbc_url = props.get("JDBC_CONNECTION_URL", "")
            result = self._parse_jdbc_url(jdbc_url)
            self._glue_connection_cache[connection_name] = result
            return result  # noqa: TRY300
        except Exception as exc:
            logger.debug("Failed to resolve Glue connection '%s': %s", connection_name, exc)
            self._glue_connection_cache[connection_name] = None
            return None

    @staticmethod
    def _parse_jdbc_url(jdbc_url: str) -> dict | None:
        if not jdbc_url:
            return None
        match = re.match(r"jdbc:\w+://[^/]+/([^?;]+)", jdbc_url)
        if match:
            db_name = match.group(1)
            return {"database": db_name, "schema": None}
        return None

    def yield_pipeline_status(self, pipeline_details: Any) -> Iterable[Either[OMetaPipelineStatus]]:
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        for job in self.job_name_list:
            try:
                runs = self._get_job_runs(job)
                for attempt in runs:
                    task_status = [
                        TaskStatus(
                            name=attempt["JobName"],
                            executionStatus=STATUS_MAP.get(attempt["JobRunState"].lower(), StatusType.Pending).value,
                            startTime=Timestamp(datetime_to_timestamp(attempt["StartedOn"], milliseconds=True)),
                            endTime=Timestamp(datetime_to_timestamp(attempt["CompletedOn"], milliseconds=True)),
                        )
                    ]
                    pipeline_status = PipelineStatus(
                        taskStatus=task_status,
                        timestamp=Timestamp(datetime_to_timestamp(attempt["StartedOn"], milliseconds=True)),
                        executionStatus=STATUS_MAP.get(attempt["JobRunState"].lower(), StatusType.Pending).value,
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
                        name=pipeline_fqn,
                        error=f"Failed to yield pipeline status for job {job}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_pipeline_lineage_details(self, pipeline_details: Any) -> Iterable[Either[AddLineageRequest]]:
        """
        Emit correlated pipeline lineage edges across all jobs in `pipeline_details`,
        collecting the workflow snapshot at most once per workflow.
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
            if not pipeline_entity or not pipeline_entity.id:
                return

            pipeline_ref = EntityReference(id=pipeline_entity.id, type="pipeline")
            snapshot_holder: list[WorkflowSnapshot] = []
            all_groups: list[LineageGroup[EntityReference]] = []
            for job in sorted(self.job_name_list):
                all_groups.extend(self._get_job_lineage_groups(job, pipeline_details, snapshot_holder=snapshot_holder))

            for request in plan_lineage_edges(all_groups, pipeline_ref):
                yield Either(left=None, right=request)

        except Exception as exc:
            err_name = (
                str(pipeline_details.get(NAME) or "glue_pipeline")
                if isinstance(pipeline_details, dict)
                else "glue_pipeline"
            )
            yield Either(
                left=StackTraceError(
                    name=err_name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )
