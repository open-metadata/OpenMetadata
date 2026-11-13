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
"""Sigma source module"""

import re
import traceback
from collections.abc import Iterable
from datetime import datetime
from functools import cached_property

import sqlparse
from cachetools import LRUCache

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableLookup, UnsupportedTableReferenceError
from metadata.entity_resolution.table_search import get_table_binding_resolution
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityExtension,
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.sigma.models import (
    DataModel,
    Elements,
    NodeDetails,
    Workbook,
    WorkbookDetails,
    WorkbookLineageEntry,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import (
    get_database_name_for_lineage,
    get_standard_chart_type,
    normalize_column_name,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

# Stable: tags already applied keep this name (ADR:2026-11-07-sigma-badges-are-tags-in-the-sigmabadge-classification)
SIGMA_BADGE_CLASSIFICATION = "SigmaBadge"


# Distinct table references resolved per run; past it a reference is searched again
MAX_RESOLVED_TABLES = 1_000

# A SELECT needs an output table for the parser to expose its column mappings.
COLUMN_LINEAGE_TARGET = "sigma_query_output"

# Sigma connection types, lower-cased, as the spec names them for the warehouses OpenMetadata parses
SIGMA_CONNECTION_DIALECTS = {
    "bigquery": Dialect.BIGQUERY,
    "databricks": Dialect.DATABRICKS,
    "mysql": Dialect.MYSQL,
    "postgres": Dialect.POSTGRES,
    "redshift": Dialect.REDSHIFT,
    "snowflake": Dialect.SNOWFLAKE,
    "azuresql": Dialect.TSQL,
    "sqlserver": Dialect.TSQL,
}


class _DataModelLineageMarker:
    """Listed after the last Sigma Data Model, so their lineage is drawn once all of them are written"""


_DATA_MODEL_LINEAGE = _DataModelLineageMarker()


def _access_details(moment: datetime | None) -> AccessDetails | None:
    return AccessDetails(timestamp=Timestamp(datetime_to_timestamp(moment, milliseconds=True))) if moment else None


_BRACKET_REFERENCE = re.compile(r"\[([^\[\]]+)\]")
_STRING_LITERAL = re.compile(r'"[^"]*"')
# A formula that only names the source column it is read from, as [ORDERS/Amount]
_SOURCE_REFERENCE = re.compile(r"\s*\[[^\[\]/]+/[^\[\]]+\]\s*")


def _same_element_references(formula: str) -> list[str] | None:
    """
    The names a formula reads as bare [Name] references, which name columns of its own element (or controls).
    None when it also reads another element or source ([Name/Column]) or holds an escape: Sigma does not
    document how those resolve.
    """
    if "\\" in formula:
        return None
    references = _BRACKET_REFERENCE.findall(_STRING_LITERAL.sub("", formula))
    return None if any("/" in reference for reference in references) else references


def _columns_read(label: str, labels: list[str], formulas: dict[str, str]) -> list[str]:
    """The other columns of its own element a column's formula reads; empty for a column not computed from them"""
    references = _same_element_references(formulas.get(label, "")) or []
    return [reference for reference in references if reference in labels]


def _inherit_formula_sources(sources: dict[str, list[tuple[str, str]]], columns_read: dict[str, list[str]]) -> None:
    """
    Give each column computed from other columns of its own element the sources of those columns, directly or
    through other computed columns (ADR:2026-11-13-sigma-column-formulas-go-in-the-description-and-trace-only-same-element-columns).
    Sources only grow, so a cycle of references ends.
    """
    changed = True
    while changed:
        changed = False
        for label, read in columns_read.items():
            inherited = list(
                dict.fromkeys([*sources.get(label, []), *(s for column in read for s in sources.get(column, []))])
            )
            if len(inherited) > len(sources.get(label, [])):
                sources[label] = inherited
                changed = True


# Dashboard custom property set from the workbook (ADR:2026-11-02-run-changing-dashboard-custom-properties-are-patched-after-the-dashboard).
# The spec types it number(double), so it is not registered as an integer
# (ADR:2026-11-07-sigma-latest-version-is-a-number-dashboard-custom-property).
LATEST_VERSION = "latestVersion"


class SigmaSource(DashboardServiceSource):
    """
    Sigma Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SigmaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SigmaConnection):
            raise InvalidSourceException(f"Expected SigmaConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.data_models: list[Elements] = []
        # The lineage stage runs once per dbServicePrefixes entry, and each run needs every prefix's match
        self._resolved_tables: LRUCache[tuple[str | None, str, str], tuple[Table, str] | None] = LRUCache(
            maxsize=MAX_RESOLVED_TABLES
        )
        # The Sigma Data Models ingested this run, and the url id of every listed one: lineage rows name both ids
        self._lineage_data_models: list[DataModel] = []
        self._data_model_url_ids: dict[str, str] = {}

    def get_dashboards_list(self) -> list[Workbook] | None:
        """
        get list of dashboard
        """
        if not self.source_config.includeOwners:
            logger.debug("Skipping owner information as includeOwners is False")
        return self.client.get_dashboards()

    def get_dashboard_name(self, dashboard: Workbook) -> str | None:
        """
        get dashboard name
        """
        return dashboard.name

    def get_project_name(self, dashboard_details: WorkbookDetails) -> str | None:
        """
        The workspace: Sigma's path starts with it and continues with the folders
        (ADR:2026-11-07-a-sigma-dashboard-project-is-the-workbook-workspace)
        """
        return dashboard_details.path.split("/")[0] if dashboard_details.path else None

    def get_dashboard_details(self, dashboard: Workbook) -> WorkbookDetails | None:
        """
        get dashboard details
        """
        dashboard_details = self.client.get_dashboard_detail(dashboard.workbookId)
        if dashboard_details and self.source_config.includeTags:
            dashboard_details.badge = self.client.get_badge(dashboard.workbookId)
        if dashboard_details:
            dashboard_details.elements = self.client.get_chart_details(dashboard.workbookId) or []
        if dashboard_details and self.source_config.includeDataModels:
            dashboard_details.formulas = self.client.get_column_formulas(f"/workbooks/{dashboard.workbookId}/columns")
        return dashboard_details

    def yield_tags(self, dashboard_details: WorkbookDetails) -> Iterable[Either[OMetaTagAndClassification]]:
        """The workbook's certification badge (Endorsed, Warning, Deprecated) as a tag"""
        if dashboard_details and dashboard_details.badge:
            yield from self.yield_tag_definitions(
                tags=[dashboard_details.badge],
                classification_name=SIGMA_BADGE_CLASSIFICATION,
                classification_description="Certification badges of Sigma documents",
                tag_description="Sigma certification badge",
            )

    def yield_dashboard(self, dashboard_details: WorkbookDetails) -> Iterable[Either[CreateDashboardRequest]]:
        """
        yield Dashboard Entity
        """
        if not dashboard_details:
            logger.warning(f"Skipping dashboard - details are None (API error)")  # noqa: F541
            return

        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.workbookId)),
                displayName=dashboard_details.name,
                description=(Markdown(dashboard_details.description) if dashboard_details.description else None),
                charts=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=Chart,
                            service_name=self.context.get().dashboard_service,
                            chart_name=chart,
                        )
                    )
                    for chart in self.context.get().charts or []
                ],
                dataModels=[
                    FullyQualifiedEntityName(
                        fqn.build(  # pyright: ignore[reportArgumentType]  # always a str for DashboardDataModel
                            self.metadata,
                            entity_type=DashboardDataModel,
                            service_name=self.context.get().dashboard_service,  # pyright: ignore[reportAttributeAccessIssue]
                            data_model_name=data_model,
                        )
                    )
                    for data_model in self.context.get().dataModels or []  # pyright: ignore[reportAttributeAccessIssue]
                ]
                if self.source_config.includeDataModels
                else None,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(dashboard_details.url),
                tags=self.get_tag_labels(
                    entity_fqn=fqn._build(vars(self.context.get())["dashboard_service"], dashboard_details.workbookId),
                    tags=[dashboard_details.badge] if dashboard_details.badge else None,
                    classification_name=SIGMA_BADGE_CLASSIFICATION,
                ),
                project=self.get_project_name(dashboard_details=dashboard_details),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
                lifeCycle=LifeCycle(
                    created=_access_details(dashboard_details.createdAt),
                    updated=_access_details(dashboard_details.updatedAt),
                ),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error to yield dashboard for {dashboard_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(self, dashboard_details: WorkbookDetails) -> Iterable[Either[CreateChartRequest]]:
        """
        yield dashboard charts
        """
        if not dashboard_details:
            logger.warning(f"Skipping charts - dashboard details are None (API error)")  # noqa: F541
            return

        for chart in dashboard_details.elements:
            if not chart.is_data_element:
                continue
            try:
                display_name = chart.name or f"Element {chart.elementId}"
                if filter_by_chart(self.source_config.chartFilterPattern, display_name):
                    self.status.filter(display_name, "Chart Pattern not allowed")
                    continue
                chart_request = CreateChartRequest(
                    name=EntityName(str(chart.elementId)),
                    displayName=display_name,
                    chartType=get_standard_chart_type(chart.vizualizationType or ""),
                    service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                    sourceUrl=SourceUrl(f"{dashboard_details.url}?:nodeId={chart.elementId}"),
                )
                yield Either(right=chart_request)
                self.register_record_chart(chart_request=chart_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=(
                            f"Error to yield dashboard chart for : {chart.elementId} and {dashboard_details}: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_datamodel(self, datamodel_id: str):
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.get().dashboard_service,
            data_model_name=datamodel_id,
        )
        if datamodel_fqn:
            return self.metadata.get_by_name(
                entity=DashboardDataModel,
                fqn=datamodel_fqn,
            )
        return None

    @cached_property
    def _db_services(self) -> dict[str, DatabaseService | None]:
        """The database service of each dbServicePrefixes entry, read once per run"""
        return {
            prefix: self.metadata.get_by_name(entity=DatabaseService, fqn=prefix.split(".")[0])
            for prefix in self.get_db_service_prefixes()
        }

    def _get_table_entity(
        self, database: str | None, schema: str | None, table: str | None, db_service_prefix: str | None
    ) -> Table | None:
        """
        The one table the reference names across the dbServicePrefixes, returned on the call for the
        prefix it was found under. Lineage must not guess, so a reference matching several tables, or
        with no prefix configured, resolves to none. A reference is resolved once per run, as every
        prefix's call needs the same answer.
        """
        resolved = self._resolved_table(database, schema, table)
        return resolved[0] if resolved and resolved[1] == db_service_prefix else None

    def _resolved_table(self, database: str | None, schema: str | None, table: str | None) -> tuple[Table, str] | None:
        if not (schema and table):
            return None
        key = (database, schema, table)
        if key not in self._resolved_tables:
            self._resolved_tables[key] = self._resolve_table(database, schema, table)
        return self._resolved_tables[key]

    def _resolve_table(self, database: str | None, schema: str, table: str) -> tuple[Table, str] | None:
        """The one table the reference names across the dbServicePrefixes, with the prefix it was found under"""
        matches: dict[str, tuple[Table, str]] = {}
        for prefix in self.get_db_service_prefixes():
            service, prefix_database, prefix_schema, prefix_table = self.parse_db_service_prefix(prefix)
            if any(
                expected and actual and expected.lower() != actual.lower()
                for expected, actual in ((prefix_database, database), (prefix_schema, schema), (prefix_table, table))
            ):
                continue
            service_entity = self._db_services[prefix]
            searched_database = (
                get_database_name_for_lineage(service_entity, database) if database and service_entity else database
            )
            try:
                found_tables = get_table_binding_resolution(self.metadata, service).resolve(
                    TableReference(searched_database or prefix_database, schema, table),
                    service_name=service,
                    lookup=TableLookup.SEARCH,
                )
            except UnsupportedTableReferenceError as exc:
                logger.debug("Skipping unsupported Sigma table reference %s in %s: %s", table, service, exc)
                continue
            for found in found_tables:
                matches.setdefault(model_str(found.id), (found, prefix))
        if len(matches) != 1:
            logger.debug("Skipping Sigma table reference %s: it matches %d tables", table, len(matches))
            return None
        return next(iter(matches.values()))

    def _get_table_entity_from_node(
        self,
        node: NodeDetails,
        db_service_prefix: str | None = None,
    ) -> Table | None:
        """
        The table a /files node names, read from its display path. When that finds no single table, the table's
        connection path is read as [database, schema, table]
        (ADR:2026-11-12-sigma-connection-path-is-read-only-when-the-display-path-finds-no-table).
        """
        try:
            resolved = None
            if node.node_schema:
                schema_parts = node.node_schema.split(".")
                resolved = self._resolved_table(
                    schema_parts[0] if len(schema_parts) > 1 else None, schema_parts[-1], node.name
                )
            if not resolved and node.node_type == "table":
                path = self.client.get_connection_path(node.id)
                if path and len(path) == 3 and path[2] == node.name:
                    resolved = self._resolved_table(*path)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error occured while finding table fqn: %s", exc)
            return None
        return resolved[0] if resolved and resolved[1] == db_service_prefix else None

    def _yield_lineage_from_files(
        self,
        dashboard_details: WorkbookDetails,
        db_service_prefix: str | None = None,
    ):
        """
        Yield lineage using file-based API (fallback method)
        """
        for data_model in self.data_models or []:
            if data_model.is_data_element:
                yield from self._yield_lineage_from_files_for_element(dashboard_details, data_model, db_service_prefix)

    def _yield_lineage_from_files_for_element(
        self,
        dashboard_details: WorkbookDetails,
        data_model: Elements,
        db_service_prefix: str | None = None,
    ):
        """
        Yield lineage using file-based API for a single element (fallback per element)
        """
        try:
            data_model_entity = self._get_datamodel(datamodel_id=data_model.elementId)
            if not data_model_entity:
                return

            lineage = self.client.get_lineage_details(dashboard_details.workbookId, data_model.elementId)

            if not lineage:
                return

            nodes, all_sources_read = lineage
            tables = [table for node in nodes if (table := self._get_table_entity_from_node(node, db_service_prefix))]
            yield from self._yield_table_and_column_lineage(
                tables,
                data_model_entity,
                data_model.columns,
                dashboard_details.formulas.get(data_model.elementId, {}),
                all_sources_found=all_sources_read and len(tables) == len(nodes),
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{dashboard_details.name} Element {data_model.elementId} File-Based Lineage",
                    error=f"Error in element file-based lineage fallback: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_table_and_column_lineage(
        self,
        tables: list[Table],
        data_model_entity: DashboardDataModel,
        labels: list[str] | None,
        formulas: dict[str, str],
        all_sources_found: bool,
    ):
        """
        One edge per source table of an element, carrying the columns it feeds. Sigma labels warehouse
        columns for reading (CUSTOMER_NAME shows as "Customer Name"), so names are compared
        normalized. Lineage must not guess, so a label is linked only when every source of the element was
        found (a missing one could hold the column too) and exactly one column across its tables matches.
        A column computed from other columns of the element gets their sources, read from its formula.
        """
        labels = labels or []
        # A computed column takes its sources from its formula, not from a warehouse column that shares its name
        columns_read = {label: read for label in labels if (read := _columns_read(label, labels, formulas))}
        sources: dict[str, list[tuple[str, str]]] = {}
        for label in labels if all_sources_found else []:
            if label in columns_read:
                continue
            matches = [
                (model_str(table.id), model_str(column_fqn))
                for table in tables
                for column in table.columns or []
                if (column_fqn := column.fullyQualifiedName)
                and normalize_column_name(column.name.root) == normalize_column_name(label)
            ]
            if len(matches) == 1:
                sources[label] = matches
        _inherit_formula_sources(sources, columns_read)
        column_lineage: dict[str, list[ColumnLineage]] = {}
        for label in labels:
            to_column = self._get_data_model_column_fqn(data_model_entity=data_model_entity, column=label)
            if not to_column:
                continue
            columns_by_table: dict[str, list[FullyQualifiedEntityName]] = {}
            for table_id, column_fqn in sources.get(label, []):
                columns_by_table.setdefault(table_id, []).append(FullyQualifiedEntityName(column_fqn))
            for table_id, from_columns in columns_by_table.items():
                column_lineage.setdefault(table_id, []).append(
                    ColumnLineage(fromColumns=from_columns, toColumn=FullyQualifiedEntityName(to_column))
                )
        for table in tables:
            yield self._get_add_lineage_request(
                to_entity=data_model_entity,
                from_entity=table,
                column_lineage=column_lineage.get(str(table.id.root), []),
            )

    def _parse_sql_lineage(self, query: str, dialect: Dialect) -> tuple[list[str], list[tuple[str, str, str]]]:
        """Source tables and output-column paths for a single SELECT."""
        try:
            statements = [statement for statement in sqlparse.parse(query) if str(statement).strip()]
            single_select = len(statements) == 1 and statements[0].get_type() == "SELECT"
        except Exception:
            single_select = False

        parser_type = self.get_query_parser_type()
        if single_select:
            parser = LineageParser(f"INSERT INTO {COLUMN_LINEAGE_TARGET} {query}", dialect, parser_type=parser_type)
            # LineageParser's third-party cached properties lack iterable type annotations.
            source_tables = [str(table) for table in parser.source_tables or []]  # pyright: ignore[reportGeneralTypeIssues]
            if source_tables:
                try:
                    column_paths = [
                        (str(path[0].parent), path[0].raw_name, path[-1].raw_name)
                        for path in parser.column_lineage or []  # pyright: ignore[reportGeneralTypeIssues]
                        if str(path[-1].parent).rsplit(".", 1)[-1] == COLUMN_LINEAGE_TARGET
                    ]
                except Exception as exc:
                    logger.debug("Could not read Sigma SQL column lineage: %s", exc)
                    column_paths = []
                return source_tables, column_paths

        parser = LineageParser(query, dialect, parser_type=parser_type)
        return [str(table) for table in parser.source_tables or []], []  # pyright: ignore[reportGeneralTypeIssues]

    @staticmethod
    def _expand_sql_wildcards(
        column_paths: list[tuple[str, str, str]], resolved_tables: dict[str, Table]
    ) -> list[tuple[str, str, str]]:
        """Expand fully resolved wildcards, excluding ambiguous output names."""
        wildcard_tables = {table for table, column, _ in column_paths if column == "*"}
        if not wildcard_tables:
            return column_paths
        explicit_paths = [path for path in column_paths if path[1] != "*"]
        if any(table not in resolved_tables or not resolved_tables[table].columns for table in wildcard_tables):
            # The parser can also materialize concrete paths from an unresolved star.
            return []

        wildcard_paths = [
            (table, model_str(column.name), model_str(column.name))
            for table in wildcard_tables
            for column in resolved_tables[table].columns or []
        ]
        wildcard_names = {normalize_column_name(output) for _, _, output in wildcard_paths}
        sources_by_output: dict[str, set[tuple[str, str]]] = {}
        for table, column, output in explicit_paths + wildcard_paths:
            sources_by_output.setdefault(normalize_column_name(output), set()).add((table, column))
        ambiguous = {name for name in wildcard_names if len(sources_by_output[name]) > 1}
        return [path for path in explicit_paths + wildcard_paths if normalize_column_name(path[2]) not in ambiguous]

    @staticmethod
    def _omit_ambiguous_sql_columns(
        column_paths: list[tuple[str, str, str]], resolved_tables: dict[str, Table]
    ) -> list[tuple[str, str, str]]:
        """
        Omit outputs whose source column more than one table could hold. The parser gives an unqualified column a
        path from every table it reads, which looks the same as an expression over that column of two tables.
        """
        tables_by_source: dict[tuple[str, str], set[str]] = {}
        for table, column, output in column_paths:
            table_entity = resolved_tables.get(table)
            # A table missing from OpenMetadata, or without known columns, could hold the column too
            if not (table_entity and table_entity.columns) or get_column_fqn(table_entity=table_entity, column=column):
                tables_by_source.setdefault((normalize_column_name(output), column.lower()), set()).add(table)
        ambiguous = {output for (output, _), tables in tables_by_source.items() if len(tables) > 1}
        return [path for path in column_paths if normalize_column_name(path[2]) not in ambiguous]

    @staticmethod
    def _get_sql_column_lineage(
        column_paths: list[tuple[str, str, str]],
        source_table: str,
        table: Table,
        data_model: DashboardDataModel,
    ) -> list[ColumnLineage]:
        """Map parsed SQL output columns to the element's display columns."""
        from_names_by_target: dict[str, list[str]] = {}
        for path_table, source_column, output_column in column_paths:
            if path_table != source_table:
                continue
            from_names_by_target.setdefault(output_column, []).append(source_column)

        lineage = []
        for output_column, source_columns in from_names_by_target.items():
            targets = [
                column
                for column in data_model.columns or []
                if normalize_column_name(column.displayName or model_str(column.name))
                == normalize_column_name(output_column)
            ]
            from_columns = [
                FullyQualifiedEntityName(column_fqn)
                for source_column in dict.fromkeys(source_columns)
                if (column_fqn := get_column_fqn(table_entity=table, column=source_column))
            ]
            if len(targets) == 1 and targets[0].fullyQualifiedName and from_columns:
                lineage.append(ColumnLineage(fromColumns=from_columns, toColumn=targets[0].fullyQualifiedName))
        return lineage

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: WorkbookDetails,
        db_service_prefix: str | None = None,
    ):
        """
        Yield dashboard lineage using SQL query parsing (primary) or file-based (fallback)
        """
        if not dashboard_details:
            logger.warning(f"Skipping lineage - dashboard details are None (API error)")  # noqa: F541
            return
        if not db_service_prefix:
            # Tables resolve only within the dbServicePrefixes services: without one there is nothing to link
            return

        queries_response = self.client.get_workbook_queries(dashboard_details.workbookId)

        if not queries_response or not queries_response.entries:
            yield from self._yield_lineage_from_files(dashboard_details, db_service_prefix)
            return

        db_service_entity = self._db_services.get(db_service_prefix)
        dialect = None

        queries_by_element = {q.elementId: q for q in queries_response.entries}

        for data_model in self.data_models or []:
            try:
                if not data_model.is_data_element:
                    continue

                data_model_entity = self._get_datamodel(datamodel_id=data_model.elementId)
                if not data_model_entity:
                    continue

                query_obj = queries_by_element.get(data_model.elementId)

                if not query_obj or not query_obj.sql:
                    yield from self._yield_lineage_from_files_for_element(
                        dashboard_details, data_model, db_service_prefix
                    )
                    continue

                dialect = (
                    dialect
                    or self._workbook_dialect(dashboard_details)
                    or (
                        ConnectionTypeDialectMapper.dialect_of(db_service_entity.serviceType.value)
                        if db_service_entity
                        else Dialect.ANSI
                    )
                )
                source_tables, column_paths = self._parse_sql_lineage(query_obj.sql, dialect)
                resolved_tables: dict[str, Table] = {}
                for source_table in source_tables:
                    try:
                        database_schema_table = fqn.split_table_name(str(source_table))
                        table_entity = self._get_table_entity(
                            database_schema_table.get("database"),
                            database_schema_table.get("database_schema"),
                            database_schema_table.get("table"),
                            db_service_prefix,
                        )
                    except Exception as exc:
                        yield Either(
                            left=StackTraceError(
                                name=f"{dashboard_details.name} Lineage",
                                error=f"Error looking up table [{source_table}] of element [{data_model.elementId}]: {exc}",
                                stackTrace=traceback.format_exc(),
                            ),
                            right=None,
                        )
                        continue
                    if isinstance(table_entity, Table):
                        resolved_tables[source_table] = table_entity
                column_paths = self._omit_ambiguous_sql_columns(
                    self._expand_sql_wildcards(column_paths, resolved_tables), resolved_tables
                )
                for source_table, table_entity in resolved_tables.items():
                    yield self._get_add_lineage_request(
                        to_entity=data_model_entity,
                        from_entity=table_entity,
                        column_lineage=self._get_sql_column_lineage(
                            column_paths, source_table, table_entity, data_model_entity
                        ),
                    )

            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service prefix [{db_service_prefix}]: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _workbook_lineage(self, dashboard_details: WorkbookDetails) -> list[WorkbookLineageEntry]:
        if dashboard_details.lineage is None:
            dashboard_details.lineage = self.client.get_workbook_lineage(dashboard_details.workbookId)
        return dashboard_details.lineage or []

    def _workbook_dialect(self, dashboard_details: WorkbookDetails) -> Dialect | None:
        """The dialect of the warehouse Sigma runs the workbook's SQL on, when all its sources use one connection"""
        connection_ids = {
            entry.connectionId for entry in self._workbook_lineage(dashboard_details) if entry.connectionId
        }
        if len(connection_ids) != 1:
            return None
        connection_type = self.client.get_connection_type(next(iter(connection_ids)))
        return SIGMA_CONNECTION_DIALECTS.get((connection_type or "").lower())

    def yield_dashboard_lineage(self, dashboard_details: WorkbookDetails) -> Iterable[Either[OMetaLineageRequest]]:
        """Also link each Sigma Data Model to the workbook elements reading it, once per workbook"""
        yield from super().yield_dashboard_lineage(dashboard_details)
        if not (dashboard_details and self.source_config.includeDataModels):
            return
        lineage = self._workbook_lineage(dashboard_details)
        data_model_ids = {entry.dataModelId for entry in lineage if entry.dataModelId}
        # An element row lists the data models it reads among its root sources (dataSourceIds)
        links = {
            (data_model_id, entry.elementId)
            for entry in lineage
            if entry.elementId
            for data_model_id in data_model_ids.intersection(entry.dataSourceIds or [])
        }
        for data_model_id, element_id in sorted(links):
            from_entity, to_entity = self._get_datamodel(data_model_id), self._get_datamodel(element_id)
            if from_entity and to_entity:
                yield from self.yield_lineage_request(
                    self._get_add_lineage_request(to_entity=to_entity, from_entity=from_entity)
                )

    def yield_dashboard_extension(self, dashboard_details: WorkbookDetails) -> Iterable[Either[PatchRequest]]:
        """The workbook's latest published version, which changes each time the workbook is published"""
        if not (
            dashboard_details
            and self.source_config.includeCustomProperties
            and dashboard_details.latestVersion is not None
        ):
            return
        try:
            if not self._latest_version_defined:
                return
            dashboard = self.metadata.get_by_name(
                entity=Dashboard,
                fqn=fqn._build(vars(self.context.get())["dashboard_service"], dashboard_details.workbookId),
                fields=["extension"],
            )
            if not dashboard:
                return
            stored = dashboard.extension.root if dashboard.extension else {}
            # The properties a user set on the dashboard are sent back as they are, so the patch only touches this one
            yield Either(
                left=None,
                right=PatchRequest(
                    original_entity=dashboard,
                    new_entity=dashboard.model_copy(
                        update={
                            "extension": EntityExtension({**stored, LATEST_VERSION: dashboard_details.latestVersion})
                        }
                    ),
                    override_metadata=True,
                ),
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{dashboard_details.name} Custom Properties",
                    error=f"Error setting the latest version of Sigma workbook {dashboard_details.workbookId}: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )

    @cached_property
    def _latest_version_defined(self) -> bool:
        """
        Whether dashboards hold LATEST_VERSION as a number, registering it once per run. A property of that name
        with another type is left alone: changing its type would invalidate the value every dashboard holds.
        """
        defined = {
            prop.get("name"): (prop.get("propertyType") or {}).get("name")
            for prop in self.metadata.get_entity_custom_properties(entity_type=Dashboard) or []
        }
        if LATEST_VERSION in defined:
            if defined[LATEST_VERSION] == CustomPropertyDataTypes.NUMBER.value:
                return True
            logger.warning(
                "Dashboard custom property %s exists as %s, not %s; Sigma won't set it",
                LATEST_VERSION,
                defined[LATEST_VERSION],
                CustomPropertyDataTypes.NUMBER.value,
            )
            return False
        try:
            self.metadata.create_or_update_custom_property(
                OMetaCustomProperties(
                    entity_type=Dashboard,
                    createCustomPropertyRequest=CreateCustomPropertyRequest(
                        name=EntityName(LATEST_VERSION),
                        description=Markdown("The most recently published version of the Sigma workbook"),
                        propertyType=self.metadata.get_property_type_ref(CustomPropertyDataTypes.NUMBER),
                    ),
                )
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not register dashboard custom property %s: %s", LATEST_VERSION, exc)
            return False
        return True

    def get_column_info(self, element: Elements, formulas: dict[str, str] | None = None) -> list[Column]:
        """Build data model columns, each computed one showing its Sigma formula"""
        datamodel_columns = []
        for col in element.columns or []:
            try:
                datamodel_columns.append(
                    Column(
                        name=truncate_column_name(col),
                        displayName=col,
                        dataType=DataType.UNKNOWN,
                        dataTypeDisplay="Sigma Field",
                        description=Markdown(f"**Formula:** `{formula}`")
                        if (formula := (formulas or {}).get(col)) and not _SOURCE_REFERENCE.fullmatch(formula)
                        else None,
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datamodel_columns

    def yield_datamodel(self, dashboard_details: WorkbookDetails) -> Iterable[Either[DashboardDataModel]]:
        if not dashboard_details:
            logger.warning(
                f"Skipping data models - dashboard details are None (API error)"  # noqa: F541
            )
            return

        if self.source_config.includeDataModels:
            self.data_models = []
            for data_model in dashboard_details.elements:
                if not data_model.is_data_element:
                    continue
                display_name = data_model.name or f"Element {data_model.elementId}"
                if filter_by_datamodel(self.source_config.dataModelFilterPattern, display_name):
                    self.status.filter(display_name, "Data model filtered out.")
                    continue
                self.data_models.append(data_model)
                try:
                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(data_model.elementId),
                        displayName=display_name,
                        service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                        dataModelType=DataModelType.SigmaDataModel.value,
                        serviceType=self.service_connection.type.value,
                        columns=self.get_column_info(data_model, dashboard_details.formulas.get(data_model.elementId)),
                    )
                    yield Either(right=data_model_request)
                    self.register_record_datamodel(datamodel_request=data_model_request)
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=data_model.elementId,
                            error=f"Error yielding Data Model [{data_model.elementId}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def list_datamodels(self) -> Iterable[DataModel | _DataModelLineageMarker]:
        """Sigma Data Models, ingested before the workbooks that read from them, then the marker for their lineage"""
        if not self.source_config.includeDataModels:
            return
        data_models = self.client.get_data_models()
        self._lineage_data_models = []
        self._data_model_url_ids = {
            data_model.dataModelId: data_model.dataModelUrlId for data_model in data_models if data_model.dataModelUrlId
        }
        yield from data_models
        if data_models:
            yield _DATA_MODEL_LINEAGE

    def yield_bulk_datamodel(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, data_model: DataModel | _DataModelLineageMarker
    ) -> Iterable[Either]:
        """One data model per Sigma Data Model, with a table column per element, as PowerBI models a dataset"""
        if isinstance(data_model, _DataModelLineageMarker):
            yield from self._yield_data_model_lineage()
            return
        display_name = data_model.name or data_model.dataModelId
        if filter_by_datamodel(self.source_config.dataModelFilterPattern, display_name):
            self.status.filter(display_name, "Data model filtered out.")
            return
        self._lineage_data_models.append(data_model)
        try:
            elements = self.client.get_data_model_elements(data_model.dataModelId)
            if elements is None:
                # Rebuilt from an unread element list, the data model would lose its columns: keep it as it is
                self.datamodel_source_state.add(
                    fqn.build(
                        self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=vars(self.context.get())["dashboard_service"],
                        data_model_name=data_model.dataModelId,
                    )
                )
                return
            formulas = self.client.get_column_formulas(f"/dataModels/{data_model.dataModelId}/columns")
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(data_model.dataModelId),
                displayName=display_name,
                service=FullyQualifiedEntityName(vars(self.context.get())["dashboard_service"]),
                dataModelType=DataModelType.SigmaDataModel,
                serviceType=self.service_connection.type.value,
                sourceUrl=SourceUrl(data_model.url) if data_model.url else None,
                owners=self.get_owner_ref(data_model),
                columns=[
                    Column(
                        name=ColumnName(truncate_column_name(element.elementId)),
                        displayName=element.name or element.elementId,
                        dataType=DataType.TABLE,
                        dataTypeDisplay="Sigma Data Model Element",
                        children=self.get_column_info(element, formulas.get(element.elementId)),
                    )
                    for element in elements
                ],
            )
            yield Either(left=None, right=data_model_request)
            self.register_record_datamodel(datamodel_request=data_model_request)
        except Exception as exc:
            yield Either(
                right=None,
                left=StackTraceError(
                    name=data_model.dataModelId,
                    error=f"Error yielding Sigma data model [{data_model.dataModelId}]: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
            )

    def _yield_data_model_lineage(self) -> Iterable[Either]:
        """
        The tables and Sigma Data Models each Sigma Data Model reads, sent once every data model is written, as a
        data model can read one listed after it
        """
        yield Either(left=None, right=Barrier(reason="sigma_data_model_lineage_flush"))
        for data_model in self._lineage_data_models:
            try:
                yield from self._yield_lineage_of_data_model(data_model)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=data_model.dataModelId,
                        error=f"Error yielding the lineage of Sigma data model [{data_model.dataModelId}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                    right=None,
                )

    def _yield_lineage_of_data_model(self, data_model: DataModel) -> Iterable[Either[OMetaLineageRequest]]:
        entries = self.client.get_data_model_lineage(data_model.dataModelId)
        read_ids = self._ids_read_by_elements(entries)
        upstream: dict[str, Table | DashboardDataModel] = {}
        for entry in entries:
            if source := self._data_model_lineage_source(entry, read_ids):
                upstream.setdefault(model_str(source.id), source)
        to_entity = self._get_datamodel(data_model.dataModelId) if upstream else None
        if not to_entity:
            return
        for from_entity in upstream.values():
            yield from self.yield_lineage_request(
                self._get_add_lineage_request(to_entity=to_entity, from_entity=from_entity)
            )

    @staticmethod
    def _ids_read_by_elements(entries: list[WorkbookLineageEntry]) -> set[str]:
        """
        The ids a data model's elements read from, as their sourceIds and dataSourceIds write them: an inode or url
        id, with or without an `inode-` prefix, or `<data model url id>/<element>` for another data model's element
        """
        ids = set()
        for entry in entries:
            for source_id in (entry.sourceIds or []) + (entry.dataSourceIds or []):
                bare_id = source_id.removeprefix("inode-")
                ids.update((bare_id, bare_id.split("/", 1)[0]))
        return ids

    def _data_model_lineage_source(
        self, entry: WorkbookLineageEntry, read_ids: set[str]
    ) -> Table | DashboardDataModel | None:
        """
        The table or Sigma Data Model a data model lineage row names, when an element of the data model reads it.
        Sigma also lists the sources of what the elements read (ADR:2026-11-12-sigma-data-model-lineage-links-only-what-its-elements-read).
        """
        if entry.type == "data-model" and entry.dataModelId:
            if read_ids.isdisjoint({entry.dataModelId, self._data_model_url_ids.get(entry.dataModelId)}):
                return None
            return self._get_datamodel(entry.dataModelId)
        prefixes = self.get_db_service_prefixes()
        if entry.type != "table" or not entry.inodeId or not prefixes:
            return None
        node = self.client.get_file(entry.inodeId)
        if not node or read_ids.isdisjoint({entry.inodeId, node.urlId}):
            return None
        return next((table for prefix in prefixes if (table := self._get_table_entity_from_node(node, prefix))), None)

    def get_owner_ref(self, dashboard_details: WorkbookDetails | DataModel) -> EntityReferenceList | None:
        """
        Get owner from email
        """
        try:
            if not self.source_config.includeOwners:
                return None
            if dashboard_details.ownerId:
                owner = self.client.get_owner_detail(dashboard_details.ownerId)
                return self.metadata.get_reference_by_email(owner.email.lower()) if owner else None
            return None  # noqa: TRY300
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None
