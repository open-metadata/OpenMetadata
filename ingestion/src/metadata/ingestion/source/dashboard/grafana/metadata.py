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
Grafana source module
"""
import traceback
from typing import Dict, Iterable, List, Optional, Set

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.grafanaConnection import (
    GrafanaConnection,
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
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.grafana.client import GrafanaApiClient
from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboardResponse,
    GrafanaDatasource,
    GrafanaFolder,
    GrafanaPanel,
    GrafanaSearchResult,
    GrafanaTarget,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_tag_labels

logger = ingestion_logger()

GRAFANA_TAG_CATEGORY = "GrafanaTags"


class GrafanaSource(DashboardServiceSource):
    """
    Grafana Source Class
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.client: GrafanaApiClient = self.connection_obj
        self.folders: List[GrafanaFolder] = []
        self.datasources: Dict[str, GrafanaDatasource] = {}
        self.dashboards: List[GrafanaSearchResult] = []
        self.tags: Set[str] = set()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GrafanaConnection = config.serviceConnection.root.config
        if not isinstance(connection, GrafanaConnection):
            raise InvalidSourceException(
                f"Expected GrafanaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Fetch the list of folders, dashboards, and datasources"""
        # Fetch all datasources
        datasources = self.client.get_datasources()
        # Key by both UID and name for flexibility
        self.datasources = {}
        for ds in datasources:
            self.datasources[ds.uid] = ds
            self.datasources[ds.name] = ds
        logger.info(f"Found {len(datasources)} datasources")

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """Get list of dashboards"""
        dashboards_list = self.client.search_dashboards()
        return dashboards_list

    def get_dashboard_name(self, dashboard: dict) -> str:
        """Get dashboard name"""
        return dashboard.uid

    def get_dashboard_details(
        self, dashboard: dict
    ) -> Optional[GrafanaDashboardResponse]:
        """Get detailed dashboard information"""
        try:
            return self.client.get_dashboard(dashboard.uid)
        except Exception as exc:
            logger.warning(
                f"Failed to get dashboard details for {dashboard['uid']}: {exc}"
            )
            return None

    def get_owner_ref(
        self, dashboard_details: GrafanaDashboardResponse
    ) -> Optional[EntityReferenceList]:
        """Get owner reference from dashboard metadata"""
        try:
            if dashboard_details.meta.createdBy:
                # Try to get user by email if available
                return self.metadata.get_reference_by_email(
                    dashboard_details.meta.createdBy
                )
        except Exception as err:
            logger.debug(f"Could not fetch owner data: {err}")
        return None

    def yield_dashboard(
        self, dashboard_details: GrafanaDashboardResponse
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """Method to Get Dashboard Entity"""
        try:
            dashboard_url = f"{clean_uri(self.service_connection.hostPort)}{dashboard_details.meta.url}"

            # Build folder hierarchy display name
            display_name = dashboard_details.dashboard.title

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.dashboard.uid),
                displayName=display_name,
                description=(
                    Markdown(dashboard_details.dashboard.description)
                    if dashboard_details.dashboard.description
                    else None
                ),
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
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(dashboard_url),
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=dashboard_details.dashboard.tags,
                    classification_name=GRAFANA_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
                owners=self.get_owner_ref(dashboard_details),
            )

            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error yielding dashboard {dashboard_details.dashboard.uid}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: GrafanaDashboardResponse
    ) -> Iterable[Either[CreateChartRequest]]:
        """Method to fetch charts (panels) linked to dashboard"""
        if not dashboard_details.dashboard.panels:
            return

        for panel in dashboard_details.dashboard.panels:
            try:
                # Skip row panels and panels without visualizations
                if panel.type in ["row", "text"]:
                    continue

                # We use the combination of dashboard UID and panel ID as the chart name,
                # to ensure uniqueness across all dashboards and panels,
                # since panel IDs are only unique within a dashboard, but not globally in Grafana.
                chart_name = f"{dashboard_details.dashboard.uid}_{panel.id}"
                chart_display_name = panel.title or f"Panel {panel.id}"

                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_display_name
                ):
                    self.status.filter(chart_display_name, "Chart filtered out")
                    continue

                # Map Grafana panel types to standard chart types
                chart_type = self._map_panel_type_to_chart_type(panel.type)

                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(chart_name),
                        displayName=chart_display_name,
                        description=(
                            Markdown(panel.description) if panel.description else None
                        ),
                        chartType=chart_type,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        sourceUrl=SourceUrl(
                            f"{clean_uri(self.service_connection.hostPort)}"
                            f"{dashboard_details.meta.url}?viewPanel={panel.id}"
                        ),
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error yielding chart for panel {panel.id}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: GrafanaDashboardResponse,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        if not dashboard_details.dashboard.panels:
            return

        try:
            to_fqn = fqn.build(
                self.metadata,
                entity_type=LineageDashboard,
                service_name=self.context.get().dashboard_service,
                dashboard_name=dashboard_details.dashboard.uid,
            )
            to_entity = self.metadata.get_by_name(
                entity=LineageDashboard,
                fqn=to_fqn,
            )

            if not to_entity:
                return

            # Extract lineage from panels
            for panel in dashboard_details.dashboard.panels:
                if not panel.targets:
                    continue

                for target in panel.targets:
                    yield from self._process_panel_lineage(
                        target=target,
                        panel=panel,
                        to_entity=to_entity,
                        db_service_prefix=db_service_prefix,
                    )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error extracting lineage: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _process_panel_lineage(
        self,
        target: GrafanaTarget,
        panel: GrafanaPanel,
        to_entity: LineageDashboard,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Process lineage for a single panel target"""
        try:
            # Get datasource information
            datasource_name = self._extract_datasource_name(target, panel)
            if not datasource_name:
                return

            datasource = self.datasources.get(datasource_name)
            if not datasource:
                return

            # Extract SQL query if available
            sql_query = self._extract_sql_query(target, datasource)
            if not sql_query:
                return

            # Parse db service prefix into components
            (
                prefix_service_name,
                prefix_database_name,
                prefix_schema_name,
                prefix_table_name,
            ) = self.parse_db_service_prefix(db_service_prefix)

            # Determine dialect. Prefer service type when service name is provided, else fallback to ANSI
            dialect = Dialect.ANSI
            try:
                if prefix_service_name:
                    db_service_entity = self.metadata.get_by_name(
                        entity=DatabaseService, fqn=prefix_service_name
                    )
                    if db_service_entity and db_service_entity.serviceType:
                        dialect = ConnectionTypeDialectMapper.dialect_of(
                            db_service_entity.serviceType.value
                        )
            except Exception:
                pass

            # Extract table references from the SQL
            parser = LineageParser(sql_query, dialect)
            database_name_hint = getattr(datasource, "database", None)

            for table in parser.source_tables or []:
                table_name_str = str(table)
                db_sch_table = fqn.split_table_name(table_name_str)
                database_name = db_sch_table.get("database") or database_name_hint
                schema_name = self.check_database_schema_name(
                    db_sch_table.get("database_schema")
                )
                base_table_name = db_sch_table.get("table")

                # Apply prefix filters when provided
                if (
                    prefix_database_name
                    and database_name
                    and prefix_database_name.lower() != str(database_name).lower()
                ):
                    continue
                if (
                    prefix_schema_name
                    and schema_name
                    and prefix_schema_name.lower() != str(schema_name).lower()
                ):
                    continue
                if (
                    prefix_table_name
                    and base_table_name
                    and prefix_table_name.lower() != str(base_table_name).lower()
                ):
                    continue

                # Build ES FQN search string and fetch matching table entities
                fqn_search_string = build_es_fqn_search_string(
                    database_name=prefix_database_name or database_name,
                    schema_name=prefix_schema_name or schema_name,
                    service_name=prefix_service_name or "*",
                    table_name=prefix_table_name or base_table_name,
                )

                from_entities = self.metadata.search_in_any_service(
                    entity_type=Table,
                    fqn_search_string=fqn_search_string,
                    fetch_multiple_entities=True,
                )

                for table_entity in from_entities or []:
                    lineage_request = DashboardServiceSource._get_add_lineage_request(
                        to_entity=to_entity,
                        from_entity=table_entity,
                        sql=sql_query,
                    )
                    if lineage_request:
                        yield lineage_request

        except Exception as exc:
            logger.debug(f"Error processing panel lineage: {exc}")
            logger.error(traceback.format_exc())

    def _extract_datasource_name(
        self, target: GrafanaTarget, panel: GrafanaPanel
    ) -> Optional[str]:
        """Extract datasource name from target or panel"""
        try:
            # Try target datasource first
            if target.datasource:
                if isinstance(target.datasource, str):
                    return target.datasource
                elif isinstance(target.datasource, dict):
                    return target.datasource.get("uid") or target.datasource.get("type")

            # Fall back to panel datasource
            if panel.datasource:
                if isinstance(panel.datasource, str):
                    return panel.datasource
                elif isinstance(panel.datasource, dict):
                    return panel.datasource.get("uid") or panel.datasource.get("type")

            return None
        except Exception as exc:
            logger.debug(f"Error extracting datasource name: {exc}")
            return None

    def _extract_sql_query(
        self, target: GrafanaTarget, datasource: GrafanaDatasource
    ) -> Optional[str]:
        """Extract SQL query from target based on datasource type"""
        try:
            # Handle different datasource types
            if datasource.type in [
                "mysql",
                "grafana-postgresql-datasource",
                "mssql",
                "clickhouse",
            ]:
                return target.rawSql or target.query
            elif datasource.type in ["prometheus", "elasticsearch"]:
                # Prometheus and Elasticsearch queries aren't SQL
                return None
            else:
                # Try generic query field
                return target.query
        except Exception as exc:
            logger.debug(f"Error extracting SQL query: {exc}")
            return None

    def _map_panel_type_to_chart_type(self, panel_type: str) -> str:
        """Map Grafana panel types to OpenMetadata chart types"""
        mapping = {
            "graph": "Line",
            "timeseries": "Line",
            "table": "Table",
            "stat": "Text",
            "gauge": "Gauge",
            "bargauge": "Bar",
            "bar": "Bar",
            "piechart": "Pie",
            "heatmap": "Heatmap",
            "histogram": "Histogram",
            "geomap": "Map",
            "nodeGraph": "Graph",
            "candlestick": "Other",
            "state-timeline": "Timeline",
            "status-history": "Timeline",
            "alertlist": "Table",
            "logs": "Table",
            "news": "Text",
            "text": "Text",
        }
        return get_standard_chart_type(mapping.get(panel_type, "Other"))
