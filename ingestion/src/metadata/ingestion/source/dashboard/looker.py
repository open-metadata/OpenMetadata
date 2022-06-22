#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import traceback
from typing import Any, Iterable, List, Optional, Set

from looker_sdk.error import SDKError
from looker_sdk.sdk.api31.models import Query
from looker_sdk.sdk.api40.models import LookmlModelExplore, DashboardBase
from looker_sdk.sdk.api40.models import Dashboard as LookerDashboard

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_chart_entities_from_id, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LookerSource(DashboardServiceSource):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: LookerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, LookerConnection):
            raise InvalidSourceException(
                f"Expected LookerConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[DashboardBase]]:
        """
        Get List of all dashboards
        """
        return self.client.all_dashboards(fields="id")

    def get_dashboard_name(self, dashboard_details: DashboardBase) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details.id

    def get_dashboard_details(self, dashboard: DashboardBase) -> LookerDashboard:
        """
        Get Dashboard Details
        """
        fields = [
            "id",
            "title",
            "dashboard_elements",
            "dashboard_filters",
            "view_count",
            "description",
            "folder",
        ]
        return self.client.dashboard(dashboard_id=dashboard.id, fields=",".join(fields))

    def get_dashboard_entity(self, dashboard_details: LookerDashboard) -> CreateDashboardRequest:
        """
        Method to Get Dashboard Entity
        """
        print("DASHBOARD")
        print(dashboard_details.title)
        yield CreateDashboardRequest(
            name=dashboard_details.id,
            displayName=dashboard_details.title,
            description=dashboard_details.description or "",
            charts=get_chart_entities_from_id(
                chart_ids=[chart.id for chart in self.charts],
                metadata=self.metadata,
                service_name=self.config.serviceName,
            ),
            dashboardUrl=f"/dashboards/{dashboard_details.id}",
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    @staticmethod
    def _clean_table_name(table_name: str) -> str:
        """
        sql_table_names might be renamed when defining
        an explore. E.g., customers as cust
        :param table_name: explore table name
        :return: clean table name
        """

        return table_name.lower().split("as")[0].strip()

    def _add_sql_table(self, query: Query, dashboard_sources: Set[str]):
        """
        Add the SQL table information to the dashboard_sources.

        Updates the seen dashboards.

        :param query: Looker query, from a look or result_maker
        :param dashboard_sources: seen tables so far
        """
        try:
            explore: LookmlModelExplore = self.client.lookml_model_explore(
                query.model, query.view
            )
            table_name = explore.sql_table_name

            if table_name:
                dashboard_sources.add(self._clean_table_name(table_name))

        except SDKError as err:
            logger.error(
                f"Cannot get explore from model={query.model}, view={query.view} - {err}"
            )

    def get_dashboard_sources(self) -> Set[str]:
        """
        Set of source tables to build lineage for the processed dashboard
        """
        dashboard_sources: Set[str] = set()

        for chart in self.charts:
            if chart.query and chart.query.view:
                self._add_sql_table(chart.query, dashboard_sources)
            if chart.look and chart.look.query and chart.look.query.view:
                self._add_sql_table(chart.look.query, dashboard_sources)
            if (
                chart.result_maker
                and chart.result_maker.query
                and chart.result_maker.query.view
            ):
                self._add_sql_table(chart.result_maker.query, dashboard_sources)

        return dashboard_sources

    def get_lineage(self, dashboard_details: LookerDashboard) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between charts and data sources.

        We look at:
        - chart.query
        - chart.look (chart.look.query)
        - chart.result_maker
        """
        datasource_list = self.get_dashboard_sources()

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_details.id,
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )

        for source in datasource_list:
            try:
                source_elements = fqn.split_table_name(table_name=source)

                print(f"FOUND THE FOLLOWING SOURCES {source_elements}")

                from_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.source_config.dbServiceName,
                    database_name=source_elements["database"],
                    schema_name=source_elements["database_schema"],
                    table_name=source_elements["table"],
                )
                from_entity = self.metadata.get_by_name(
                    entity=Table,
                    fqn=from_fqn,
                )

                if from_entity and to_entity:
                    lineage = AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id.__root__, type="table"
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id.__root__, type="dashboard"
                            ),
                        )
                    )
                    yield lineage

            except (Exception, IndexError) as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error building lineage - {err}")

    def fetch_dashboard_charts(
        self, dashboard_details: LookerDashboard
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Metod to fetch charts linked to dashboard
        """
        self.charts = []
        for dashboard_elements in dashboard_details.dashboard_elements:
            try:
                if filter_by_chart(
                    chart_filter_pattern=self.source_config.chartFilterPattern,
                    chart_name=dashboard_elements.id,
                ):
                    self.status.filter(dashboard_elements.id, "Chart filtered out")
                    continue
                om_dashboard_elements = CreateChartRequest(
                    name=dashboard_elements.id,
                    displayName=dashboard_elements.title or dashboard_elements.id,
                    description="",
                    chartType=get_standard_chart_type(dashboard_elements.type).value,
                    chartUrl=f"/dashboard_elements/{dashboard_elements.id}",
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                )
                if not dashboard_elements.id:
                    raise ValueError("Chart(Dashboard Element) without ID")
                self.status.scanned(dashboard_elements.id)
                yield om_dashboard_elements
                # Store the whole chart to pick up lineage info
                self.charts.append(dashboard_elements)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)
