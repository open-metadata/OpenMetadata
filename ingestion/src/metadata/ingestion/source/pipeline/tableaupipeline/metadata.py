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
from collections.abc import Callable, Iterable, Iterator
from datetime import datetime
from functools import partial
from itertools import product

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
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
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
from metadata.ingestion.lineage.sql_lineage import get_table_fqn_from_query_name
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
from metadata.utils.helpers import clean_uri, get_database_name_for_lineage
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
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

# Lookups are keyed on the configured dbServiceNames, so this only has to hold
# more entries than a realistic lineageInformation lists.
DATABASE_SERVICE_CACHE_SIZE = 64

# A Tableau table's (database, schema, table) names, as Tableau reports them.
TableNameParts = tuple[str | None, str | None, str]
# The OpenMetadata entities a Tableau asset resolves to.
AssetResolver = Callable[[], list[EntityReference]]

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
        self._database_services: LRUCache[DatabaseService | None] = LRUCache(DATABASE_SERVICE_CACHE_SIZE)

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

        A flow's edges run from the assets it reads (tables, published data
        sources) to the assets it writes, with the flow in
        `lineageDetails.pipeline` as other pipeline connectors draw them, so
        its inputs and outputs stay adjacent and the platform's pipeline view
        mode applies. A flow is also linked to the flows that consume it; an
        extract refresh points at the data models it refreshes. Each reference
        has its own error boundary so one bad reference does not drop the rest."""
        if pipeline_details.kind == TableauPipelineKind.EXTRACT_REFRESH:
            yield from self._extract_refresh_lineage(pipeline_details)
            return
        flow_lineage = self._get_flow_lineage(pipeline_details.id)
        if flow_lineage is None:
            return
        pairs = self._flow_asset_pairs(pipeline_details, flow_lineage)
        if not (pairs or flow_lineage.next_downstream_flows):
            return

        pipeline_ref = self._get_pipeline_ref(pipeline_details)
        if pipeline_ref is None:
            return

        yield from self._flow_asset_edges(flow_lineage, pairs, pipeline_ref)
        for flow in flow_lineage.next_downstream_flows:
            yield from self._edges_or_error(
                f"downstream flow {flow.name or flow.luid}",
                partial(self._downstream_flow_edges, flow, pipeline_ref),
            )

    def _flow_asset_pairs(
        self, pipeline_details: TableauPipelineDetails, flow_lineage: TableauFlowLineage
    ) -> list[tuple[str, str]]:
        """The (input, output) pairs of a flow, as Metadata API ids.

        A single input feeds every output, and every input feeds a single
        output. With several of each a flow can run separate branches, so the
        pairs come from the lineage of the fields its output steps write; when
        Tableau cannot say, no pair is drawn rather than every input being tied
        to every output."""
        inputs = self._asset_ids([*flow_lineage.upstream_tables, *flow_lineage.upstream_datasources])
        outputs = self._asset_ids([*flow_lineage.downstream_tables, *flow_lineage.downstream_datasources])
        if not inputs or not outputs:
            return []
        if len(inputs) == 1 or len(outputs) == 1:
            return [(source, target) for source in inputs for target in outputs]
        fed = self._field_level_pairs(pipeline_details)
        if fed is None:
            return []
        pairs = [(source, target) for source in inputs for target in outputs if (source, target) in fed]
        if not pairs:
            logger.warning(
                "Tableau did not say which inputs of flow %s feed which of its outputs, so no table or data "
                "source lineage is drawn for it.",
                self.get_pipeline_name(pipeline_details),
            )
        return pairs

    @staticmethod
    def _asset_ids(assets: Iterable[TableauLineageTable | TableauPublishedDatasource]) -> list[str]:
        return list(dict.fromkeys(asset.id for asset in assets if asset.id))

    def _field_level_pairs(self, pipeline_details: TableauPipelineDetails) -> set[tuple[str, str]] | None:
        """(input, output) pairs read from the fields a flow's output steps
        write, or None when the Metadata API could not be queried."""
        try:
            fields = self.connection.get_flow_output_fields(pipeline_details.id)
        except TableauMetadataApiError as exc:
            self._log_metadata_api_failure(exc)
            return None
        return {(source, target) for field in fields for source in field.input_ids for target in field.output_ids}

    def _flow_asset_edges(
        self, flow_lineage: TableauFlowLineage, pairs: list[tuple[str, str]], pipeline_ref: EntityReference
    ) -> Iterable[Either[AddLineageRequest]]:
        """An edge from every entity an input resolves to, to every entity its
        paired output resolves to, naming the flow as the pipeline between them."""
        if not pairs:
            return
        sources, source_errors = self._resolve_assets(self._flow_inputs(flow_lineage), {s for s, _ in pairs})
        targets, target_errors = self._resolve_assets(self._flow_outputs(flow_lineage), {t for _, t in pairs})
        yield from source_errors
        yield from target_errors
        drawn: set[tuple[str, str]] = set()
        for source_id, target_id in pairs:
            for source, target in product(sources.get(source_id, []), targets.get(target_id, [])):
                edge = (model_str(source.id), model_str(target.id))
                # A flow that updates a table it also reads must not draw it onto itself.
                if edge[0] != edge[1] and edge not in drawn:
                    drawn.add(edge)
                    yield Either(left=None, right=self._lineage_request(source, target, pipeline=pipeline_ref))

    def _flow_inputs(self, flow_lineage: TableauFlowLineage) -> Iterator[tuple[str | None, str, AssetResolver]]:
        for table in flow_lineage.upstream_tables:
            yield table.id, f"upstream table {table.full_name or table.name}", partial(self._upstream_table_refs, table)
        for datasource in flow_lineage.upstream_datasources:
            yield (
                datasource.id,
                f"upstream data source {datasource.name or datasource.id}",
                partial(self._datamodel_refs, datasource.id, datasource.name),
            )

    def _flow_outputs(self, flow_lineage: TableauFlowLineage) -> Iterator[tuple[str | None, str, AssetResolver]]:
        for table in flow_lineage.downstream_tables:
            yield (
                table.id,
                f"downstream table {table.full_name or table.name}",
                partial(self._downstream_table_refs, table),
            )
        for datasource in flow_lineage.downstream_datasources:
            yield (
                datasource.id,
                f"downstream data source {datasource.name or datasource.id}",
                partial(self._datamodel_refs, datasource.id, datasource.name),
            )

    @staticmethod
    def _resolve_assets(
        assets: Iterable[tuple[str | None, str, AssetResolver]], wanted: set[str]
    ) -> tuple[dict[str, list[EntityReference]], list[Either[AddLineageRequest]]]:
        """The OpenMetadata entities each wanted Tableau asset resolves to, and
        an error per asset that could not be resolved."""
        resolved: dict[str, list[EntityReference]] = {}
        errors: list[Either[AddLineageRequest]] = []
        for asset_id, label, resolve in assets:
            if asset_id is None or asset_id not in wanted or asset_id in resolved:
                continue
            try:
                resolved[asset_id] = resolve()
            except Exception as err:
                resolved[asset_id] = []
                errors.append(
                    Either(
                        left=StackTraceError(
                            name="Lineage",
                            error=f"Error building lineage for {label}: {err}",
                            stackTrace=traceback.format_exc(),
                        ),
                        right=None,
                    )
                )
            else:
                if not resolved[asset_id]:
                    logger.debug("No OpenMetadata entity found for Tableau %s", label)
        return resolved, errors

    def _upstream_table_refs(self, table: TableauLineageTable) -> list[EntityReference]:
        return [
            EntityReference(id=entity.id, type=ENTITY_TYPE_TABLE) for entity in self._resolve_upstream_tables(table)
        ]

    def _downstream_table_refs(self, table: TableauLineageTable) -> list[EntityReference]:
        entity = self._resolve_table_entity(table)
        return [EntityReference(id=entity.id, type=ENTITY_TYPE_TABLE)] if entity is not None else []

    def _datamodel_refs(self, datasource_id: str | None, label: str | None) -> list[EntityReference]:
        return [
            EntityReference(id=datamodel.id, type=ENTITY_TYPE_DASHBOARD_DATA_MODEL)
            for datamodel in self._lookup_datamodels(datasource_id, label)
        ]

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
    def _lineage_request(
        from_ref: EntityReference, to_ref: EntityReference, pipeline: EntityReference | None = None
    ) -> AddLineageRequest:
        """`pipeline` names the flow that moves data between two assets; an edge
        that has a pipeline at one of its ends names none."""
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=from_ref,
                toEntity=to_ref,
                lineageDetails=LineageDetails(pipeline=pipeline, source=LineageSource.PipelineLineage),
            )
        )

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
        published data source, or each embedded extract of the workbook.

        Unlike a flow it reads no asset of its own. The table -> data model
        edges it keeps fresh belong to the dashboard Tableau connector, and
        writing them from here would replace their column lineage whenever
        overrideLineage is on, so the refresh is the upstream end of its edges."""
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
                partial(self._refresh_edges, datasource_id, pipeline_ref),
            )

    def _refresh_edges(self, datasource_id: str, pipeline_ref: EntityReference) -> list[AddLineageRequest]:
        return [
            self._lineage_request(pipeline_ref, datamodel) for datamodel in self._datamodel_refs(datasource_id, None)
        ]

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

        Tableau names a table as its source reports it, which is not always how
        OpenMetadata files it: a single-database service (MySQL, Oracle, Hive,
        ...) has one synthetic database, and the MySQL database Tableau reports
        as the table's database is its schema there. So the names Tableau
        reports are tried first, then those in the table's full name, as the
        dashboard Tableau connector does.

        The configured dbServiceNames are authoritative: when set, only they are
        tried, in order, each with its own database naming. Without them, every
        database service is searched. Either way, a search that finds several
        tables is not a match — a same-named table elsewhere must not receive
        the edge.
        """
        if not table.name:
            return None
        candidates = self._table_name_candidates(table, table.name)
        db_service_names = self.get_db_service_names()
        if db_service_names:
            return self._table_in_services(db_service_names, candidates)
        return self._unique_table_match(candidates)

    @staticmethod
    def _table_name_candidates(table: TableauLineageTable, name: str) -> list[TableNameParts]:
        """Tableau's database, schema and table names, then the same parsed from
        the table's full name: `[db].[schema].[table]`, `[schema].[table]` or
        `schema.table`."""
        split = fqn.split_table_name(name)
        database = table.database.name if table.database and table.database.name else split.get("database")
        candidates: list[TableNameParts] = [
            (database, table.schema_ or split.get("database_schema"), split.get("table") or name)
        ]
        if table.full_name:
            full_database, full_schema, full_table = get_table_fqn_from_query_name(
                table.full_name.replace("[", "").replace("]", "")
            )
            if full_table and (full_database, full_schema, full_table) not in candidates:
                candidates.append((full_database, full_schema, full_table))
        return candidates

    def _table_in_services(self, service_names: list[str], candidates: list[TableNameParts]) -> Table | None:
        """The first table a configured service holds, trying Tableau's own names
        in every service before the full name's."""
        for parts in candidates:
            for service_name in service_names:
                entity = self._table_in_service(service_name, parts)
                if entity is not None:
                    return entity
        return None

    def _table_in_service(self, service_name: str, parts: TableNameParts) -> Table | None:
        """The table a configured service holds under these names. A name that
        lacks its database or schema is a search, and only a search that finds
        one table resolves it: the first of several is a guess."""
        database_name, schema_name, table_name = parts
        service = self._database_service(service_name)
        if service is not None:
            if self._is_single_database(service):
                # Tableau reports a MySQL table with its database and no schema, and
                # OpenMetadata files that database as the table's schema.
                schema_name = schema_name or database_name
            database_name = self._service_database_name(service, database_name)
        matches = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=build_es_fqn_search_string(
                database_name=database_name,
                schema_name=schema_name,
                service_name=service_name,
                table_name=table_name,
            ),
        )
        if matches:
            if len(matches) == 1:
                return matches[0]
            logger.debug("Tableau table %s matches several tables of %s; skipping it", table_name, service_name)
            return None
        if not (database_name and schema_name):
            return None
        # Search lags a create by the index refresh; a full name can be read directly.
        table_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
            skip_es_search=True,
        )
        return self.metadata.get_by_name(entity=Table, fqn=table_fqn) if table_fqn else None

    def _database_service(self, service_name: str) -> DatabaseService | None:
        if service_name not in self._database_services:
            service = self.metadata.get_by_name(entity=DatabaseService, fqn=service_name)
            if service is None:
                logger.warning("Database service %s from dbServiceNames is not in OpenMetadata", service_name)
            self._database_services.put(service_name, service)
        return self._database_services.get(service_name)

    @staticmethod
    def _service_database_name(service: DatabaseService, tableau_database: str | None) -> str | None:
        """The OpenMetadata database a service files Tableau's database under:
        a single-database service's configured or `default` one. BigQuery's is
        left to the search, as the dashboard Tableau connector has done since
        #12570 fixed its BigQuery lineage."""
        config = service.connection.config if service.connection else None
        if isinstance(config, BigQueryConnection):
            tableau_database = None
        return get_database_name_for_lineage(service, tableau_database)

    @staticmethod
    def _is_single_database(service: DatabaseService) -> bool:
        """Whether OpenMetadata files the service under one database, by the test
        get_database_name_for_lineage applies."""
        return service.connection is not None and not hasattr(service.connection.config, "supportsDatabase")

    def _unique_table_match(self, candidates: list[TableNameParts]) -> Table | None:
        """The table the first matching names find across every database
        service, when they find exactly one; names that find several resolve to
        none rather than falling back to looser ones."""
        for database_name, schema_name, table_name in candidates:
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
            if matches:
                if isinstance(matches, list) and len(matches) == 1:
                    return matches[0]
                logger.debug("Tableau table %s matches several OpenMetadata tables; skipping it", table_name)
                return None
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
        self._database_services.clear()
        super().close()
