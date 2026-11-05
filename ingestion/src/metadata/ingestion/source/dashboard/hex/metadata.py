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
from collections.abc import Iterable
from datetime import datetime, timezone

from sqlglot import exp

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import (
    TableLookup,
    UnsupportedTableReferenceError,
    load_table_binding_resolution,
)
from metadata.entity_resolution.table_search import get_table_binding_resolution
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
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
    EntityExtension,
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    SqlQuery,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
    DashboardUsage,
)
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
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache

logger = ingestion_logger()

HEX_TAG_CATEGORY = "HexCategories"
# Distinct table references looked up per project; past it a reference is searched again
MAX_RESOLVED_TABLES = 1_000
COMPONENT_TYPE = "COMPONENT"
COMPLETED_RUN = "COMPLETED"
# Hex counts an app's views over this many days, as OpenMetadata's weekly usage does
APP_VIEWS_DAYS = 7
# Dashboard custom properties set from the project's app views and runs: name -> (type, description)
CUSTOM_PROPERTIES = {
    "appViewsLast7Days": (CustomPropertyDataTypes.INTEGER, "Views of the dashboard's app over the last 7 days"),
    "appViewsAllTime": (CustomPropertyDataTypes.INTEGER, "Views of the dashboard's app since it was published"),
    "lastRunStatus": (CustomPropertyDataTypes.STRING, "Status of the dashboard's most recent run"),
    "lastRunElapsedSeconds": (
        CustomPropertyDataTypes.INTEGER,
        "Seconds the dashboard's most recent run took",
    ),
    "lastRefreshed": (
        CustomPropertyDataTypes.TIMESTAMP,
        "When the dashboard's most recent successful run finished",
    ),
}


class TableSearchError(Exception):
    """The table search failed, so whether a table exists is unknown"""


INVALID_COLUMN_NAME_CHARS = re.compile(r'::|[>"\x00-\x1f]')


