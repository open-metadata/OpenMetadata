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
Hex source module. Lineage and data model columns come from the SQL cells of
each project, falling back to Hex queries in the warehouse query history.
"""

import re
import traceback
from typing import Dict, Iterable, Optional  # noqa: UP035

from sqlglot import exp

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import (
    HexConnection,
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
    SqlQuery,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.hex.cell_lineage import (
    DATAFRAME_SQL_DIALECT,
    UNRESOLVED,
    ChainedCells,
    HexCellColumn,
    HexCellLineage,
    get_output_columns,
    get_table_references,
    inline_upstream_cells,
    parse_cell_sql,
    table_key,
)
from metadata.ingestion.source.dashboard.hex.client import HexAccessDeniedError
from metadata.ingestion.source.dashboard.hex.models import Cell, DataConnection, Project
from metadata.ingestion.source.dashboard.hex.query_fetcher import (
    HexProjectLineage,
    HexQueryFetcher,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.elasticsearch import ES_INDEX_MAP
from metadata.utils.filters import filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

HEX_TAG_CATEGORY = "HexCategories"
# Distinct table references looked up per project; past it a reference is searched again
MAX_RESOLVED_TABLES = 1_000


class TableSearchError(Exception):
    """The table search failed, so whether a table exists is unknown"""


INVALID_COLUMN_NAME_CHARS = re.compile(r'::|[>"\x00-\x1f]')


class HexSource(DashboardServiceSource):
    """
    Hex Source Class with direct warehouse query support for lineage
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.projects = []  # We will populate this in `prepare`

        # Initialize lineage components
        self.hex_project_lineage: Dict[str, HexProjectLineage] = {}  # noqa: UP006

        # Initialize query fetcher for lineage
        self.query_fetcher = HexQueryFetcher(metadata=metadata, lookback_days=7)

        # Single slot: the data model and lineage stages of the same project share it
        self._cell_lineage: tuple[str, list[HexCellLineage] | None] | None = None
        self._data_connections: dict[str, DataConnection] | None = None
        self._data_connections_denied = False

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: HexConnection = config.serviceConnection.root.config
        if not isinstance(connection, HexConnection):
            raise InvalidSourceException(f"Expected HexConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Fetch the list of projects, categories, and lineage data from warehouses"""
        # Fetch lineage data from warehouses if enabled
        if self.query_fetcher:
            db_service_prefixes = self.get_db_service_prefixes()
            if db_service_prefixes:
                logger.info(f"Fetching Hex lineage using {len(db_service_prefixes)} database service prefixes")

                for db_service_prefix in db_service_prefixes:
                    try:
                        logger.info(f"Processing service prefix: {db_service_prefix}")
                        projects_data_from_warehouse = self.query_fetcher.fetch_hex_queries_from_service_prefix(
                            db_service_prefix
                        )

                        # Store or merge data for each Hex project found in this warehouse
                        for (
                            project_id,
                            project_data,
                        ) in projects_data_from_warehouse.items():
                            if project_id not in self.hex_project_lineage:
                                # First time seeing this project - store all its data
                                self.hex_project_lineage[project_id] = project_data
                            else:
                                # Project already exists - merge new data
                                existing_project_data = self.hex_project_lineage[project_id]

                                # Add new tables (duplicates are automatically handled by add_tables method)
                                existing_project_data.add_tables(project_data.upstream_tables)

                            logger.debug(
                                f"Found lineage for project {project_id}: "
                                f"{len(self.hex_project_lineage[project_id].upstream_tables)} upstream tables"
                            )

                    except Exception as e:
                        logger.error(f"Error fetching lineage from prefix {db_service_prefix}: {e}")
                        logger.debug(traceback.format_exc())

                logger.info(f"Total Hex projects with lineage: {len(self.hex_project_lineage)}")

    def get_dashboards_list(self):
        """
        Get List of all dashboards
        """
        self.projects = self.client.get_projects()
        return self.projects

    def get_dashboard_name(self, dashboard: Project) -> str:
        """Get dashboard name"""
        return dashboard.title

    def get_dashboard_details(self, dashboard: Project) -> Project:
        """Get dashboard details - in Hex, we already have all details from list API"""
        return dashboard

    def get_owner_ref(self, dashboard_details: Project) -> Optional[EntityReferenceList]:  # noqa: UP045
        """
        Get owner from email
        """
        try:
            # Try owner first, then creator
            email = None
            if dashboard_details.owner and dashboard_details.owner.email:
                email = dashboard_details.owner.email
            elif dashboard_details.creator and dashboard_details.creator.email:
                email = dashboard_details.creator.email

            if email:
                return self.metadata.get_reference_by_email(email)
            return None  # noqa: TRY300
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def yield_tags(self, dashboard_details: Project) -> Iterable[Either[OMetaTagAndClassification]]:
        """Create classification and tags for dashboard"""
        tags = self._extract_tags_from_project(dashboard_details)
        if tags and self.source_config.includeTags:
            yield from get_ometa_tag_and_classification(
                tags=tags,
                classification_name=HEX_TAG_CATEGORY,
                tag_description="Hex Tag",
                classification_description="Tags associated with Hex projects",
                include_tags=self.source_config.includeTags,
                metadata=self.metadata,
            )

    def _extract_tags_from_project(self, dashboard_details):
        """Extract tag names from dashboard categories and status"""
        tags_list = []

        # Add category names as tags
        if dashboard_details.categories:
            for category in dashboard_details.categories:
                if category and category.name:
                    tags_list.append(category.name)  # noqa: PERF401

        # Add status name as tag
        if dashboard_details.status and dashboard_details.status.name:
            tags_list.append(dashboard_details.status.name)

        return list(set(tags_list)) if tags_list else []  # Remove duplicates

    def _get_dashboard_tags(self, dashboard_details):
        """Get tag labels for dashboard"""
        if self.source_config.includeTags:
            tags = self._extract_tags_from_project(dashboard_details)

            if tags:
                return get_tag_labels(
                    metadata=self.metadata,
                    tags=tags,
                    classification_name=HEX_TAG_CATEGORY,
                    include_tags=True,
                )

        return None

    def yield_dashboard(self, dashboard_details: Project) -> Iterable[Either[CreateDashboardRequest]]:
        """Method to Get Dashboard Entity"""
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.title,
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
                    for data_model in getattr(self.context.get(), "dataModels", None) or []
                ]
                + [FullyQualifiedEntityName(kept) for kept in [self._kept_data_model_fqn(dashboard_details)] if kept]
                if self.source_config.includeDataModels
                else None,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(self.client.get_project_url(dashboard_details)),
                tags=self._get_dashboard_tags(dashboard_details),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error to yield dashboard for {dashboard_details.title}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Project,
        db_service_prefix: Optional[str] = None,  # noqa: UP045
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Lineage from the tables the project's SQL cells read, falling back to the
        Hex queries found in the warehouse query history.
        """
        cell_lineage = self._get_cell_lineage(dashboard_details) or []
        yield from self._yield_cell_lineage(dashboard_details, cell_lineage, db_service_prefix)
        # The query history can still name tables no cell resolved, e.g. one a cell reads
        # by a bare name that matches several tables in OpenMetadata
        resolved_by_cells = {table_id for cell in cell_lineage for table_id in cell.tables}

        project_lineage = self.hex_project_lineage.get(dashboard_details.id)
        upstream_tables = [
            table
            for table in (project_lineage.upstream_tables if project_lineage else [])
            if table and table.id and model_str(table.id) not in resolved_by_cells
        ]
        if not upstream_tables:
            logger.debug(f"No lineage found for Hex project: {dashboard_details.id}")
            return

        try:
            dashboard_fqn = self._build_fqn(Dashboard, dashboard_details)
            dashboard = self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn)
            if not dashboard:
                logger.warning(f"Dashboard not found in OpenMetadata: {dashboard_fqn}")
                return

            logger.info(
                "Creating lineage for Hex project %s with %d upstream tables",
                dashboard_details.title,
                len(upstream_tables),
            )

            # Create lineage for each upstream table
            for table_entity in upstream_tables:
                try:
                    # We already have the table entity from query_fetcher
                    if not table_entity or not table_entity.id:
                        logger.debug("Table entity is None or has no ID")
                        continue

                    lineage = self._get_add_lineage_request(to_entity=dashboard, from_entity=table_entity)
                    if lineage is not None:
                        yield lineage
                    logger.debug(f"Added lineage: {table_entity.fullyQualifiedName.root} -> {dashboard_fqn}")

                except Exception as e:
                    table_fqn = table_entity.fullyQualifiedName.root if table_entity else "Unknown"
                    logger.error(f"Error creating lineage for table {table_fqn}: {e}")
                    yield Either(
                        left=StackTraceError(
                            name="Lineage",
                            error=f"Error creating lineage for table {table_fqn}: {e}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

        except Exception as exc:
            logger.error(f"Error building lineage for dashboard {dashboard_details.id}: {exc}")
            yield Either(
                left=StackTraceError(
                    name="Dashboard Lineage",
                    error=f"Error building lineage for dashboard {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(self, dashboard_details: Project) -> Iterable[Either[CreateChartRequest]]:
        """
        Hex projects don't have separate charts - they are integrated within the project.
        Return empty iterator as we only ingest dashboards.
        """
        return

    def yield_datamodel(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, dashboard_details: Project
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        One data model per project, with one struct column per SQL cell holding
        the columns that cell outputs (ADR:2026-10-27-hex-project-is-one-data-model-with-a-column-group-per-cell-id)
        """
        if not self.source_config.includeDataModels:
            return
        if filter_by_datamodel(self.source_config.dataModelFilterPattern, dashboard_details.title):
            self.status.filter(dashboard_details.title, "Data model filtered out.")
            return
        cell_lineage = self._get_cell_lineage(dashboard_details)
        if cell_lineage is None:
            # Unread is not gone: marking the existing data model as seen keeps this run
            # from deleting it and its lineage. Marking one that doesn't exist is harmless.
            self.datamodel_source_state.add(self._build_fqn(DashboardDataModel, dashboard_details))
            return
        try:
            columns = self._data_model_columns(dashboard_details, cell_lineage)
        except Exception as exc:
            # Without the earlier data model, the groups of the cells that failed would be lost
            logger.debug(traceback.format_exc())
            logger.warning("Could not read the data model of Hex project %s: %s", dashboard_details.id, exc)
            self.datamodel_source_state.add(self._build_fqn(DashboardDataModel, dashboard_details))
            return
        if not columns:
            return
        cells = [cell for cell in cell_lineage if not cell.failed]
        try:
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.title,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),  # pyright: ignore[reportAttributeAccessIssue]
                dataModelType=DataModelType.HexDataModel,
                serviceType=self.service_connection.type.value,
                sourceUrl=SourceUrl(self.client.get_project_url(dashboard_details)),
                sql=SqlQuery("\n\n".join(f"-- {cell.label}\n{cell.sql}" for cell in cells)),
                columns=columns,
            )
            yield Either(right=data_model_request)  # pyright: ignore[reportCallIssue]
            self.register_record_datamodel(datamodel_request=data_model_request)
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=dashboard_details.id,
                    error=f"Error yielding data model for {dashboard_details.title}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _data_model_columns(self, project: Project, cells: list[HexCellLineage]) -> list[Column]:
        """
        One struct per cell, in notebook order. A cell whose SQL failed to parse this
        time (a draft being edited) keeps its group from the existing data model, with
        what users curated on it, rather than dropping it.
        """
        existing: dict[str, Column] = {}
        if any(cell.failed for cell in cells):
            data_model = self.metadata.get_by_name(
                entity=DashboardDataModel, fqn=self._build_fqn(DashboardDataModel, project), fields=["columns"]
            )
            existing = {model_str(column.name): column for column in (data_model.columns if data_model else [])}
        columns = []
        for cell in cells:
            if cell.failed:
                if cell.name in existing:
                    columns.append(_without_fqns(existing[cell.name]))
            elif cell.columns:
                columns.append(
                    Column(
                        name=ColumnName(cell.name),
                        displayName=cell.label,
                        dataType=DataType.STRUCT,
                        children=[_output_column(column) for column in cell.columns],
                    )
                )
        return columns

    def _data_model_exists(self, project: Project) -> bool:
        """True when it can't be told: a data model that exists must not be rebuilt from less"""
        try:
            return (
                self.metadata.get_by_name(entity=DashboardDataModel, fqn=self._build_fqn(DashboardDataModel, project))
                is not None
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not look up the data model of Hex project %s: %s", project.id, exc)
            return True

    def _yield_cell_lineage(
        self,
        dashboard_details: Project,
        cells: list[HexCellLineage],
        db_service_prefix: str | None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Table -> data model edges carrying column lineage, or table -> dashboard
        edges when data models are off. Only the tables found under this prefix,
        as this runs once per db service prefix.
        """
        if not any(cell.tables for cell in cells):
            return
        try:
            data_model = (
                self.metadata.get_by_name(
                    entity=DashboardDataModel, fqn=self._build_fqn(DashboardDataModel, dashboard_details)
                )
                # A filtered-out data model left from an earlier run is deleted by this one
                if self.source_config.includeDataModels
                and not filter_by_datamodel(self.source_config.dataModelFilterPattern, dashboard_details.title)
                else None
            )
            target = data_model or self.metadata.get_by_name(
                entity=Dashboard, fqn=self._build_fqn(Dashboard, dashboard_details)
            )
            if not target:
                logger.warning("Lineage target for Hex project %s not found in OpenMetadata", dashboard_details.id)
                return

            to_columns = {
                (model_str(column.name), model_str(child.name)): model_str(child.fullyQualifiedName)
                for column in (data_model.columns or [] if data_model else [])
                for child in column.children or []
                if child.fullyQualifiedName
            }
            tables = {
                table_id: table
                for cell in cells
                for table_id, (table, prefix) in cell.tables.items()
                if prefix == db_service_prefix
            }
            for table_id, table in tables.items():
                column_lineage = [
                    ColumnLineage(
                        fromColumns=[
                            FullyQualifiedEntityName(column_fqn)
                            for source_id, column_fqn in column.source_columns
                            if source_id == table_id
                        ],
                        toColumn=FullyQualifiedEntityName(to_columns[(cell.name, column.name)]),
                    )
                    for cell in cells
                    for column in cell.columns
                    if (cell.name, column.name) in to_columns
                    and any(source_id == table_id for source_id, _ in column.source_columns)
                ]
                lineage = self._get_add_lineage_request(
                    to_entity=target,
                    from_entity=table,
                    column_lineage=column_lineage or None,  # pyright: ignore[reportArgumentType]
                )
                if lineage:
                    yield lineage
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name="Dashboard Lineage",
                    error=f"Error building cell lineage for Hex project {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_cell_lineage(self, project: Project) -> list[HexCellLineage] | None:
        """
        None when the project's cells, the data connections or the table search could
        not be read: the data model is then left as it is
        """
        if not self._cell_lineage or self._cell_lineage[0] != project.id:
            self._cell_lineage = (project.id, self._build_cell_lineage(project))
        return self._cell_lineage[1]

    def _kept_data_model_fqn(self, project: Project) -> str | None:
        """
        The data model an earlier run created for a project whose cells this run could
        not read, so the dashboard stays linked to it. None when it can't be confirmed:
        linking a data model that doesn't exist would fail the dashboard.
        """
        if (
            not self.source_config.includeDataModels
            or filter_by_datamodel(self.source_config.dataModelFilterPattern, project.title)
            or self._get_cell_lineage(project) is not None
        ):
            return None
        data_model_fqn = self._build_fqn(DashboardDataModel, project)
        try:
            found = self.metadata.get_by_name(entity=DashboardDataModel, fqn=data_model_fqn)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not look up data model %s: %s", data_model_fqn, exc)
            return None
        return data_model_fqn if found else None

    def _build_cell_lineage(self, project: Project) -> list[HexCellLineage] | None:
        cells = self.client.get_project_cells(project.id)
        if cells is None:
            return None
        # Without its connection's dialect and default database and schema a cell can
        # lose columns (BigQuery backticks, a bare table name): an existing data model
        # is left as it is, only a project without one gets one from what can be read
        data_connections = self._get_data_connections()
        if data_connections is None:
            if not self.source_config.includeDataModels or self._data_model_exists(project):
                return None
            data_connections = {}
        # Cells of a project tend to read the same tables, so look each one up once
        resolved_tables: LRUCache[tuple[Table, str | None] | None] = LRUCache(MAX_RESOLVED_TABLES)
        upstream = ChainedCells()
        cell_lineage: list[HexCellLineage] = []
        taken_names: set[str] = set()
        for cell in cells:
            try:
                lineage = self._build_sql_cell_lineage(cell, data_connections, upstream, resolved_tables)
            except TableSearchError as exc:
                # A table that can't be looked up is not a table that isn't there: building
                # the data model now would drop its columns and their lineage
                logger.warning("Could not search the tables of Hex project %s: %s", project.id, exc)
                return None
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Could not parse SQL cell %s of Hex project %s: %s", cell.id, project.id, exc)
                cell_id = cell.staticId or cell.id
                lineage = HexCellLineage(name=cell_id, label=cell.label or cell_id, sql=cell.sql or "", failed=True)
            if lineage:
                lineage.name = self._unique_column_name(lineage.name, taken_names)
                cell_lineage.append(lineage)
        return cell_lineage

    def _build_sql_cell_lineage(
        self,
        cell: Cell,
        data_connections: dict[str, DataConnection],
        upstream: ChainedCells,
        resolved_tables: LRUCache[tuple[Table, str | None] | None],
    ) -> HexCellLineage | None:
        if not cell.sql:
            return None
        connection = data_connections.get(cell.dataConnectionId) if cell.dataConnectionId else None
        dialect = connection.type if connection else None if cell.dataConnectionId else DATAFRAME_SQL_DIALECT
        expression = parse_cell_sql(cell.sql, dialect)
        if expression is None:
            raise ValueError("its SQL could not be parsed")
        if not cell.dataConnectionId:
            # SQL without a data connection runs on dataframes: the names it reads are
            # dataframes, not warehouse tables, and it reaches the warehouse only through
            # the SQL cells it reads
            for reference in get_table_references(expression):
                reference.meta[UNRESOLVED] = True
        if (
            not inline_upstream_cells(expression, upstream.readable_by(cell.dataConnectionId))
            and not cell.dataConnectionId
        ):
            return None

        cell_id = cell.staticId or cell.id
        lineage = HexCellLineage(name=cell_id, label=cell.label or cell_id, sql=cell.sql)
        tables_by_key: dict[tuple[str, str, str], Table] = {}
        schema: dict[str, dict[str, dict[str, dict[str, str]]]] = {}
        for reference in get_table_references(expression):
            if reference.meta.get(UNRESOLVED):
                continue
            # The connection is part of the key: it fills in what the reference leaves out
            key = repr((cell.dataConnectionId, *table_key(reference)))
            searched_database = reference.catalog or (connection.default_database if connection else None)
            searched_schema = reference.db or (connection.default_schema if connection else None)
            if key not in resolved_tables:
                resolved_tables.put(key, self._resolve_table(searched_database, searched_schema, reference.name))
            resolved = resolved_tables.get(key)
            if not resolved:
                # A later cell inlining this one lacks this connection's defaults and
                # would search wider; what this cell couldn't resolve stays unresolved
                reference.meta[UNRESOLVED] = True
                continue
            table, prefix = resolved
            _, database, schema_name, table_name = fqn.split(model_str(table.fullyQualifiedName))
            # Point the reference at the table found, so a partially qualified name
            # lines up with the schema handed to sqlglot
            reference.set("catalog", exp.to_identifier(database))
            reference.set("db", exp.to_identifier(schema_name))
            reference.set("this", exp.to_identifier(table_name))
            lineage.tables[model_str(table.id)] = (table, prefix)
            tables_by_key[(database.lower(), schema_name.lower(), table_name.lower())] = table
            schema.setdefault(database, {}).setdefault(schema_name, {})[table_name] = {
                model_str(column.name): "unknown" for column in table.columns or []
            }

        # Stored once its references name the tables found, so a later cell inlining it
        # doesn't have to resolve them again without this cell's connection defaults
        if cell.resultVariableName:
            upstream.add(cell.resultVariableName, cell.dataConnectionId, expression)

        taken_names: set[str] = set()
        for output in get_output_columns(expression, schema):
            sources = [
                (table, column)
                for key, column_name in output.sources
                if (table := tables_by_key.get(key))
                for column in table.columns or []
                if model_str(column.name).lower() == column_name and column.fullyQualifiedName
            ]
            passthrough = sources[0][1] if output.passthrough and len(sources) == 1 else None
            # Unaliased output names are lower-cased; a column passed through keeps its table's casing
            name = (
                model_str(passthrough.name)
                if passthrough and model_str(passthrough.name).lower() == output.name.lower()
                else output.name
            )
            lineage.columns.append(
                HexCellColumn(
                    name=self._unique_column_name(name, taken_names),
                    passthrough=passthrough,
                    source_columns=[
                        (model_str(table.id), model_str(column.fullyQualifiedName)) for table, column in sources
                    ],
                )
            )
        return lineage

    def _resolve_table(self, database: str | None, schema: str | None, table: str) -> tuple[Table, str | None] | None:
        """
        The one table the reference names across the db service prefixes (any service
        when none is set), with the prefix it was found under. Lineage must not guess,
        so a reference without a schema, or matching several tables (the same
        schema.table in two services), resolves to none.
        """
        matches: dict[str, tuple[Table, str | None]] = {}
        for prefix in self.get_db_service_prefixes() or [None]:
            service, prefix_database, prefix_schema, prefix_table = self.parse_db_service_prefix(prefix)
            if any(
                expected and actual and expected.lower() != actual.lower()
                for expected, actual in ((prefix_database, database), (prefix_schema, schema), (prefix_table, table))
            ):
                continue
            if not (schema or prefix_schema):
                continue
            search = build_es_fqn_search_string(
                database_name=database or prefix_database,  # pyright: ignore[reportArgumentType]  # None searches "*"
                schema_name=schema or prefix_schema,
                service_name=service or "*",
                table_name=table,
            )
            for found in self._search_tables(search):
                matches.setdefault(model_str(found.id), (found, prefix))
        if len(matches) > 1:
            logger.debug("Skipping Hex table reference %s: it matches %d tables", table, len(matches))
        return next(iter(matches.values())) if len(matches) == 1 else None

    def _search_tables(self, fqn_search_string: str) -> list[Table]:
        """
        es_search_from_fqn turns a failed search into None, the same as no match, so
        the search runs here: a search that didn't answer is not a table that isn't there
        """
        query_string = self.metadata.fqdn_search.format(
            field_name="fullyQualifiedName",
            field_value=fqn.prefix_entity_for_wildcard_search(entity_type=Table, fqn=fqn_search_string),
            from_=0,
            size=10,
            index=ES_INDEX_MAP[Table.__name__],
        )
        try:
            response = self.metadata.client.get(query_string)
        except Exception as exc:
            raise TableSearchError(f"searching {fqn_search_string}: {exc}") from exc
        if not isinstance(response, dict) or "hits" not in response:
            raise TableSearchError(f"searching {fqn_search_string}: no search response")
        try:
            tables = [
                self.metadata.get_by_name(entity=Table, fqn=hit["_source"]["fullyQualifiedName"])
                for hit in response["hits"]["hits"]
            ]
        except Exception as exc:
            raise TableSearchError(f"reading the tables found for {fqn_search_string}: {exc}") from exc
        return [table for table in tables if table is not None]

    @staticmethod
    def _unique_column_name(name: str, taken: set[str]) -> str:
        name = truncate_column_name(INVALID_COLUMN_NAME_CHARS.sub("_", name))
        unique, suffix = name, 1
        while unique in taken:
            suffix += 1
            unique = f"{name}_{suffix}"
        taken.add(unique)
        return unique

    def _get_data_connections(self) -> dict[str, DataConnection] | None:
        """
        Fetched once per run: the workspace's connections, a short list. A failed fetch
        is retried for the next project; one the token isn't allowed isn't.
        """
        if self._data_connections is None and not self._data_connections_denied:
            try:
                self._data_connections = self.client.get_data_connections()
            except HexAccessDeniedError as exc:
                logger.warning("%s; Hex data models are only created, not updated, until it can", exc)
                self._data_connections_denied = True
        return self._data_connections

    def _build_fqn(self, entity_type: type[Dashboard] | type[DashboardDataModel], project: Project) -> str:
        # fqn.build is only None for entity types that need a search; these two never do
        if entity_type is DashboardDataModel:
            return fqn.build(  # pyright: ignore[reportReturnType]
                self.metadata,
                entity_type=DashboardDataModel,
                service_name=self.config.serviceName,
                data_model_name=project.id,
            )
        return fqn.build(  # pyright: ignore[reportReturnType]
            self.metadata,
            entity_type=Dashboard,
            service_name=self.config.serviceName,
            dashboard_name=project.id,
        )


def _output_column(column: HexCellColumn) -> Column:
    """A column passed straight through keeps its table column's type, with its element type and fields"""
    source = column.passthrough
    if source is None:
        return Column(name=ColumnName(column.name), dataType=DataType.UNKNOWN)
    return Column(
        name=ColumnName(column.name),
        dataType=source.dataType,
        dataTypeDisplay=source.dataTypeDisplay,
        arrayDataType=source.arrayDataType,
        children=[_without_fqns(child) for child in source.children] if source.children else None,
    )


def _without_fqns(column: Column) -> Column:
    """A column to send again: the server names it where it lands"""
    return column.model_copy(
        update={
            "fullyQualifiedName": None,
            "children": [_without_fqns(child) for child in column.children] if column.children else column.children,
        }
    )
