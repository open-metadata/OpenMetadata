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
Tableau Pipeline source to extract Prep Flows as pipeline metadata
"""

import re
import traceback
from collections.abc import Callable, Iterable
from datetime import datetime
from functools import partial

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.pipeline import (
    ExecutionError,
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
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
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauFlowOutputStep,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauLinkedFlow,
    TableauPipelineDetails,
    TableauPublishedDatasource,
    TableauRunItem,
    TableauTaskType,
)
from metadata.utils import fqn
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

# Flow runs and background (extract refresh) jobs share one vocabulary:
# Pending, InProgress, Success, Cancelled or Failed.
# ref: https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_flow.htm#get_flow_runs
RUN_STATUS_MAP = {
    "success": StatusType.Successful,
    "failed": StatusType.Failed,
    "cancelled": StatusType.Failed,
    "inprogress": StatusType.Pending,
    "pending": StatusType.Pending,
}

INPUT_TASK_PREFIX = "input_"
OUTPUT_TASK_PREFIX = "output_"
TASK_NAME_SANITIZER = re.compile(r"[^A-Za-z0-9_\-]+")
TABLEAU_TAG_CLASSIFICATION = "TableauTags"

TASK_TYPE_INPUT = "FlowInput"
TASK_TYPE_PROCESSING = "FlowProcessing"
TASK_TYPE_OUTPUT = "FlowOutputStep"
TASK_TYPE_EXTRACT_REFRESH = "ExtractRefresh"

ENTITY_TYPE_TABLE = "table"
ENTITY_TYPE_PIPELINE = "pipeline"
ENTITY_TYPE_DASHBOARD_DATA_MODEL = "dashboardDataModel"


class TableaupipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Tableau (Prep Flows)
    """

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, TableauPipelineConnection):
            raise InvalidSourceException(f"Expected TableauPipelineConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self._current_flow_id: str | None = None
        self._current_flow_lineage: TableauFlowLineage | None = None
        self._current_flow_tasks: list[Task] | None = None

    def _evict_if_new_flow(self, flow_id: str) -> None:
        """The topology processes one flow through every stage in order.
        Holding per-flow lineage / tasks for all flows ingested so far is
        unbounded; keep only the currently-processed flow's data and evict
        when we advance to the next flow_id."""
        if self._current_flow_id is not None and self._current_flow_id != flow_id:
            self._current_flow_lineage = None
            self._current_flow_tasks = None
        self._current_flow_id = flow_id

    def _get_flow_lineage(self, flow_id: str) -> TableauFlowLineage | None:
        """Fetch and cache flow lineage metadata, shared by task DAG
        construction and lineage emission to avoid duplicate GraphQL calls.
        Single-entry cache — evicted when the topology advances to a new flow."""
        self._evict_if_new_flow(flow_id)
        if self._current_flow_lineage is not None:
            return self._current_flow_lineage
        try:
            lineage = self.connection.get_flow_lineage(flow_id)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch Tableau flow lineage for %s: %s", flow_id, exc)
            lineage = None
        self._current_flow_lineage = lineage
        return lineage

    def get_pipeline_name(self, pipeline_details: TableauPipelineDetails) -> str:
        return pipeline_details.display_name or pipeline_details.name

    def get_pipelines_list(self) -> Iterable[TableauPipelineDetails]:
        yield from self.connection.get_pipelines()

    def yield_pipeline(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        try:
            source_url = self.get_source_url(pipeline_details)
            tasks = self._get_tasks(pipeline_details)
            owners = self.get_owners(pipeline_details)
            tag_labels = self._tag_labels_for_pipeline(pipeline_details)

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                displayName=pipeline_details.display_name,
                description=Markdown(pipeline_details.description) if pipeline_details.description else None,
                tasks=tasks,
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                sourceUrl=source_url,
                owners=owners,
                tags=tag_labels or None,
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.display_name or pipeline_details.name,
                    error=(
                        f"Error extracting data from {pipeline_details.display_name or pipeline_details.name} - {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_tag(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[OMetaTagAndClassification]]:
        """Emit the TableauTags classification and each flow's tags as
        OMetaTagAndClassification requests. Respects the `includeTags`
        source config."""
        if not self.source_config.includeTags:
            return
        if not pipeline_details.tags:
            return
        yield from get_ometa_tag_and_classification(
            tags=list(pipeline_details.tags),
            classification_name=TABLEAU_TAG_CLASSIFICATION,
            tag_description="Tableau Tag",
            classification_description="Tags associated with Tableau Prep flows",
            include_tags=True,
        )

    def get_owners(self, pipeline_details: TableauPipelineDetails) -> EntityReferenceList | None:
        """Resolve the flow's Tableau owner to an OpenMetadata User reference.

        Tableau's REST API exposes `flow.owner_id` (UUID). We first resolve
        the UUID to an email (cached on the client), then look up the OM
        User by that email. Returns None when any step fails — missing
        owner is not a hard failure.
        """
        if not self.source_config.includeOwners or not pipeline_details.owner_id:
            return None
        try:
            email = self.connection.get_user_email(pipeline_details.owner_id)
        except Exception as exc:
            logger.debug("Failed to resolve Tableau user %s: %s", pipeline_details.owner_id, exc)
            return None
        if not email:
            return None
        try:
            return self.metadata.get_reference_by_email(email=email, is_owner=True)
        except Exception as exc:
            logger.debug("Unable to look up OpenMetadata user for email %s: %s", email, exc)
            return None

    def _tag_labels_for_pipeline(self, pipeline_details: TableauPipelineDetails) -> list:
        """Build TagLabel list for the pipeline, scoped to the Tableau tag
        classification. Returns empty list when `includeTags` is off or the
        flow has no tags."""
        if not self.source_config.includeTags:
            return []
        if not pipeline_details.tags:
            return []
        return (
            get_tag_labels(
                metadata=self.metadata,
                tags=list(pipeline_details.tags),
                classification_name=TABLEAU_TAG_CLASSIFICATION,
                include_tags=True,
            )
            or []
        )

    def _get_tasks(self, pipeline_details: TableauPipelineDetails) -> list[Task]:
        """See _build_tasks — this wrapper caches the result so the same
        flow's task list is reused by yield_pipeline_status for per-task
        emission without re-fetching lineage or re-sanitizing ids.
        Single-entry cache — evicted when the topology advances to a new flow."""
        self._evict_if_new_flow(pipeline_details.id)
        if self._current_flow_tasks is not None:
            return self._current_flow_tasks
        tasks = self._build_tasks(pipeline_details)
        self._current_flow_tasks = tasks
        return tasks

    def _build_tasks(self, pipeline_details: TableauPipelineDetails) -> list[Task]:
        """Build the Prep flow DAG as a list of Task entities.

        The Tableau Metadata API exposes the flow graph boundary — its inputs
        (upstream tables and published data sources) and its FlowOutputStep
        nodes — but not the intermediate cleaning/transform steps. We model
        three node kinds:

        - input task per upstream table or data source  (taskType=FlowInput)
        - a single processing task                      (taskType=FlowProcessing)
        - output task per FlowOutputStep                (taskType=FlowOutputStep)

        The processing task keeps the pipeline's name so pipeline_status
        continues to target the same task that the topology context tracks.

        When the Metadata API is unavailable or the flow has no lineage
        records yet we degrade to a single processing task — the caller
        still gets a valid pipeline, just without node granularity.
        """
        source_url = self.get_source_url(pipeline_details)
        processing_task_name = pipeline_details.name
        flow_description = Markdown(pipeline_details.description) if pipeline_details.description else None
        if pipeline_details.pipeline_type == TableauTaskType.EXTRACT_REFRESH:
            return [
                Task(
                    name=processing_task_name,
                    displayName="Refresh extract",
                    description=flow_description,
                    sourceUrl=source_url,
                    taskType=TASK_TYPE_EXTRACT_REFRESH,
                )
            ]

        flow_lineage = self._get_flow_lineage(pipeline_details.id)

        if flow_lineage is None or not (
            flow_lineage.upstream_tables or flow_lineage.upstream_datasources or flow_lineage.output_steps
        ):
            return [
                Task(
                    name=processing_task_name,
                    displayName=pipeline_details.display_name,
                    description=flow_description,
                    sourceUrl=source_url,
                    taskType=TASK_TYPE_PROCESSING,
                )
            ]

        used_names: set = {processing_task_name}

        input_tasks: list[Task] = []
        for upstream in flow_lineage.upstream_tables:
            task_name = self._input_task_name(upstream.id or upstream.luid or upstream.name, used_names)
            if task_name is None:
                continue
            used_names.add(task_name)
            input_tasks.append(
                Task(
                    name=task_name,
                    displayName=upstream.name or upstream.full_name,
                    description=self._input_task_description(upstream),
                    taskType=TASK_TYPE_INPUT,
                    sourceUrl=source_url,
                    downstreamTasks=[processing_task_name],
                )
            )
        for datasource in flow_lineage.upstream_datasources:
            task_name = self._input_task_name(datasource.id or datasource.luid or datasource.name, used_names)
            if task_name is None:
                continue
            used_names.add(task_name)
            input_tasks.append(
                Task(
                    name=task_name,
                    displayName=datasource.name,
                    description=self._datasource_task_description(datasource),
                    taskType=TASK_TYPE_INPUT,
                    sourceUrl=source_url,
                    downstreamTasks=[processing_task_name],
                )
            )

        output_tasks: list[Task] = []
        for output in flow_lineage.output_steps:
            task_name = self._output_task_name(output, used_names)
            if task_name is None:
                continue
            used_names.add(task_name)
            output_tasks.append(
                Task(
                    name=task_name,
                    displayName=output.name,
                    taskType=TASK_TYPE_OUTPUT,
                    sourceUrl=source_url,
                )
            )

        processing_task = Task(
            name=processing_task_name,
            displayName=pipeline_details.display_name,
            description=flow_description,
            taskType=TASK_TYPE_PROCESSING,
            sourceUrl=source_url,
            downstreamTasks=[t.name for t in output_tasks] or None,
        )

        return input_tasks + [processing_task] + output_tasks

    @staticmethod
    def _sanitize_task_name(raw: str) -> str:
        """Collapse anything outside [A-Za-z0-9_-] to `_` so Tableau's opaque
        base64-ish node ids survive as valid Task names."""
        return TASK_NAME_SANITIZER.sub("_", raw).strip("_")

    @classmethod
    def _input_task_name(cls, base: str | None, used: set) -> str | None:
        if not base:
            return None
        return cls._unique_name(f"{INPUT_TASK_PREFIX}{cls._sanitize_task_name(base)}", used)

    @classmethod
    def _output_task_name(cls, output_step: TableauFlowOutputStep, used: set) -> str | None:
        base = output_step.id or output_step.name
        if not base:
            return None
        return cls._unique_name(f"{OUTPUT_TASK_PREFIX}{cls._sanitize_task_name(base)}", used)

    @staticmethod
    def _unique_name(candidate: str, used: set) -> str:
        """Append a numeric suffix if the sanitized name collides — Task
        names must be unique inside a pipeline."""
        if candidate not in used:
            return candidate
        suffix = 2
        while f"{candidate}_{suffix}" in used:
            suffix += 1
        return f"{candidate}_{suffix}"

    @staticmethod
    def _input_task_description(upstream: TableauLineageTable) -> Markdown | None:
        parts = []
        if upstream.full_name:
            parts.append(f"**Source table:** `{upstream.full_name}`")
        elif upstream.name:
            parts.append(f"**Source table:** `{upstream.name}`")
        if upstream.database and upstream.database.name:
            parts.append(f"**Database:** `{upstream.database.name}`")
        if upstream.database and upstream.database.connection_type:
            parts.append(f"**Connection type:** `{upstream.database.connection_type}`")
        return Markdown("\n\n".join(parts)) if parts else None

    @staticmethod
    def _datasource_task_description(datasource: TableauPublishedDatasource) -> Markdown | None:
        parts = []
        if datasource.name:
            parts.append(f"**Source data source:** `{datasource.name}`")
        if datasource.project_name:
            parts.append(f"**Project:** `{datasource.project_name}`")
        return Markdown("\n\n".join(parts)) if parts else None

    def yield_pipeline_lineage_details(
        self, pipeline_details: TableauPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Emit lineage edges sourced from the Tableau Metadata API.

        The flow is a node in the graph: its inputs (tables, published data
        sources) point at it and it points at its outputs (tables it writes,
        published data sources it produces) and at the flows that consume it.
        Each input/output has its own error boundary so one bad reference does
        not drop the rest of the flow's lineage."""
        if pipeline_details.pipeline_type == TableauTaskType.EXTRACT_REFRESH:
            yield from self._extract_refresh_lineage(pipeline_details)
            return
        flow_lineage = self._get_flow_lineage(pipeline_details.id)
        if flow_lineage is None or not (
            flow_lineage.upstream_tables
            or flow_lineage.upstream_datasources
            or flow_lineage.downstream_tables
            or flow_lineage.downstream_datasources
            or flow_lineage.next_downstream_flows
        ):
            return

        pipeline_entity = self._get_pipeline_entity()
        if pipeline_entity is None:
            logger.warning("Pipeline entity not found for %s, skipping lineage.", pipeline_details.name)
            return
        pipeline_ref = EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE)

        for table in flow_lineage.upstream_tables:
            yield from self._edges_or_error(
                f"upstream table {table.full_name or table.name}",
                partial(self._upstream_table_edges, table, pipeline_ref),
            )
        for datasource in flow_lineage.upstream_datasources:
            yield from self._edges_or_error(
                f"upstream data source {datasource.name or datasource.id}",
                partial(self._upstream_datasource_edges, datasource, pipeline_ref),
            )
        for table in flow_lineage.downstream_tables:
            yield from self._edges_or_error(
                f"downstream table {table.full_name or table.name}",
                partial(self._downstream_table_edges, table, pipeline_ref),
            )
        for datasource in flow_lineage.downstream_datasources:
            yield from self._edges_or_error(
                f"downstream data source {datasource.name or datasource.id}",
                partial(self._downstream_datasource_edges, datasource, pipeline_ref),
            )
        for flow in flow_lineage.next_downstream_flows:
            yield from self._edges_or_error(
                f"downstream flow {flow.name or flow.luid}",
                partial(self._downstream_flow_edges, flow, pipeline_ref),
            )

    @staticmethod
    def _edges_or_error(
        label: str, build: Callable[[], list[AddLineageRequest]]
    ) -> Iterable[Either[AddLineageRequest]]:
        try:
            for request in build():
                yield Either(right=request)
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error building lineage for {label}: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    @staticmethod
    def _lineage_request(
        from_ref: EntityReference, to_ref: EntityReference, pipeline_ref: EntityReference | None
    ) -> AddLineageRequest:
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=from_ref,
                toEntity=to_ref,
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage, pipeline=pipeline_ref),
            )
        )

    def _upstream_table_edges(
        self, upstream: TableauLineageTable, pipeline_ref: EntityReference
    ) -> list[AddLineageRequest]:
        tables = self._resolve_upstream_tables(upstream)
        if not tables:
            logger.debug("No matching OpenMetadata Table for upstream %s", upstream.full_name or upstream.name)
        return [
            self._lineage_request(EntityReference(id=table.id, type=ENTITY_TYPE_TABLE), pipeline_ref, pipeline_ref)
            for table in tables
        ]

    def _downstream_table_edges(
        self, downstream: TableauLineageTable, pipeline_ref: EntityReference
    ) -> list[AddLineageRequest]:
        table = self._resolve_table_entity(downstream)
        if table is None:
            logger.debug("No matching OpenMetadata Table for output %s", downstream.full_name or downstream.name)
            return []
        return [self._lineage_request(pipeline_ref, EntityReference(id=table.id, type=ENTITY_TYPE_TABLE), pipeline_ref)]

    def _upstream_datasource_edges(
        self, datasource: TableauPublishedDatasource, pipeline_ref: EntityReference
    ) -> list[AddLineageRequest]:
        datamodel = self._lookup_datamodel(datasource.id, datasource.name)
        if datamodel is None:
            return []
        return [
            self._lineage_request(
                EntityReference(id=datamodel.id, type=ENTITY_TYPE_DASHBOARD_DATA_MODEL), pipeline_ref, pipeline_ref
            )
        ]

    def _downstream_datasource_edges(
        self, datasource: TableauPublishedDatasource, pipeline_ref: EntityReference
    ) -> list[AddLineageRequest]:
        datamodel = self._lookup_datamodel(datasource.id, datasource.name)
        if datamodel is None:
            return []
        return [
            self._lineage_request(
                pipeline_ref, EntityReference(id=datamodel.id, type=ENTITY_TYPE_DASHBOARD_DATA_MODEL), pipeline_ref
            )
        ]

    def _downstream_flow_edges(self, flow: TableauLinkedFlow, pipeline_ref: EntityReference) -> list[AddLineageRequest]:
        """Resolve a downstream flow to its OM Pipeline entity (must live
        in the same Tableau pipeline service) and yield a pipeline →
        pipeline lineage edge."""
        # Pipelines are named after the REST id, which is the Metadata API luid.
        flow_id = flow.luid or flow.id
        if not flow_id:
            return []
        downstream_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=flow_id,
        )
        downstream_entity = self.metadata.get_by_name(entity=Pipeline, fqn=downstream_fqn) if downstream_fqn else None
        if downstream_entity is None:
            logger.debug(
                "Downstream flow %s not found in OpenMetadata yet — lineage will resolve on a subsequent ingestion.",
                flow_id,
            )
            return []
        return [
            self._lineage_request(
                pipeline_ref, EntityReference(id=downstream_entity.id, type=ENTITY_TYPE_PIPELINE), pipeline_ref=None
            )
        ]

    def _extract_refresh_lineage(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[AddLineageRequest]]:
        """An extract refresh points at the data model(s) it refreshes: the
        published data source, or each embedded extract of the workbook."""
        if pipeline_details.target_type is None:
            return
        datasource_ids = self.connection.get_extract_datasource_ids(pipeline_details.target_type, pipeline_details.id)
        if not datasource_ids:
            return
        pipeline_entity = self._get_pipeline_entity()
        if pipeline_entity is None:
            logger.warning("Pipeline entity not found for %s, skipping lineage.", pipeline_details.name)
            return
        pipeline_ref = EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE)
        for datasource_id in datasource_ids:
            yield from self._edges_or_error(
                f"refreshed data source {datasource_id}",
                partial(self._downstream_datasource_edges, TableauPublishedDatasource(id=datasource_id), pipeline_ref),
            )

    def _lookup_datamodel(self, datasource_id: str | None, label: str | None) -> DashboardDataModel | None:
        """Find the DashboardDataModel the dashboard Tableau connector created
        for a Tableau data source, across every dashboard service.

        That connector names data models after the Metadata API `id` (not the
        REST `luid`), and a data model's FQN is `{service}.model.{name}`, so an
        FQN search for `*.{id}` finds it without knowing the service."""
        if not datasource_id:
            return None
        try:
            entities = self.metadata.es_search_from_fqn(
                entity_type=DashboardDataModel,
                fqn_search_string=f"*.{datasource_id}",
            )
        except Exception as exc:
            logger.debug("DashboardDataModel lookup failed for %s: %s", datasource_id, exc)
            return None
        if not entities:
            logger.debug(
                "Data model for Tableau data source %s not found — ensure the dashboard Tableau connector has run.",
                label or datasource_id,
            )
            return None
        return entities[0]

    def _get_pipeline_entity(self) -> Pipeline | None:
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        if not pipeline_fqn:
            return None
        return self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)

    def _resolve_upstream_tables(self, upstream: TableauLineageTable) -> list[Table]:
        """Resolve a single Tableau upstream reference to OpenMetadata Tables.

        A named DatabaseTable resolves directly. Only when Tableau hides the
        name (custom SQL, or tables the account cannot see) do we parse the
        custom SQL in `referenced_by_queries` — that list holds every query on
        the site that reads the table, so parsing it for a named table would
        attach tables from unrelated workbooks. Mirrors the dashboard Tableau
        connector.
        """
        if upstream.name:
            direct = self._resolve_table_entity(upstream)
            return [direct] if direct is not None else []

        resolved: dict[str, Table] = {}
        for referenced in upstream.referenced_by_queries:
            if not referenced.query:
                continue
            for table in self._resolve_tables_from_sql(referenced.query):
                resolved.setdefault(str(table.id.root), table)
        return list(resolved.values())

    def _resolve_tables_from_sql(self, query: str) -> list[Table]:
        """Parse custom SQL and resolve each source table to an OM Table.

        Uses ANSI dialect by default — Tableau doesn't tell us which DB
        dialect the custom SQL targets, and the parser falls back cleanly
        for dialect mismatches. Resolution goes through the same dbServiceNames
        path that direct upstream tables use, so dialect-specific quirks are
        handled by the subsequent FQN lookup.
        """
        try:
            parser = LineageParser(query, Dialect.ANSI)
        except Exception as exc:
            logger.debug("LineageParser failed on custom SQL: %s", exc)
            return []

        results: list[Table] = []
        for source in parser.source_tables or []:
            source_fqn = str(source)
            split = fqn.split_table_name(source_fqn)
            parsed_database = split.get("database")
            candidate = TableauLineageTable(
                name=source_fqn,
                fullName=source_fqn,
                schema=split.get("database_schema"),
                database=(TableauLineageDatabase(name=parsed_database) if parsed_database else None),
            )
            resolved = self._resolve_table_entity(candidate)
            if resolved is not None:
                results.append(resolved)
        return results

    def _resolve_table_entity(self, upstream: TableauLineageTable) -> Table | None:
        """Resolve a Tableau upstream table to an OpenMetadata Table entity.

        Tries the configured dbServiceNames first with explicit fqn.build,
        then falls back to a scoped search across any database service when
        no match is found. Returns None when neither path resolves.
        """
        if not upstream.name:
            return None

        database_schema_table = fqn.split_table_name(upstream.name)
        database_name = (
            upstream.database.name
            if upstream.database and upstream.database.name
            else database_schema_table.get("database")
        )
        schema_name = upstream.schema_ or database_schema_table.get("database_schema")
        table_name = database_schema_table.get("table") or upstream.name

        for db_service_name in self.get_db_service_names() or []:
            entity_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=db_service_name,
                database_name=database_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            if not entity_fqn:
                continue
            entity = self.metadata.get_by_name(entity=Table, fqn=entity_fqn)
            if entity:
                return entity

        fqn_search_string = build_es_fqn_search_string(
            database_name=database_name or "",
            schema_name=schema_name or "",
            service_name="*",
            table_name=table_name,
        )
        result = self.metadata.search_in_any_service(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
        )
        if isinstance(result, list):
            return result[0] if result else None
        return result

    def yield_pipeline_status(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        try:
            runs = (
                self.connection.get_extract_refresh_runs(pipeline_details.id)
                if pipeline_details.pipeline_type == TableauTaskType.EXTRACT_REFRESH
                else self.connection.get_flow_runs(pipeline_details.id)
            )
            if not runs:
                return
            task_names = self._task_names_for_status(pipeline_details)
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            for run in runs:
                execution_status = self._get_status(run)
                start_time = self._to_timestamp(run.started_at)
                end_time = self._to_timestamp(run.completed_at)
                # The status timestamp is the run's key. startedAt is fixed for the
                # life of a run; keying on completedAt would store an in-progress
                # run twice, leaving its Pending row behind once it finishes.
                run_key = start_time or end_time
                if run_key is None:
                    continue

                task_statuses = [
                    TaskStatus(
                        name=name,
                        executionStatus=execution_status,
                        startTime=start_time,
                        endTime=end_time,
                    )
                    for name in task_names
                ]
                pipeline_status = PipelineStatus(
                    taskStatus=task_statuses,
                    executionStatus=execution_status,
                    timestamp=run_key,
                    endTime=end_time,
                    executionId=run.id,
                    error=ExecutionError(errorMessage=run.error) if run.error else None,
                )
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=(f"Error extracting status for {pipeline_details.name} - {err}"),
                    stackTrace=traceback.format_exc(),
                )
            )

    def _task_names_for_status(self, pipeline_details: TableauPipelineDetails) -> list[str]:
        """Return the task names to annotate with the flow-run status.

        Tableau's REST API reports a single status per flow run — not per
        step — so every task in the DAG gets the same status. Emitting one
        TaskStatus per task keeps the UI task list consistent with the
        pipeline structure from yield_pipeline.

        If no lineage was available (tasks cache holds only the fallback
        single task), this returns one entry — the flow's processing task.
        """
        tasks = self._get_tasks(pipeline_details)
        return [task.name for task in tasks] or [pipeline_details.name]

    @staticmethod
    def _get_status(run: TableauRunItem) -> StatusType:
        if run.status:
            return RUN_STATUS_MAP.get(run.status.lower(), StatusType.Pending)
        return StatusType.Pending

    @staticmethod
    def _to_timestamp(dt: datetime | None) -> Timestamp | None:
        if dt is None:
            return None
        try:
            return Timestamp(int(dt.timestamp() * 1000))
        except (ValueError, OverflowError, OSError) as exc:
            logger.debug("Could not convert %r to timestamp: %s", dt, exc)
            return None

    def get_source_url(self, pipeline_details: TableauPipelineDetails) -> SourceUrl | None:
        try:
            if pipeline_details.webpage_url:
                return SourceUrl(pipeline_details.webpage_url)
            return SourceUrl(f"{clean_uri(str(self.service_connection.hostPort))}/#/flows")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Unable to get source url for %s: %s", pipeline_details.name, exc)
        return None

    def close(self):
        self._current_flow_id = None
        self._current_flow_lineage = None
        self._current_flow_tasks = None
        super().close()
