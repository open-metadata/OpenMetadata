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
Tableau Pipeline source: Prep flows and extract refreshes as pipelines
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
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauMetadataApiError,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauLinkedFlow,
    TableauPipelineDetails,
    TableauPipelineKind,
    TableauPublishedDatasource,
    TableauRunItem,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_pipeline
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels
from metadata.utils.time_utils import datetime_to_timestamp

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

_NOT_FETCHED = object()


class TableaupipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract Pipeline metadata from
    Tableau: Prep flows and the extract refreshes of published data sources
    and workbooks
    """

    @classmethod
    def create(
        cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None
    ) -> "TableaupipelineSource":
        config = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, TableauPipelineConnection):
            raise InvalidSourceException(f"Expected TableauPipelineConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata) -> None:
        super().__init__(config, metadata)
        self._current_flow_id: str | None = None
        self._current_flow_lineage: TableauFlowLineage | None | object = _NOT_FETCHED
        self._current_flow_lineage_failed = False
        self._current_flow_tasks: list[Task] | None = None
        self._metadata_api_failed = False
        # Flow -> flow edges whose downstream flow was not ingested yet; only
        # unresolved edges are held, and emitted once every flow is in.
        self._pending_flow_edges: list[tuple[EntityReference, str]] = []

    def _evict_if_new_flow(self, flow_id: str) -> None:
        """The topology processes one pipeline through every stage in order.
        Holding per-flow lineage / tasks for all flows ingested so far is
        unbounded; keep only the current flow's data and evict when we advance
        to the next flow_id."""
        if self._current_flow_id != flow_id:
            self._current_flow_lineage = _NOT_FETCHED
            self._current_flow_lineage_failed = False
            self._current_flow_tasks = None
        self._current_flow_id = flow_id

    def _get_flow_lineage(self, flow_id: str) -> TableauFlowLineage | None:
        """Fetch and cache flow lineage metadata, shared by task DAG
        construction and lineage emission so the Metadata API is queried once
        per flow, with or without a result."""
        self._evict_if_new_flow(flow_id)
        if self._current_flow_lineage is _NOT_FETCHED:
            try:
                self._current_flow_lineage = self.connection.get_flow_lineage(flow_id)
            except TableauMetadataApiError as exc:
                self._current_flow_lineage = None
                self._current_flow_lineage_failed = True
                self._log_metadata_api_failure(exc)
        return self._current_flow_lineage  # pyright: ignore[reportReturnType]

    def _log_metadata_api_failure(self, exc: Exception) -> None:
        if self._metadata_api_failed:
            logger.debug("%s", exc)
            return
        logger.warning(
            "%s. Lineage and flow steps need the Tableau Metadata API: "
            "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html. "
            "Further Metadata API failures are logged at debug level.",
            exc,
        )
        self._metadata_api_failed = True

    def get_pipeline_name(self, pipeline_details: TableauPipelineDetails) -> str:
        return pipeline_details.display_name or pipeline_details.name

    def get_pipelines_list(self) -> Iterable[TableauPipelineDetails]:
        yield from self.connection.get_pipelines(keep=self._is_included)

    def _is_included(self, pipeline_details: TableauPipelineDetails) -> bool:
        return not filter_by_pipeline(
            self.source_config.pipelineFilterPattern, self.get_pipeline_name(pipeline_details)
        )

    def _pipeline_fqn(self, pipeline_details: TableauPipelineDetails) -> str | None:
        """Built from the pipeline's own name rather than the topology context,
        which still names the previous pipeline when this one failed to yield."""
        return fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=pipeline_details.name,
        )

    def yield_pipeline(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        try:
            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                displayName=pipeline_details.display_name,
                description=Markdown(pipeline_details.description) if pipeline_details.description else None,
                tasks=self._get_tasks(pipeline_details),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                sourceUrl=self.get_source_url(pipeline_details),
                owners=self.get_owners(pipeline_details),
                tags=self._tag_labels_for_pipeline(pipeline_details) or None,
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except Exception as err:
            pipeline_name = self.get_pipeline_name(pipeline_details)
            yield Either(
                left=StackTraceError(
                    name=pipeline_name,
                    error=f"Error extracting data from {pipeline_name} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def mark_pipelines_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """A partial extract refresh listing would make every pipeline it missed
        look deleted in Tableau, so nothing is marked deleted that run."""
        if self.service_connection.includeExtractRefreshes and not self.connection.extract_refresh_listing_complete:
            logger.warning(
                "Some Tableau extract refreshes could not be listed, so no pipeline is marked as deleted this run."
            )
            return
        yield from super().mark_pipelines_as_deleted()

    def yield_tag(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[OMetaTagAndClassification]]:
        """Emit the TableauTags classification and the pipeline's tags. Respects
        the `includeTags` source config."""
        if not self.source_config.includeTags or not pipeline_details.tags:
            return
        yield from get_ometa_tag_and_classification(
            tags=list(pipeline_details.tags),
            classification_name=TABLEAU_TAG_CLASSIFICATION,
            tag_description="Tableau Tag",
            classification_description="Tags associated with Tableau Prep flows",
            include_tags=True,
        )

    def get_owners(self, pipeline_details: TableauPipelineDetails) -> EntityReferenceList | None:
        """Resolve the Tableau owner of the flow, data source or workbook to an
        OpenMetadata User reference, through the owner's email address. A missing
        owner is not a failure."""
        if not self.source_config.includeOwners or not pipeline_details.owner_id:
            return None
        email = self.connection.get_user_email(pipeline_details.owner_id)
        if not email:
            return None
        try:
            return self.metadata.get_reference_by_email(email=email)
        except Exception as exc:
            logger.debug("Unable to look up OpenMetadata user for email %s: %s", email, exc)
            return None

    def _tag_labels_for_pipeline(self, pipeline_details: TableauPipelineDetails) -> list[TagLabel]:
        if not self.source_config.includeTags or not pipeline_details.tags:
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
        """See _build_tasks — cached so yield_pipeline_status annotates the same
        task list the pipeline was created with."""
        self._evict_if_new_flow(pipeline_details.id)
        if self._current_flow_tasks is None:
            self._current_flow_tasks = self._build_tasks(pipeline_details)
        return self._current_flow_tasks

    def _build_tasks(self, pipeline_details: TableauPipelineDetails) -> list[Task]:
        """Build the pipeline's tasks.

        An extract refresh is a single task. A Prep flow is modelled from the
        graph boundary the Metadata API exposes — it does not expose the
        intermediate cleaning/transform steps:

        - input task per upstream table or data source  (taskType=FlowInput)
        - a single processing task                      (taskType=FlowProcessing)
        - output task per FlowOutputStep                (taskType=FlowOutputStep)

        The processing task keeps the pipeline's name so pipeline status
        targets the same task the topology context tracks. When the flow has no
        lineage records the flow is a single processing task; when the Metadata
        API could not be queried, the tasks already in OpenMetadata are kept so a
        transient failure does not collapse the DAG.
        """
        source_url = self.get_source_url(pipeline_details)
        processing_task_name = pipeline_details.name
        is_extract_refresh = pipeline_details.kind == TableauPipelineKind.EXTRACT_REFRESH
        single_task = Task(
            name=processing_task_name,
            displayName="Refresh extract" if is_extract_refresh else pipeline_details.display_name,
            description=Markdown(pipeline_details.description) if pipeline_details.description else None,
            sourceUrl=source_url,
            taskType=TASK_TYPE_EXTRACT_REFRESH if is_extract_refresh else TASK_TYPE_PROCESSING,
        )
        if is_extract_refresh:
            return [single_task]

        flow_lineage = self._get_flow_lineage(pipeline_details.id)
        if flow_lineage is None:
            if self._current_flow_lineage_failed:
                return self._existing_tasks(pipeline_details) or [single_task]
            return [single_task]
        if not (flow_lineage.upstream_tables or flow_lineage.upstream_datasources or flow_lineage.output_steps):
            return [single_task]

        used_names: set[str] = {processing_task_name}
        inputs: list[tuple[str | None, str | None, Markdown | None]] = [
            (table.id or table.name, table.name or table.full_name, self._input_task_description(table))
            for table in flow_lineage.upstream_tables
        ] + [
            (datasource.id or datasource.name, datasource.name, self._datasource_task_description(datasource))
            for datasource in flow_lineage.upstream_datasources
        ]
        input_tasks: list[Task] = []
        for base, display_name, input_description in inputs:
            task_name = self._task_name(INPUT_TASK_PREFIX, base, used_names)
            if task_name is None:
                continue
            input_tasks.append(
                Task(
                    name=task_name,
                    displayName=display_name,
                    description=input_description,
                    taskType=TASK_TYPE_INPUT,
                    sourceUrl=source_url,
                    downstreamTasks=[processing_task_name],
                )
            )

        output_tasks: list[Task] = []
        for output in flow_lineage.output_steps:
            task_name = self._task_name(OUTPUT_TASK_PREFIX, output.id or output.name, used_names)
            if task_name is None:
                continue
            output_tasks.append(
                Task(
                    name=task_name,
                    displayName=output.name,
                    taskType=TASK_TYPE_OUTPUT,
                    sourceUrl=source_url,
                )
            )

        processing_task = single_task.model_copy(
            update={"downstreamTasks": [task.name for task in output_tasks] or None}
        )
        return [*input_tasks, processing_task, *output_tasks]

    def _existing_tasks(self, pipeline_details: TableauPipelineDetails) -> list[Task] | None:
        pipeline_fqn = self._pipeline_fqn(pipeline_details)
        if not pipeline_fqn:
            return None
        pipeline = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn, fields=["tasks"])
        return pipeline.tasks if pipeline and pipeline.tasks else None

    @staticmethod
    def _sanitize_task_name(raw: str) -> str:
        """Collapse anything outside [A-Za-z0-9_-] to `_` so Tableau's opaque
        base64-ish node ids survive as valid Task names."""
        return TASK_NAME_SANITIZER.sub("_", raw).strip("_")

    @classmethod
    def _task_name(cls, prefix: str, base: str | None, used: set[str]) -> str | None:
        """A unique, sanitized task name, recorded in `used`; Task names must be
        unique inside a pipeline, so collisions get a numeric suffix."""
        if not base:
            return None
        candidate = f"{prefix}{cls._sanitize_task_name(base)}"
        name = candidate
        suffix = 2
        while name in used:
            name = f"{candidate}_{suffix}"
            suffix += 1
        used.add(name)
        return name

    @staticmethod
    def _input_task_description(upstream: TableauLineageTable) -> Markdown | None:
        parts = []
        if upstream.full_name or upstream.name:
            parts.append(f"**Source table:** `{upstream.full_name or upstream.name}`")
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

        The pipeline is a node in the graph. A flow's inputs (tables, published
        data sources) point at it, and it points at its outputs (tables it
        writes, published data sources it produces) and at the flows that
        consume it; an extract refresh points at the data models it refreshes.
        Each reference has its own error boundary so one bad reference does not
        drop the rest."""
        if pipeline_details.kind == TableauPipelineKind.EXTRACT_REFRESH:
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

        pipeline_ref = self._get_pipeline_ref(pipeline_details)
        if pipeline_ref is None:
            return

        for table in flow_lineage.upstream_tables:
            yield from self._edges_or_error(
                f"upstream table {table.full_name or table.name}",
                partial(self._table_edges, table, pipeline_ref, upstream=True),
            )
        for datasource in flow_lineage.upstream_datasources:
            yield from self._edges_or_error(
                f"upstream data source {datasource.name or datasource.id}",
                partial(self._datasource_edges, datasource.id, datasource.name, pipeline_ref, upstream=True),
            )
        for table in flow_lineage.downstream_tables:
            yield from self._edges_or_error(
                f"downstream table {table.full_name or table.name}",
                partial(self._table_edges, table, pipeline_ref, upstream=False),
            )
        for datasource in flow_lineage.downstream_datasources:
            yield from self._edges_or_error(
                f"downstream data source {datasource.name or datasource.id}",
                partial(self._datasource_edges, datasource.id, datasource.name, pipeline_ref, upstream=False),
            )
        for flow in flow_lineage.next_downstream_flows:
            yield from self._edges_or_error(
                f"downstream flow {flow.name or flow.luid}",
                partial(self._downstream_flow_edges, flow, pipeline_ref),
            )

    def yield_pipeline_bulk_lineage_details(self) -> Iterable[Either[AddLineageRequest]]:
        """Flow -> flow edges whose downstream flow was ingested after its
        upstream one: every flow exists once the pipelines are processed."""
        pending, self._pending_flow_edges = self._pending_flow_edges, []
        for pipeline_ref, flow_luid in pending:
            yield from self._edges_or_error(
                f"downstream flow {flow_luid}",
                partial(self._resolved_flow_edges, pipeline_ref, flow_luid),
            )

    def _get_pipeline_ref(self, pipeline_details: TableauPipelineDetails) -> EntityReference | None:
        pipeline_fqn = self._pipeline_fqn(pipeline_details)
        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn) if pipeline_fqn else None
        if pipeline_entity is None:
            logger.warning("Pipeline entity not found for %s, skipping lineage.", pipeline_details.name)
            return None
        return EntityReference(id=pipeline_entity.id, type=ENTITY_TYPE_PIPELINE)

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
    def _lineage_request(from_ref: EntityReference, to_ref: EntityReference) -> AddLineageRequest:
        """The pipeline is an endpoint of every edge this connector emits, so the
        edge does not name a pipeline in its details."""
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=from_ref,
                toEntity=to_ref,
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage),
            )
        )

    def _edge(self, other: EntityReference, pipeline_ref: EntityReference, upstream: bool) -> AddLineageRequest:
        return self._lineage_request(other, pipeline_ref) if upstream else self._lineage_request(pipeline_ref, other)

    def _table_edges(
        self, table: TableauLineageTable, pipeline_ref: EntityReference, upstream: bool
    ) -> list[AddLineageRequest]:
        if upstream:
            resolved = self._resolve_upstream_tables(table)
        else:
            output = self._resolve_table_entity(table)
            resolved = [output] if output is not None else []
        if not resolved:
            logger.debug("No matching OpenMetadata Table for %s", table.full_name or table.name)
        return [
            self._edge(EntityReference(id=entity.id, type=ENTITY_TYPE_TABLE), pipeline_ref, upstream)
            for entity in resolved
        ]

    def _datasource_edges(
        self, datasource_id: str | None, label: str | None, pipeline_ref: EntityReference, upstream: bool
    ) -> list[AddLineageRequest]:
        return [
            self._edge(EntityReference(id=datamodel.id, type=ENTITY_TYPE_DASHBOARD_DATA_MODEL), pipeline_ref, upstream)
            for datamodel in self._lookup_datamodels(datasource_id, label)
        ]

    def _downstream_flow_edges(self, flow: TableauLinkedFlow, pipeline_ref: EntityReference) -> list[AddLineageRequest]:
        """Pipeline -> pipeline edge to a flow of the same service, deferred to
        the bulk lineage step when that flow has not been ingested yet."""
        if not flow.luid:
            return []
        edges = self._resolved_flow_edges(pipeline_ref, flow.luid)
        if not edges:
            self._pending_flow_edges.append((pipeline_ref, flow.luid))
        return edges

    def _resolved_flow_edges(self, pipeline_ref: EntityReference, flow_luid: str) -> list[AddLineageRequest]:
        downstream_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=flow_luid,
        )
        downstream = self.metadata.get_by_name(entity=Pipeline, fqn=downstream_fqn) if downstream_fqn else None
        if downstream is None:
            logger.debug("Downstream flow %s not found in OpenMetadata", flow_luid)
            return []
        return [self._lineage_request(pipeline_ref, EntityReference(id=downstream.id, type=ENTITY_TYPE_PIPELINE))]

    def _extract_refresh_lineage(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[AddLineageRequest]]:
        """An extract refresh points at the data model(s) it refreshes: the
        published data source, or each embedded extract of the workbook."""
        if pipeline_details.target_type is None:
            return
        try:
            datasource_ids = self.connection.get_extract_datasource_ids(
                pipeline_details.target_type, pipeline_details.id
            )
        except TableauMetadataApiError as exc:
            self._log_metadata_api_failure(exc)
            return
        if not datasource_ids:
            return
        pipeline_ref = self._get_pipeline_ref(pipeline_details)
        if pipeline_ref is None:
            return
        for datasource_id in datasource_ids:
            yield from self._edges_or_error(
                f"refreshed data source {datasource_id}",
                partial(self._datasource_edges, datasource_id, None, pipeline_ref, upstream=False),
            )

    def _lookup_datamodels(self, datasource_id: str | None, label: str | None) -> list[DashboardDataModel]:
        """The DashboardDataModels the dashboard Tableau connector created for a
        Tableau data source, in every dashboard service that ingests the site.

        That connector names data models after the Metadata API `id` (not the
        REST `luid`), and a data model's FQN is `{service}.model.{name}`, so an
        FQN search for `*.{id}` finds them without knowing the service."""
        if not datasource_id:
            return []
        try:
            entities = self.metadata.es_search_from_fqn(
                entity_type=DashboardDataModel,
                fqn_search_string=f"*.{datasource_id}",
            )
        except Exception as exc:
            logger.debug("DashboardDataModel lookup failed for %s: %s", datasource_id, exc)
            return []
        if not entities:
            logger.debug(
                "Data model for Tableau data source %s not found — ensure the dashboard Tableau connector has run.",
                label or datasource_id,
            )
            return []
        return entities

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
                resolved.setdefault(model_str(table.id), table)
        return list(resolved.values())

    def _resolve_tables_from_sql(self, query: str) -> list[Table]:
        """Parse custom SQL and resolve each source table to an OM Table.

        Uses ANSI dialect — Tableau doesn't tell us which DB dialect the custom
        SQL targets, and the parser falls back cleanly for dialect mismatches.
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

    def _resolve_table_entity(self, table: TableauLineageTable) -> Table | None:
        """Resolve a Tableau table to an OpenMetadata Table entity.

        The configured dbServiceNames are authoritative: when set, only they are
        tried. Without them, a search across every database service is accepted
        only when it finds exactly one table — a same-named table elsewhere must
        not receive the edge.
        """
        if not table.name:
            return None

        database_schema_table = fqn.split_table_name(table.name)
        database_name = (
            table.database.name if table.database and table.database.name else database_schema_table.get("database")
        )
        schema_name = table.schema_ or database_schema_table.get("database_schema")
        table_name = database_schema_table.get("table") or table.name

        db_service_names = self.get_db_service_names()
        for db_service_name in db_service_names:
            entity_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=db_service_name,
                database_name=database_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            entity = self.metadata.get_by_name(entity=Table, fqn=entity_fqn) if entity_fqn else None
            if entity:
                return entity
        if db_service_names:
            return None

        matches = self.metadata.search_in_any_service(
            entity_type=Table,
            fqn_search_string=build_es_fqn_search_string(
                database_name=database_name or "",
                schema_name=schema_name or "",
                service_name="*",
                table_name=table_name,
            ),
            fetch_multiple_entities=True,
        )
        if isinstance(matches, list) and len(matches) == 1:
            return matches[0]
        if matches:
            logger.debug("Tableau table %s matches several OpenMetadata tables; skipping it", table.full_name)
        return None

    def yield_pipeline_status(self, pipeline_details: TableauPipelineDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        try:
            runs = (
                self.connection.get_extract_refresh_runs(pipeline_details.id)
                if pipeline_details.kind == TableauPipelineKind.EXTRACT_REFRESH
                else self.connection.get_flow_runs(pipeline_details.id)
            )
            if not runs:
                return
            pipeline_fqn = self._pipeline_fqn(pipeline_details)
            if not pipeline_fqn:
                return
            task_names = [task.name for task in self._get_tasks(pipeline_details)]
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
                    error=f"Error extracting status for {pipeline_details.name} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    @staticmethod
    def _get_status(run: TableauRunItem) -> StatusType:
        if run.status:
            return RUN_STATUS_MAP.get(run.status.lower(), StatusType.Pending)
        return StatusType.Pending

    @staticmethod
    def _to_timestamp(dt: datetime | None) -> Timestamp | None:
        return Timestamp(datetime_to_timestamp(dt, milliseconds=True)) if dt else None

    def get_source_url(self, pipeline_details: TableauPipelineDetails) -> SourceUrl | None:
        if pipeline_details.webpage_url:
            return SourceUrl(pipeline_details.webpage_url)
        section = f"{pipeline_details.target_type}s" if pipeline_details.target_type else "flows"
        return SourceUrl(f"{clean_uri(str(self.service_connection.hostPort))}/#/{section}")

    def close(self) -> None:
        self._evict_if_new_flow("")
        self._pending_flow_edges = []
        super().close()