class HexSource(DashboardServiceSource):
    """
    Hex Source Class with direct warehouse query support for lineage
    """

    # The project whose imported but unlisted components keep their existing charts, with those charts' FQNs
    _kept_charts: tuple[str, list[str]] | None = None

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.projects = []  # We will populate this in `prepare`
        # The workspace's components by id, listed with the projects
        self.components: dict[str, Project] = {}
        self.today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Names of CUSTOM_PROPERTIES defined on dashboards, registered on first use
        self._custom_property_names: set[str] | None = None

        # Initialize lineage components
        self.hex_project_lineage: dict[str, HexProjectLineage] = {}

        # Initialize query fetcher for lineage
        self.query_fetcher = HexQueryFetcher(metadata=metadata, lookback_days=7)

        # Single slot: the data model and lineage stages of the same project share it
        self._cell_lineage: tuple[str, list[HexCellLineage] | None] | None = None
        # The project whose existing data model the data model stage left as it is
        self._kept_data_model: str | None = None
        self._data_connections: dict[str, DataConnection] | None = None
        self._data_connections_denied = False

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
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
        items = self.client.get_projects()
        self.components = {item.id: item for item in items if item.type == COMPONENT_TYPE}
        self.projects = [item for item in items if item.type != COMPONENT_TYPE]
        return self.projects

    def get_dashboard_name(self, dashboard: Project) -> str:
        """Get dashboard name"""
        return dashboard.title

    def get_dashboard_details(self, dashboard: Project) -> Project:
        """Get dashboard details - in Hex, we already have all details from list API"""
        return dashboard

    def get_owner_ref(self, dashboard_details: Project) -> EntityReferenceList | None:
        """
        Get owner from email
        """
        if not self.source_config.includeOwners:
            return None
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
            yield from self.yield_tag_definitions(
                tags=tags,
                classification_name=HEX_TAG_CATEGORY,
                tag_description="Hex Tag",
                classification_description="Tags associated with Hex projects",
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
                return self.get_tag_labels(
                    entity_fqn=fqn._build(vars(self.context.get())["dashboard_service"], dashboard_details.id),
                    tags=tags,
                    classification_name=HEX_TAG_CATEGORY,
                )

        return None

    def yield_dashboard(self, dashboard_details: Project) -> Iterable[Either[CreateDashboardRequest]]:
        """Method to Get Dashboard Entity"""
        try:
            source_url = self.client.get_project_url(dashboard_details)
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
                ]
                + [FullyQualifiedEntityName(kept) for kept in self._kept_chart_fqns(dashboard_details)],
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
                sourceUrl=SourceUrl(source_url) if source_url else None,
                tags=self._get_dashboard_tags(dashboard_details),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
                lifeCycle=_life_cycle(dashboard_details),
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
        db_service_prefix: str | None = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Table -> data model edges from the tables the project's SQL cells read, with column
        lineage, and from the ones only the warehouse query history names, without it.
        Table -> dashboard edges only when data models are off for the project.
        """
        cells = self._get_cell_lineage(dashboard_details) or []
        history_tables = self._history_only_tables(dashboard_details, cells)
        if not history_tables and not any(cell.tables for cell in cells):
            logger.debug(f"No lineage found for Hex project: {dashboard_details.id}")
            return
        try:
            target = self._lineage_target(dashboard_details)
            if not target:
                logger.warning("Lineage target for Hex project %s not found in OpenMetadata", dashboard_details.id)
                return
            yield from self._yield_cell_lineage(target, cells, db_service_prefix)
            for table in history_tables:
                lineage = self._get_add_lineage_request(to_entity=target, from_entity=table)
                if lineage:
                    yield lineage
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name="Dashboard Lineage",
                    error=f"Error building lineage for Hex project {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _history_only_tables(self, project: Project, cells: list[HexCellLineage]) -> list[Table]:
        """
        The tables the warehouse query history names that no cell resolved, e.g. one a cell
        reads by a bare name that matches several tables in OpenMetadata
        """
        resolved_by_cells = {table_id for cell in cells for table_id in cell.tables}
        project_lineage = self.hex_project_lineage.get(project.id)
        return [
            table
            for table in (project_lineage.upstream_tables if project_lineage else [])
            if table and table.id and model_str(table.id) not in resolved_by_cells
        ]

    def _lineage_target(self, project: Project) -> Dashboard | DashboardDataModel | None:
        # A filtered-out data model left from an earlier run is deleted by this one
        if self.source_config.includeDataModels and not filter_by_datamodel(
            self.source_config.dataModelFilterPattern, project.title
        ):
            return self.metadata.get_by_name(
                entity=DashboardDataModel, fqn=self._build_fqn(DashboardDataModel, project)
            )
        return self.metadata.get_by_name(entity=Dashboard, fqn=self._build_fqn(Dashboard, project))

    def yield_dashboard_chart(self, dashboard_details: Project) -> Iterable[Either[CreateChartRequest]]:
        """
        The components the project imports, as charts. A component imported by several
        projects is the same chart under each of their dashboards.
        """
        existing = None
        component_ids = self.client.get_component_ids(dashboard_details.id)
        if component_ids is None:
            # Unread is not gone: the charts the dashboard has keep their links and aren't deleted
            existing = component_ids = self._existing_chart_names(dashboard_details)
        self._keep_unlisted_charts(dashboard_details, component_ids, existing)
        for component_id in component_ids:
            component = self.components.get(component_id)
            if not component:
                continue
            if filter_by_chart(self.source_config.chartFilterPattern, component.title):
                self.status.filter(component.title, "Chart filtered out.")
                continue
            try:
                source_url = self.client.get_project_url(component)
                chart_request = CreateChartRequest(
                    name=EntityName(component.id),
                    displayName=component.title,
                    description=Markdown(component.description) if component.description else None,
                    chartType=ChartType.Other,
                    sourceUrl=SourceUrl(source_url) if source_url else None,
                    service=FullyQualifiedEntityName(self.context.get().dashboard_service),  # pyright: ignore[reportAttributeAccessIssue]
                    owners=self.get_owner_ref(component),
                    lifeCycle=_life_cycle(component),
                )
                yield Either(right=chart_request)  # pyright: ignore[reportCallIssue]
                self.register_record_chart(chart_request=chart_request)
            except Exception as exc:
                yield Either(  # pyright: ignore[reportCallIssue]
                    left=StackTraceError(
                        name=component.id,
                        error=f"Error yielding chart for Hex component {component.title}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _keep_unlisted_charts(self, project: Project, component_ids: list[str], existing: list[str] | None) -> None:
        """
        A component the project imports but the listing left out, as a failed listing page
        does, keeps the chart the dashboard already has for it, linked and not deleted
        """
        kept: list[str] = []
        unlisted = [component_id for component_id in component_ids if component_id not in self.components]
        if unlisted:
            logger.debug("Hex components %s imported by project %s are not listed", unlisted, project.id)
            existing = existing if existing is not None else self._existing_chart_names(project)
            # fqn.build is only None for entity types that need a search; a chart never does
            kept = [  # pyright: ignore[reportAssignmentType]
                fqn.build(
                    self.metadata,
                    entity_type=Chart,
                    service_name=self.context.get().dashboard_service,  # pyright: ignore[reportAttributeAccessIssue]
                    chart_name=component_id,
                )
                for component_id in unlisted
                if component_id in existing
            ]
            self.chart_source_state.update(kept)
        self._kept_charts = (project.id, kept)

    def _kept_chart_fqns(self, project: Project) -> list[str]:
        return self._kept_charts[1] if self._kept_charts and self._kept_charts[0] == project.id else []

    def _existing_chart_names(self, project: Project) -> list[str]:
        try:
            dashboard = self.metadata.get_by_name(
                entity=Dashboard, fqn=self._build_fqn(Dashboard, project), fields=["charts"]
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not look up the charts of Hex project %s: %s", project.id, exc)
            return []
        return [chart.name for chart in (dashboard.charts.root if dashboard and dashboard.charts else []) if chart.name]

    def yield_dashboard_usage(self, dashboard_details: Project) -> Iterable[Either[DashboardUsage]]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """
        Hex counts an app's views over the last seven days; OpenMetadata keeps a count per
        day and sums the last seven. Today gets what Hex counts beyond the six days before
        it, so the two weekly counts agree and a skipped run catches up. A usage PUT adds
        to the day's count, so only what today doesn't hold yet is sent: a second run on
        the same day sends nothing (ADR:2026-11-02-hex-daily-usage-follows-its-seven-day-app-views).
        """
        if not self.source_config.includeUsage:
            return
        analytics = dashboard_details.analytics
        week_views = analytics.appViews.lastSevenDays if analytics and analytics.appViews else None
        if week_views is None:
            return
        try:
            dashboard = self.metadata.get_by_name(entity=Dashboard, fqn=self._build_fqn(Dashboard, dashboard_details))
            if not dashboard:
                logger.debug("Dashboard of Hex project %s not found, skipping usage", dashboard_details.id)
                return
            daily = {
                model_str(day.date): day.dailyStats.count
                for day in self.metadata.get_dashboard_usage(dashboard, date=self.today, days=APP_VIEWS_DAYS)
            }
            today_views = daily.pop(self.today, None)
            views = max(0, week_views - sum(daily.values())) - (today_views or 0)
            # A zero still writes today's row: the dashboard's weekly count is read from its
            # latest row, so without one views that aged out would keep showing
            if views > 0 or today_views is None:
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=DashboardUsage(dashboard=dashboard, usage=UsageRequest(date=self.today, count=views))
                )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{dashboard_details.title} Usage",
                    error=f"Error computing usage of Hex project {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_extension(self, dashboard_details: Project) -> Iterable[Either[PatchRequest]]:
        """The app views of the project, and its runs when published: only published projects run"""
        if not self.source_config.includeCustomProperties:
            return
        try:
            names = self._get_custom_property_names()
            values = _view_properties(dashboard_details)
            if dashboard_details.lastPublishedAt:
                values.update(self._run_properties(dashboard_details.id))
            properties = {name: value for name, value in values.items() if name in names}
            if not properties:
                return
            dashboard = self.metadata.get_by_name(
                entity=Dashboard, fqn=self._build_fqn(Dashboard, dashboard_details), fields=["extension"]
            )
            if not dashboard:
                return
            stored = dashboard.extension.root if dashboard.extension else None
            # The properties a user set on the dashboard are sent back as they are, so the
            # patch only touches these; it never removes one
            yield Either(  # pyright: ignore[reportCallIssue]
                right=PatchRequest(
                    original_entity=dashboard,
                    new_entity=dashboard.model_copy(
                        update={"extension": EntityExtension({**(stored or {}), **properties})}
                    ),
                    override_metadata=True,
                )
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{dashboard_details.title} Custom Properties",
                    error=f"Error setting the custom properties of Hex project {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _run_properties(self, project_id: str) -> dict:
        """
        The most recent run's status and duration, and when the most recent successful
        one finished. Left out when unknown, so the patch keeps what the dashboard holds:
        a project failing every run keeps its last refresh.
        """
        latest = self.client.get_last_run(project_id)
        if not latest:
            return {}
        completed = (
            latest if latest.status == COMPLETED_RUN else self.client.get_last_run(project_id, status=COMPLETED_RUN)
        )
        refreshed = (completed.endTime or completed.startTime) if completed else None
        properties = {
            "lastRunStatus": latest.status,
            "lastRunElapsedSeconds": round(latest.elapsedTime / 1000) if latest.elapsedTime is not None else None,
            "lastRefreshed": _epoch_millis(refreshed) if refreshed else None,
        }
        return {name: value for name, value in properties.items() if value is not None}

    def _get_custom_property_names(self) -> set[str]:
        """
        The CUSTOM_PROPERTIES defined on dashboards, registering the missing ones once per run.
        A name another property already has with a different type is left alone: changing
        its type would invalidate the value every dashboard holds.
        """
        if self._custom_property_names is not None:
            return self._custom_property_names
        defined = {
            prop.get("name"): (prop.get("propertyType") or {}).get("name")
            for prop in self.metadata.get_entity_custom_properties(entity_type=Dashboard) or []
        }
        names = set()
        for name, (data_type, description) in CUSTOM_PROPERTIES.items():
            if name in defined:
                if defined[name] == data_type.value:
                    names.add(name)
                else:
                    logger.warning(
                        "Dashboard custom property %s exists as %s, not %s; Hex won't set it",
                        name,
                        defined[name],
                        data_type.value,
                    )
                continue
            try:
                self.metadata.create_or_update_custom_property(
                    OMetaCustomProperties(
                        entity_type=Dashboard,
                        createCustomPropertyRequest=CreateCustomPropertyRequest(
                            name=EntityName(name),
                            description=Markdown(description),
                            propertyType=self.metadata.get_property_type_ref(data_type),
                        ),
                    )
                )
                names.add(name)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Could not register dashboard custom property %s: %s", name, exc)
        self._custom_property_names = names
        return names

    def close(self):
        if self.source_config.includeUsage:
            self.metadata.compute_percentile(Dashboard, self.today)
        super().close()

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
            # A project without one still gets one, without columns, for the tables the
            # query history names, as lineage only links tables to the data model.
            if not self._history_only_tables(dashboard_details, []) or self._data_model_exists(dashboard_details):
                self._keep_data_model(dashboard_details)
                return
            cell_lineage = []
        try:
            columns = self._data_model_columns(dashboard_details, cell_lineage)
        except Exception as exc:
            # Without the earlier data model, the groups of the cells that failed would be lost
            logger.debug(traceback.format_exc())
            logger.warning("Could not read the data model of Hex project %s: %s", dashboard_details.id, exc)
            self._keep_data_model(dashboard_details)
            return
        # Tables read by cells that output no columns, or only named by the query history,
        # still need a data model to link to
        if not columns and not (
            any(cell.tables for cell in cell_lineage) or self._history_only_tables(dashboard_details, cell_lineage)
        ):
            self._keep_columnless_data_model(dashboard_details)
            return
        # A data model only the query history fills gets no SQL, even from cells that read
        # nothing resolvable: SQL marks one built from cells, see _keep_columnless_data_model
        cells = (
            [cell for cell in cell_lineage if not cell.failed]
            if columns or any(cell.tables for cell in cell_lineage)
            else []
        )
        try:
            source_url = self.client.get_project_url(dashboard_details)
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.title,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),  # pyright: ignore[reportAttributeAccessIssue]
                dataModelType=DataModelType.HexDataModel,
                serviceType=self.service_connection.type.value,
                sourceUrl=SourceUrl(source_url) if source_url else None,
                sql=SqlQuery("\n\n".join(f"-- {cell.label}\n{cell.sql}" for cell in cells)) if cells else None,
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

    def _keep_columnless_data_model(self, project: Project) -> None:
        """
        A data model without columns and SQL only links tables the query history named: one
        whose tables fell out of the history's lookback window is kept, with its lineage. One
        with SQL came from cells, which are read each run, so it goes when they do.
        """
        try:
            data_model = self.metadata.get_by_name(
                entity=DashboardDataModel, fqn=self._build_fqn(DashboardDataModel, project), fields=["columns"]
            )
        except Exception as exc:
            # A lookup that fails is not a data model that isn't there
            logger.debug(traceback.format_exc())
            logger.warning("Could not look up the data model of Hex project %s: %s", project.id, exc)
            self._keep_data_model(project)
            return
        if data_model and not data_model.columns and not data_model.sql:
            self._keep_data_model(project)

    def _keep_data_model(self, project: Project) -> None:
        self._kept_data_model = project.id
        self.datamodel_source_state.add(self._build_fqn(DashboardDataModel, project))

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
        target: Dashboard | DashboardDataModel,
        cells: list[HexCellLineage],
        db_service_prefix: str | None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Only the tables found under this prefix, as this runs once per db service prefix.
        Column lineage only reaches a data model's columns.
        """
        to_columns = {
            (model_str(column.name), model_str(child.name)): model_str(child.fullyQualifiedName)
            for column in (target.columns or [] if isinstance(target, DashboardDataModel) else [])
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
        The data model an earlier run created that the data model stage left as it is,
        so the dashboard stays linked to it. None when it can't be confirmed: linking a
        data model that doesn't exist would fail the dashboard.
        """
        if self._kept_data_model != project.id:
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
                if cell.resultVariableName:
                    upstream.fail(cell.resultVariableName, cell.dataConnectionId)
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
        # Without the cell it reads this one would lose its columns and their lineage,
        # so it fails too and keeps its existing group
        failed = upstream.failed_readable_by(cell.dataConnectionId)
        if failed and (
            read := {table.name.lower() for table in get_table_references(expression) if not table.db} & failed
        ):
            raise ValueError(f"it reads {', '.join(sorted(read))}, whose SQL failed")
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
            if "*" in reference.name:
                self._add_wildcard_tables(
                    lineage, searched_database, searched_schema, reference.name, connection.type if connection else None
                )
                reference.meta[UNRESOLVED] = True
                continue
            if key not in resolved_tables:
                resolved_tables.put(
                    key,
                    self._resolve_table(
                        searched_database, searched_schema, reference.name, connection.type if connection else None
                    ),
                )
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

    def _resolve_reference(
        self,
        database: str | None,
        schema: str | None,
        table: str,
        service: str | None,
        connection_type: str | None,
    ) -> tuple[Table, ...]:
        try:
            resolution = (
                get_table_binding_resolution(self.metadata, service)
                if service
                else load_table_binding_resolution(connection_type, self.metadata)
            )
            return resolution.resolve(
                TableReference(database, schema, table), service_name=service, lookup=TableLookup.SEARCH
            )
        except UnsupportedTableReferenceError as exc:
            logger.debug("Skipping unsupported Hex table reference %s: %s", table, exc)
            return ()
        except Exception as exc:
            raise TableSearchError(f"searching table reference {table}: {exc}") from exc

    def _add_wildcard_tables(
        self,
        lineage: HexCellLineage,
        searched_database: str | None,
        searched_schema: str | None,
        table_name: str,
        connection_type: str | None = None,
    ) -> None:
        for prefix in self.get_db_service_prefixes() or [None]:
            service, database, schema, table = self.parse_db_service_prefix(prefix)
            if not (searched_schema or schema):
                continue
            if any(
                expected and actual and expected.lower() != actual.lower()
                for expected, actual in ((database, searched_database), (schema, searched_schema), (table, table_name))
            ):
                continue
            matches = self._resolve_reference(
                searched_database or database, searched_schema or schema, table_name, service, connection_type
            )
            scopes = {tuple(fqn.split(model_str(match.fullyQualifiedName))[:-1]) for match in matches}
            if not service and len(scopes) > 1:
                continue
            for match in matches:
                lineage.tables[model_str(match.id)] = (match, prefix)

    def _resolve_table(
        self, database: str | None, schema: str | None, table: str, connection_type: str | None = None
    ) -> tuple[Table, str | None] | None:
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
            found_tables = self._resolve_reference(
                database or prefix_database, schema or prefix_schema, table, service, connection_type
            )
            for found in found_tables:
                matches.setdefault(model_str(found.id), (found, prefix))
        if len(matches) > 1:
            logger.debug("Skipping Hex table reference %s: it matches %d tables", table, len(matches))
        return next(iter(matches.values())) if len(matches) == 1 else None

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


def _epoch_millis(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)


def _view_properties(project: Project) -> dict:
    app_views = project.analytics.appViews if project.analytics else None
    if not app_views:
        return {}
    properties = {"appViewsLast7Days": app_views.lastSevenDays, "appViewsAllTime": app_views.allTime}
    return {name: value for name, value in properties.items() if value is not None}


def _life_cycle(item: Project) -> LifeCycle | None:
    """Created, last refreshed (its published results updated) and last viewed"""
    analytics = item.analytics
    moments = {
        "created": item.createdAt,
        "updated": analytics.publishedResultsUpdatedAt if analytics else None,
        "accessed": analytics.lastViewedAt if analytics else None,
    }
    if not any(moments.values()):
        return None
    return LifeCycle(
        **{
            aspect: AccessDetails(timestamp=Timestamp(_epoch_millis(moment)))
            for aspect, moment in moments.items()
            if moment
        }
    )


def _output_column(column: HexCellColumn) -> Column:
    source = column.passthrough
    if source is None:
        return Column(name=ColumnName(column.name), dataType=DataType.UNKNOWN)
    return _type_of(source, ColumnName(column.name))


def _type_of(source: Column, name: ColumnName) -> Column:
    """
    A column passed straight through keeps its table column's type, with its element
    type and fields, but none of the table's descriptions, tags or profile
    """
    return Column(
        name=name,
        dataType=source.dataType,
        dataTypeDisplay=source.dataTypeDisplay,
        arrayDataType=source.arrayDataType,
        children=[_type_of(child, child.name) for child in source.children] if source.children else None,
    )


def _without_fqns(column: Column) -> Column:
    """A column to send again: the server names it where it lands"""
    return column.model_copy(
        update={
            "fullyQualifiedName": None,
            "children": [_without_fqns(child) for child in column.children] if column.children else column.children,
        }
    )
