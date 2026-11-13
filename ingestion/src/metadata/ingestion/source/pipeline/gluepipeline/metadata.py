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
Glue pipeline source to extract metadata
"""

import re
import traceback
from collections.abc import Callable, Iterable
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
from metadata.ingestion.source.pipeline.gluepipeline.models import (
    AmazonRedshift,
    CatalogSource,
    JDBCSource,
    JobNodeResponse,
    JobNodes,
    S3Source,
    S3Target,
    SnowflakeNode,
)
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    CatalogRef,
    JDBCRef,
    ParameterContext,
    ScriptLineageResult,
    SnowflakeRef,
    parse_glue_script_slices,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

GRAPH = "Graph"
NODES = "Nodes"
NAME = "Name"
JOB_TYPE = "JOB"
TRIGGER_TYPE = "TRIGGER"

# Cap inspected workflow/job runs and cache entries per ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context
MAX_INSPECTED_RUNS = 10
GLUE_CONNECTION_CACHE_SIZE = 256
JOB_RUNS_CACHE_SIZE = 256
SCRIPT_CACHE_SIZE = 128

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


def _clean_str_dict(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if k is not None and v is not None}


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
        for group in self._get_job_lineage_groups(job, workflow_details):
            for direction in ("sources", "targets"):
                for ref in group[direction]:
                    ref_id = model_str(ref.id)
                    if ref_id not in seen_ids[direction]:
                        seen_ids[direction].add(ref_id)
                        aggregated[direction].append(ref)
        return aggregated

    def _get_job_lineage_groups(
        self,
        job: str,
        workflow_details: dict | None = None,
    ) -> list[dict[str, Any]]:
        """
        Resolve `(sources, targets)` groups per parameter context and per loop slice
        so multi-run jobs never cross-link sources from one run with targets from another.
        Each group also records `declared_sources`/`declared_targets`: whether the slice
        declares that side at all, so a two-sided slice that resolves only one side is
        skipped instead of degraded to a one-sided pipeline edge.
        """
        try:
            job_details = JobNodeResponse.model_validate(self.glue.get_job(JobName=job)).Job
            if job_details and job_details.config_nodes:
                lineage_details: dict[str, list[EntityReference]] = {"sources": [], "targets": []}
                declared_flags: dict[str, bool] = {"declared_sources": False, "declared_targets": False}
                self._extract_visual_etl_lineage(job_details.config_nodes, lineage_details, declared_flags)
                group: dict[str, Any] = {**lineage_details, **declared_flags}
                if (
                    lineage_details["sources"]
                    or lineage_details["targets"]
                    or declared_flags["declared_sources"]
                    or declared_flags["declared_targets"]
                ):
                    return [group]
                return []
            if job_details and job_details.command and job_details.command.ScriptLocation:
                contexts = self._build_parameter_contexts(job, job_details, workflow_details)
                return self._extract_script_lineage_groups(job_details.command.ScriptLocation, contexts)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to get lineage details for job : %s due to : %s", job, exc)
        return []

    def _get_job_runs(self, job_name: str) -> list[dict]:
        if job_name in self._job_runs_cache:
            return self._job_runs_cache[job_name]
        response = self.glue.get_job_runs(JobName=job_name)
        raw_runs = response.get("JobRuns", []) if isinstance(response, dict) else []
        runs = [r for r in raw_runs if isinstance(r, dict)] if isinstance(raw_runs, list) else []
        self._job_runs_cache[job_name] = runs
        return runs

    def _get_job_runs_for_lineage(self, job_name: str) -> tuple[list[dict], bool]:
        """Inspected job runs plus whether the fetch succeeded (False marks contexts opaque)."""
        try:
            return self._get_job_runs(job_name)[:MAX_INSPECTED_RUNS], True
        except Exception as exc:
            logger.debug("Could not fetch Glue job runs for %s: %s", job_name, exc)
            return [], False

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

    @staticmethod
    def _extract_trigger_arguments(
        job_name: str, workflow_details: dict | None
    ) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
        """
        Trigger arguments kept per trigger, never merged across triggers: a run started by
        one trigger must not inherit another trigger's arguments. Returns the arguments by
        trigger name plus one deduplicated argument dict per trigger, in trigger order.
        """
        by_trigger: dict[str, dict[str, str]] = {}
        ordered_sets: list[dict[str, str]] = []
        if not isinstance(workflow_details, dict):
            return by_trigger, ordered_sets
        graph = workflow_details.get(GRAPH)
        nodes = graph.get(NODES, []) if isinstance(graph, dict) else []
        if not isinstance(nodes, list):
            return by_trigger, ordered_sets
        for node in nodes:
            if not isinstance(node, dict) or node.get("Type") != TRIGGER_TYPE:
                continue
            trigger_details = node.get("TriggerDetails")
            trigger = trigger_details.get("Trigger") if isinstance(trigger_details, dict) else None
            if not isinstance(trigger, dict):
                continue
            trigger_name = trigger.get("Name") or node.get(NAME)
            actions = trigger.get("Actions", [])
            if not isinstance(actions, list):
                continue
            trigger_args: dict[str, str] = {}
            has_matching_action = False
            for action in actions:
                if isinstance(action, dict) and action.get("JobName") == job_name:
                    has_matching_action = True
                    trigger_args.update(_clean_str_dict(action.get("Arguments")))
            if not has_matching_action:
                continue
            if isinstance(trigger_name, str) and trigger_name:
                if trigger_name in by_trigger:
                    by_trigger[trigger_name].update(trigger_args)
                else:
                    by_trigger[trigger_name] = trigger_args
                    ordered_sets.append(trigger_args)
            else:
                ordered_sets.append(trigger_args)
        deduped_sets: list[dict[str, str]] = []
        seen_sets: set[tuple[tuple[str, str], ...]] = set()
        for arg_set in ordered_sets:
            set_key = tuple(sorted(arg_set.items()))
            if set_key not in seen_sets:
                seen_sets.add(set_key)
                deduped_sets.append(dict(arg_set))
        return by_trigger, deduped_sets

    @staticmethod
    def _extract_workflow_run_job_runs(wf_run: dict, job_name: str) -> list[dict]:
        graph = wf_run.get(GRAPH)
        nodes = graph.get(NODES, []) if isinstance(graph, dict) else []
        if not isinstance(nodes, list):
            return []
        matched: list[dict] = []
        for node in nodes:
            if not isinstance(node, dict) or node.get("Type") != JOB_TYPE or node.get(NAME) != job_name:
                continue
            job_details = node.get("JobDetails")
            jr_list = job_details.get("JobRuns", []) if isinstance(job_details, dict) else []
            if isinstance(jr_list, list):
                matched.extend(jr for jr in jr_list if isinstance(jr, dict))
        return matched

    @staticmethod
    def _synthetic_workflow_args(workflow_name: Any, wf_run_id: Any) -> dict[str, str]:
        synthetic_args: dict[str, str] = {}
        if isinstance(workflow_name, str) and workflow_name:
            synthetic_args["--WORKFLOW_NAME"] = workflow_name
        if isinstance(wf_run_id, str) and wf_run_id:
            synthetic_args["--WORKFLOW_RUN_ID"] = wf_run_id
        return synthetic_args

    def _build_parameter_contexts(
        self,
        job_name: str,
        job_details: JobNodes,
        workflow_details: dict | None,
    ) -> list[ParameterContext]:
        default_job_args = _clean_str_dict(job_details.default_arguments)
        trigger_args_by_name, trigger_arg_sets = self._extract_trigger_arguments(job_name, workflow_details)

        default_run_props = (
            _clean_str_dict(workflow_details.get("DefaultRunProperties")) if isinstance(workflow_details, dict) else {}
        )
        workflow_name = workflow_details.get(NAME) if isinstance(workflow_details, dict) else None

        wf_runs, wf_runs_fetch_ok = self._get_workflow_runs_for_lineage(workflow_details)
        job_runs, job_runs_fetch_ok = self._get_job_runs_for_lineage(job_name)

        job_runs_by_id = {jr["Id"]: jr for jr in job_runs if isinstance(jr.get("Id"), str)}
        job_runs_by_wf_run: dict[str, list[dict]] = {}
        for jr in job_runs:
            jr_args = _clean_str_dict(jr.get("Arguments"))
            wf_id = jr_args.get("--WORKFLOW_RUN_ID") or jr_args.get("WORKFLOW_RUN_ID")
            if wf_id:
                job_runs_by_wf_run.setdefault(wf_id, []).append(jr)

        contexts: list[ParameterContext] = []
        seen: set[ParameterContext] = set()
        matched_jr_ids: set[str] = set()

        def add_ctx(
            j_args: dict[str, str],
            r_props: dict[str, str],
            *,
            job_args_opaque: bool = False,
            run_props_opaque: bool = False,
        ) -> None:
            if len(contexts) >= MAX_INSPECTED_RUNS:
                return
            ctx = ParameterContext.from_mappings(
                job_args=j_args,
                run_props=r_props,
                job_args_opaque=job_args_opaque,
                run_props_opaque=run_props_opaque,
            )
            if ctx not in seen:
                seen.add(ctx)
                contexts.append(ctx)

        for wf_run in wf_runs:
            wf_run_id = wf_run.get("WorkflowRunId")
            wf_run_props = wf_run.get("WorkflowRunProperties") or wf_run.get("RunProperties")
            wf_props = {
                **default_run_props,
                **_clean_str_dict(wf_run_props),
            }
            wf_run_props_opaque = not wf_runs_fetch_ok and not isinstance(wf_run_props, dict)
            synthetic_args = self._synthetic_workflow_args(workflow_name, wf_run_id)

            graph_jrs = self._extract_workflow_run_job_runs(wf_run, job_name)
            linked_jrs = graph_jrs or (job_runs_by_wf_run.get(wf_run_id, []) if isinstance(wf_run_id, str) else [])

            if not linked_jrs and isinstance(wf_run.get(GRAPH), dict):
                # The run graph shows this job produced no job run in this workflow run,
                # so pairing its run properties with trigger arguments would fabricate lineage.
                continue

            if linked_jrs:
                for jr in linked_jrs[:MAX_INSPECTED_RUNS]:
                    jr_id = jr.get("Id")
                    full_jr = job_runs_by_id.get(jr_id, {}) if isinstance(jr_id, str) else {}
                    if isinstance(jr_id, str):
                        matched_jr_ids.add(jr_id)
                    trig_name = jr.get("TriggerName") or full_jr.get("TriggerName")
                    trig_args = trigger_args_by_name.get(trig_name, {}) if isinstance(trig_name, str) else {}
                    jr_args = {**_clean_str_dict(full_jr.get("Arguments")), **_clean_str_dict(jr.get("Arguments"))}
                    effective_args = {**synthetic_args, **default_job_args, **trig_args, **jr_args}
                    add_ctx(
                        effective_args,
                        wf_props,
                        job_args_opaque=not job_runs_fetch_ok and not isinstance(jr.get("Arguments"), dict),
                        run_props_opaque=wf_run_props_opaque,
                    )
            else:
                for trig_args in trigger_arg_sets or [{}]:
                    effective_args = {**synthetic_args, **default_job_args, **trig_args}
                    add_ctx(
                        effective_args,
                        wf_props,
                        job_args_opaque=not job_runs_fetch_ok,
                        run_props_opaque=wf_run_props_opaque,
                    )

        self._add_unmatched_job_run_contexts(
            add_ctx,
            job_runs,
            matched_jr_ids,
            default_job_args,
            default_run_props,
            trigger_args_by_name,
            workflow_name,
            wf_runs_fetch_ok,
        )

        if not contexts:
            for trig_args in trigger_arg_sets or [{}]:
                add_ctx(
                    {**default_job_args, **trig_args},
                    default_run_props,
                    job_args_opaque=not job_runs_fetch_ok,
                    run_props_opaque=not wf_runs_fetch_ok,
                )

        return contexts

    @staticmethod
    def _is_other_workflow_job_run(
        jr_workflow_name: str | None,
        trig_name: Any,
        trigger_args_by_name: dict[str, dict[str, str]],
        workflow_name: str | None,
    ) -> bool:
        """A job shared across workflows: runs of another workflow (or of an unknown trigger
        outside this workflow) must not leak into this pipeline's lineage."""
        if not (isinstance(workflow_name, str) and workflow_name):
            return False
        if jr_workflow_name and jr_workflow_name != workflow_name:
            return True
        return bool(
            isinstance(trig_name, str)
            and trig_name
            and trigger_args_by_name
            and trig_name not in trigger_args_by_name
            and jr_workflow_name != workflow_name
        )

    def _add_unmatched_job_run_contexts(
        self,
        add_ctx: Callable[..., None],
        job_runs: list[dict],
        matched_jr_ids: set[str],
        default_job_args: dict[str, str],
        default_run_props: dict[str, str],
        trigger_args_by_name: dict[str, dict[str, str]],
        workflow_name: str | None,
        wf_runs_fetch_ok: bool,
    ) -> None:
        """Contexts for inspected job runs not linked to an inspected workflow run."""
        for jr in job_runs:
            jr_id = jr.get("Id")
            if isinstance(jr_id, str) and jr_id in matched_jr_ids:
                continue
            jr_args = _clean_str_dict(jr.get("Arguments"))
            jr_workflow_name = jr_args.get("--WORKFLOW_NAME") or jr_args.get("WORKFLOW_NAME")
            jr_workflow_run_id = jr_args.get("--WORKFLOW_RUN_ID") or jr_args.get("WORKFLOW_RUN_ID")
            trig_name = jr.get("TriggerName")
            if self._is_other_workflow_job_run(jr_workflow_name, trig_name, trigger_args_by_name, workflow_name):
                continue
            trig_args = trigger_args_by_name.get(trig_name, {}) if isinstance(trig_name, str) else {}
            effective_args = {**default_job_args, **trig_args, **jr_args}
            if jr_workflow_run_id:
                # The workflow run aged out of the inspected runs: its run properties are
                # unknown, so they stay opaque instead of falling back to the defaults.
                add_ctx(effective_args, {}, run_props_opaque=True)
            else:
                add_ctx(effective_args, default_run_props, run_props_opaque=not wf_runs_fetch_ok)

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
        # a Snowflake source of type "query" carries no table: nothing to link
        if not table_model.table_name:
            return
        direction = "sources" if key.endswith("Source") else "targets"
        if isinstance(table_model, SnowflakeNode):
            # same resolver as script refs: every configured service, unique match only
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

        resolution_cache: dict[tuple[Any, ...], EntityReference | None] = {}
        for slice_result in slices:
            self._resolve_slice_entities(slice_result, lineage_details, resolution_cache)

    def _extract_script_lineage_groups(
        self,
        script_location: str,
        contexts: list[ParameterContext],
    ) -> list[dict[str, Any]]:
        script_content = self._download_s3_script(script_location)
        if not script_content:
            return []

        groups: list[dict[str, Any]] = []
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] = {}
        for ctx in contexts:
            for slice_result in parse_glue_script_slices(script_content, context=ctx):
                details: dict[str, list[EntityReference]] = {"sources": [], "targets": []}
                self._resolve_slice_entities(slice_result, details, resolution_cache)
                declared_sources = slice_result.has_source_calls or bool(
                    slice_result.s3_sources
                    or slice_result.catalog_sources
                    or slice_result.jdbc_sources
                    or slice_result.snowflake_sources
                )
                declared_targets = slice_result.has_target_calls or bool(
                    slice_result.s3_targets
                    or slice_result.catalog_targets
                    or slice_result.jdbc_targets
                    or slice_result.snowflake_targets
                )
                if details["sources"] or details["targets"] or declared_sources or declared_targets:
                    groups.append(
                        {
                            "sources": details["sources"],
                            "targets": details["targets"],
                            "declared_sources": declared_sources,
                            "declared_targets": declared_targets,
                        }
                    )

        if not groups:
            logger.debug("No lineage found in script: %s", script_location)
        return groups

    def _resolve_slice_entities(
        self,
        result: ScriptLineageResult,
        lineage_details: dict,
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None = None,
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
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None,
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
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None = None,
    ):
        for path in paths:
            storage_entity = self._resolve_cached(
                resolution_cache, ("s3", path), lambda s3_path=path: self._resolve_s3_path(s3_path)
            )
            self._append_resolved_ref(lineage_details, direction, storage_entity)

    def _resolve_s3_path(self, path: str) -> EntityReference | None:
        try:
            # Normalize: try both with and without trailing slash
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
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None = None,
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
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None = None,
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
        resolution_cache: dict[tuple[Any, ...], EntityReference | None] | None = None,
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
        """Ordered (database, schema) pairs to try, most specific first, without repeats."""
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
        """
        Existing tables matching the name in every configured service, by FQN.
        The matches of every configured service are collected before deciding, so the
        same table ingested from two Snowflake services is ambiguous rather than
        resolved to whichever service is listed first. Each name is confirmed to
        exist: when the search misses, fqn.build returns a name built from the
        parts, which must not count as a second match.
        """
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
        Get lineage between pipeline and data sources, correlating sources and targets
        per run context and supporting one-sided source->pipeline / pipeline->target jobs.
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
            table_lineage_details = LineageDetails(
                pipeline=pipeline_ref,
                source=LineageSource.PipelineLineage,
            )
            direct_lineage_details = LineageDetails(source=LineageSource.PipelineLineage)
            seen_edges: set[tuple[str, str]] = set()

            all_groups: list[dict[str, Any]] = []
            for job in sorted(self.job_name_list):
                all_groups.extend(self._get_job_lineage_groups(job, pipeline_details))

            linked_sources: set[str] = set()
            linked_targets: set[str] = set()
            yield from self._yield_two_sided_edges(
                all_groups, seen_edges, table_lineage_details, linked_sources, linked_targets
            )
            yield from self._yield_one_sided_edges(
                all_groups, seen_edges, pipeline_ref, direct_lineage_details, linked_sources, linked_targets
            )

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

    @staticmethod
    def _yield_lineage_edge(
        seen_edges: set[tuple[str, str]],
        from_ref: EntityReference,
        to_ref: EntityReference,
        details: LineageDetails,
    ) -> Iterable[Either[AddLineageRequest]]:
        edge_key = (model_str(from_ref.id), model_str(to_ref.id))
        if edge_key in seen_edges:
            return
        seen_edges.add(edge_key)
        yield Either(
            left=None,
            right=AddLineageRequest(edge=EntitiesEdge(fromEntity=from_ref, toEntity=to_ref, lineageDetails=details)),
        )

    @staticmethod
    def _declared_sides(group: dict[str, Any], sources: list, targets: list) -> tuple[bool, bool]:
        return (
            bool(group.get("declared_sources", bool(sources))),
            bool(group.get("declared_targets", bool(targets))),
        )

    def _yield_two_sided_edges(
        self,
        all_groups: list[dict[str, Any]],
        seen_edges: set[tuple[str, str]],
        table_lineage_details: LineageDetails,
        linked_sources: set[str],
        linked_targets: set[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """Two-sided slices first: both sides must resolve, otherwise the slice is skipped
        rather than degraded to a fabricated one-sided pipeline edge."""
        for group in all_groups:
            sources: list[EntityReference] = group.get("sources") or []
            targets: list[EntityReference] = group.get("targets") or []
            declared_sources, declared_targets = self._declared_sides(group, sources, targets)
            if not (declared_sources and declared_targets):
                continue
            if not sources or not targets:
                continue
            for source in sources:
                for target in targets:
                    if model_str(source.id) == model_str(target.id):
                        continue
                    linked_sources.add(model_str(source.id))
                    linked_targets.add(model_str(target.id))
                    yield from self._yield_lineage_edge(seen_edges, source, target, table_lineage_details)

    def _yield_one_sided_edges(
        self,
        all_groups: list[dict[str, Any]],
        seen_edges: set[tuple[str, str]],
        pipeline_ref: EntityReference,
        direct_lineage_details: LineageDetails,
        linked_sources: set[str],
        linked_targets: set[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """Genuinely one-sided slices link through the pipeline, unless the table is already
        linked by a two-sided slice of this workflow."""
        for group in all_groups:
            sources: list[EntityReference] = group.get("sources") or []
            targets: list[EntityReference] = group.get("targets") or []
            declared_sources, declared_targets = self._declared_sides(group, sources, targets)
            if declared_sources and declared_targets:
                continue
            if not declared_sources:
                for target in targets:
                    if model_str(target.id) not in linked_targets:
                        yield from self._yield_lineage_edge(seen_edges, pipeline_ref, target, direct_lineage_details)
            if not declared_targets:
                for source in sources:
                    if model_str(source.id) not in linked_sources:
                        yield from self._yield_lineage_edge(seen_edges, source, pipeline_ref, direct_lineage_details)
