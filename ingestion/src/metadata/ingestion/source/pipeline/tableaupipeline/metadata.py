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
from collections.abc import Iterable
from datetime import datetime

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.pipeline import (
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
    ColumnLineage,
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
    TableauDownstreamDatasource,
    TableauDownstreamFlow,
    TableauFlowLineage,
    TableauFlowOutputStep,
    TableauFlowRunItem,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauPipelineDetails,
)
from metadata.utils import fqn
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

FLOW_RUN_STATUS_MAP = {
    "success": StatusType.Successful,
    "failed": StatusType.Failed,
    "cancelled": StatusType.Failed,
    "inprogress": StatusType.Pending,
    "pending": StatusType.Pending,
    "created": StatusType.Pending,
}

INPUT_TASK_PREFIX = "input_"
OUTPUT_TASK_PREFIX = "output_"
TASK_NAME_SANITIZER = re.compile(r"[^A-Za-z0-9_\-]+")
TABLEAU_TAG_CLASSIFICATION = "TableauTags"

TASK_TYPE_INPUT = "FlowInput"
TASK_TYPE_PROCESSING = "FlowProcessing"
TASK_TYPE_OUTPUT = "FlowOutputStep"

ENTITY_TYPE_TABLE = "table"
ENTITY_TYPE_PIPELINE = "pipeline"
ENTITY_TYPE_DASHBOARD_DATA_MODEL = "dashboardDataModel"


class TableaupipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Tableau (Prep Flows)
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config = WorkflowSource.model_validate(config_dict)
        connection: TableauPipelineConnection = config.serviceConnection.root.config
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
            logger.warning(f"Failed to fetch Tableau flow lineage for {flow_id}: {exc}")
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
        if not getattr(self.source_config, "includeTags", True):
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
        if not pipeline_details.owner_id:
            return None
        try:
            email = self.connection.get_user_email(pipeline_details.owner_id)
        except Exception as exc:
            logger.debug(f"Failed to resolve Tableau user {pipeline_details.owner_id}: {exc}")
            return None
        if not email:
            return None
        try:
            return self.metadata.get_reference_by_email(email=email, is_owner=True)
        except Exception as exc:
            logger.debug(f"Unable to look up OpenMetadata user for email {email}: {exc}")
            return None

    def _tag_labels_for_pipeline(self, pipeline_details: TableauPipelineDetails) -> list:
        """Build TagLabel list for the pipeline, scoped to the Tableau tag
        classification. Returns empty list when `includeTags` is off or the
        flow has no tags."""
        if not getattr(self.source_config, "includeTags", True):
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

        The Tableau Metadata API exposes the flow graph boundary — upstream
        tables (inputs) and FlowOutputStep nodes (outputs) — but not the
        intermediate cleaning/transform steps. We model three node kinds:

        - input task per upstream table     (taskType=FlowInput)
        - a single processing task          (taskType=FlowProcessing)
        - output task per FlowOutputStep    (taskType=FlowOutputStep)

        The processing task keeps the pipeline's name so pipeline_status
        continues to target the same task that the topology context tracks.

        When the Metadata API is unavailable or the flow has no lineage
        records yet we degrade to a single processing task — the caller
        still gets a valid pipeline, just without node granularity.
        """
        source_url = self.get_source_url(pipeline_details)
        flow_lineage = self._get_flow_lineage(pipeline_details.id)

        if flow_lineage is None or (not flow_lineage.upstream_tables and not flow_lineage.output_steps):
            return [
                Task(
                    name=pipeline_details.name,
                    displayName=pipeline_details.display_name,
                    description=pipeline_details.description,
                    sourceUrl=source_url,
                    taskType=TASK_TYPE_PROCESSING,
                )
            ]

        processing_task_name = pipeline_details.name
        used_names: set = {processing_task_name}

        input_tasks: list[Task] = []
        for upstream in flow_lineage.upstream_tables:
            task_name = self._input_task_name(upstream, used_names)
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
            description=pipeline_details.description,
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
    def _input_task_name(cls, upstream: TableauLineageTable, used: set) -> str | None:
        base = upstream.id or upstream.luid or upstream.name
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
    def _input_task_description(upstream: TableauLineageTable) -> str | None:
        parts = []
        if upstream.full_name:
            parts.append(f"**Source table:** `{upstream.full_name}`")
        elif upstream.name:
            parts.append(f"**Source table:** `{upstream.name}`")
        if upstream.database and upstream.database.name:
            parts.append(f"**Database:** `{upstream.database.name}`")
        if upstream.database and upstream.database.connection_type:
            parts.append(f"**Connection type:** `{upstream.database.connection_type}`")
        return "\n\n".join(parts) if parts else None

    def yield_pipeline_lineage_details(
        self, pipeline_details: TableauPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Emit lineage edges sourced from the Tableau Metadata API.

        Decomposed into three helpers — upstream, downstream-flows, and
        downstream-datasources — so each side has its own error boundary
        and this orchestrator stays below the branch-count threshold."""
        flow_lineage = self._get_flow_lineage(pipeline_details.id)
        if flow_lineage is None:
            return
        if not (flow_lineage.upstream_tables or flow_lineage.downstream_flows or flow_lineage.downstream_datasources):
            return

        pipeline_entity = self._get_pipeline_entity()
        if pipeline_entity is None:
            logger.warning(f"Pipeline entity not found for {pipeline_details.name}, skipping lineage.")
            return

        yield from self._yield_upstream_lineage(pipeline_details, pipeline_entity, flow_lineage)
        yield from self._yield_downstream_flow_lineage(pipeline_entity, flow_lineage)
        yield from self._yield_downstream_datasource_lineage(pipeline_entity, flow_lineage)

    def _yield_upstream_lineage(
        self,
        pipeline_details: TableauPipelineDetails,
        pipeline_entity: Pipeline,
        flow_lineage: TableauFlowLineage,
    ) -> Iterable[Either[AddLineageRequest]]:
        column_lineage_by_table_id = self._build_column_lineage_index(flow_lineage)
        for upstream in flow_lineage.upstream_tables:
            try:
                resolved_tables = self._resolve_upstream_tables(upstream)
                if not resolved_tables:
                    logger.debug(
                        f"No matching OpenMetadata Table for upstream "
                        f"{upstream.full_name or upstream.name} "
                        f"(flow={pipeline_details.name})"
                    )
                    continue
                col_lineage = column_lineage_by_table_id.get(upstream.id) or None
                for table_entity in resolved_tables:
                    yield Either(right=self._upstream_lineage_request(table_entity, pipeline_entity, col_lineage))
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=(
                            f"Error building lineage edge for upstream table "
                            f"{upstream.full_name or upstream.name}: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_downstream_flow_lineage(
        self,
        pipeline_entity: Pipeline,
        flow_lineage: TableauFlowLineage,
    ) -> Iterable[Either[AddLineageRequest]]:
        for downstream_flow in flow_lineage.downstream_flows:
            try:
                edge = self._build_downstream_flow_edge(pipeline_entity, downstream_flow)
                if edge is not None:
                    yield Either(right=edge)
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=(
                            f"Error building cross-flow lineage to "
                            f"{downstream_flow.name or downstream_flow.luid}: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_downstream_datasource_lineage(
        self,
        pipeline_entity: Pipeline,
        flow_lineage: TableauFlowLineage,
    ) -> Iterable[Either[AddLineageRequest]]:
        for downstream_ds in flow_lineage.downstream_datasources:
            try:
                edge = self._build_downstream_datasource_edge(pipeline_entity, downstream_ds)
                if edge is not None:
                    yield Either(right=edge)
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=(
                            f"Error building lineage edge to datasource "
                            f"{downstream_ds.name or downstream_ds.luid}: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    @staticmethod
    def _upstream_lineage_request(
        table_entity: Table,
        pipeline_entity: Pipeline,
        col_lineage: list[ColumnLineage] | None,
    ) -> AddLineageRequest:
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=table_entity.id, type=ENTITY_TYPE_TABLE),
                toEntity=EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE),
                lineageDetails=LineageDetails(
                    source=LineageSource.PipelineLineage,
                    pipeline=EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE),
                    columnsLineage=col_lineage,
                ),
            )
        )

    def _build_downstream_flow_edge(
        self,
        pipeline_entity: Pipeline,
        downstream_flow: TableauDownstreamFlow,
    ) -> AddLineageRequest | None:
        """Resolve a downstream flow to its OM Pipeline entity (must live
        in the same Tableau pipeline service) and yield a pipeline →
        pipeline lineage edge."""
        flow_id = downstream_flow.luid or downstream_flow.id
        if not flow_id:
            return None
        downstream_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=flow_id,
        )
        if not downstream_fqn:
            return None
        downstream_entity = self.metadata.get_by_name(entity=Pipeline, fqn=downstream_fqn)
        if downstream_entity is None:
            logger.debug(
                f"Downstream flow {flow_id} not found in OpenMetadata yet — "
                "lineage will resolve on a subsequent ingestion."
            )
            return None
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE),
                toEntity=EntityReference(id=downstream_entity.id, type=ENTITY_TYPE_PIPELINE),
                lineageDetails=LineageDetails(
                    source=LineageSource.PipelineLineage,
                ),
            )
        )

    def _build_downstream_datasource_edge(
        self,
        pipeline_entity: Pipeline,
        downstream_ds: TableauDownstreamDatasource,
    ) -> AddLineageRequest | None:
        """Resolve a downstream published Tableau datasource to its
        DashboardDataModel entity (ingested by the dashboard Tableau
        connector) and yield a pipeline → datamodel lineage edge.
        Falls back to None when the datamodel is not yet ingested.

        Resolution uses `list_entities_by_name` across dashboard services
        keyed on the datamodel's Tableau id — avoids a wildcard ES query
        that could match unrelated DashboardDataModels."""
        datamodel_id = downstream_ds.luid or downstream_ds.id
        if not datamodel_id:
            return None
        datamodel_entity = self._lookup_datamodel_by_id(datamodel_id)
        if datamodel_entity is None:
            logger.debug(
                f"Downstream datamodel {datamodel_id} not found — ensure the dashboard Tableau connector has run."
            )
            return None
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE),
                toEntity=EntityReference(id=datamodel_entity.id, type=ENTITY_TYPE_DASHBOARD_DATA_MODEL),
                lineageDetails=LineageDetails(
                    source=LineageSource.PipelineLineage,
                    pipeline=EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE),
                ),
            )
        )

    def _lookup_datamodel_by_id(self, datamodel_id: str) -> DashboardDataModel | None:
        """Look up a DashboardDataModel by its Tableau id across every
        dashboard service. Uses the ES FQN pattern `*.{datamodel_id}`
        which matches the canonical `{service}.{data_model_name}` FQN shape
        for DashboardDataModel entities."""
        try:
            entities = self.metadata.es_search_from_fqn(
                entity_type=DashboardDataModel,
                fqn_search_string=f"*.{datamodel_id}",
            )
        except Exception as exc:
            logger.debug(f"DashboardDataModel lookup failed for {datamodel_id}: {exc}")
            return None
        if not entities:
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
        """Resolve a single Tableau upstream reference to one or more
        OpenMetadata Tables.

        Two resolution paths:
        1. Direct — `upstream.name` identifies a concrete DatabaseTable.
        2. Custom-SQL — the upstream is a CustomSQLTable whose query
           lives in `referenced_by_queries`; we parse the SQL and resolve
           each source table the parser finds.

        Returned Tables are de-duplicated by id.
        """
        resolved: dict[str, Table] = {}

        direct = self._resolve_table_entity(upstream)
        if direct is not None and direct.id is not None:
            resolved[str(direct.id.root)] = direct

        for referenced in upstream.referenced_by_queries or []:
            if not referenced.query:
                continue
            for table in self._resolve_tables_from_sql(referenced.query):
                if table.id is None:
                    continue
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
            logger.debug(f"LineageParser failed on custom SQL: {exc}")
            return []

        results: list[Table] = []
        for source in parser.source_tables or []:
            source_fqn = str(source)
            split = fqn.split_table_name(source_fqn)
            parsed_database = split.get("database")
            candidate = TableauLineageTable(
                name=source_fqn,
                full_name=source_fqn,
                schema_=split.get("database_schema"),
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

    @staticmethod
    def _build_column_lineage_index(
        flow_lineage: TableauFlowLineage,
    ) -> dict[str, list[ColumnLineage]]:
        """Group column-level lineage edges by upstream table id.

        The Metadata API exposes `flow.outputFields[].upstreamColumns`,
        each upstream column carrying its source table. This is collapsed
        into a {upstream_table_id: [ColumnLineage]} map so the caller can
        look up the column edges for a given upstream table without
        re-scanning the output fields for each one.

        Edges are deduplicated by `(from_column, to_column)` — the same
        upstream column can feed multiple output field computations that
        collapse to the same output column name, and we don't want the
        edge emitted twice.
        """
        seen: dict[str, set] = {}
        index: dict[str, list[ColumnLineage]] = {}
        for output_field in flow_lineage.output_fields or []:
            if not output_field.name:
                continue
            to_column = output_field.name
            for upstream_col in output_field.upstream_columns or []:
                if not (upstream_col.name and upstream_col.table and upstream_col.table.id):
                    continue
                table_id = upstream_col.table.id
                key = (upstream_col.name, to_column)
                seen_for_table = seen.setdefault(table_id, set())
                if key in seen_for_table:
                    continue
                seen_for_table.add(key)
                index.setdefault(table_id, []).append(
                    ColumnLineage(
                        fromColumns=[upstream_col.name],
                        toColumn=to_column,
                    )
                )
        return index

    def yield_pipeline_status(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        try:
            runs = self.connection.get_flow_runs(pipeline_details.id)
            task_names = self._task_names_for_status(pipeline_details)
            for run in runs:
                execution_status = self._get_status(run)
                start_time = self._to_timestamp(run.started_at)
                end_time = self._to_timestamp(run.completed_at)
                run_timestamp = end_time or start_time
                if run_timestamp is None:
                    continue

                task_statuses = [
                    TaskStatus(
                        name=name,
                        executionStatus=execution_status.value,
                        startTime=start_time,
                        endTime=end_time,
                    )
                    for name in task_names
                ]
                pipeline_status = PipelineStatus(
                    taskStatus=task_statuses,
                    executionStatus=execution_status.value,
                    timestamp=run_timestamp,
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
    def _get_status(run: TableauFlowRunItem) -> StatusType:
        if run.status:
            return FLOW_RUN_STATUS_MAP.get(run.status.lower(), StatusType.Pending)
        return StatusType.Pending

    @staticmethod
    def _to_timestamp(dt: datetime | None) -> Timestamp | None:
        if dt is None:
            return None
        try:
            return Timestamp(int(dt.timestamp() * 1000))
        except (ValueError, OverflowError, OSError) as exc:
            logger.debug(f"Could not convert {dt!r} to timestamp: {exc}")
            return None

    def get_source_url(self, pipeline_details: TableauPipelineDetails) -> SourceUrl | None:
        try:
            if pipeline_details.webpage_url:
                return SourceUrl(pipeline_details.webpage_url)
            return SourceUrl(f"{clean_uri(str(self.service_connection.hostPort))}/#/flows")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url for {pipeline_details.name}: {exc}")
        return None

    def close(self):
        super().close()
        self._current_flow_id = None
        self._current_flow_lineage = None
        self._current_flow_tasks = None
        connection = getattr(self, "connection", None)
        if connection is not None:
            try:
                connection.sign_out()
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error signing out of Tableau: {exc}")
