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
"""
Superset source module
"""

import json
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as Lineage_Dashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_metric_name(metric):
    """
    Get metric name

    Args:
        metric:
    Returns:
    """
    if not metric:
        return ""
    if isinstance(metric, str):
        return metric
    label = metric.get("label")

    return label or None


def get_filter_name(filter_obj):
    """
    Get filter name

    Args:
        filter_obj:

    Returns:
        str
    """
    sql_expression = filter_obj.get("sqlExpression")
    if sql_expression:
        return sql_expression

    clause = filter_obj.get("clause")
    column = filter_obj.get("subject")
    operator = filter_obj.get("operator")
    comparator = filter_obj.get("comparator")
    return f"{clause} {column} {operator} {comparator}"


class SupersetSource(DashboardServiceSource):
    """
    Superset Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: SourceStatus
    platform = "superset"
    service_type = DashboardServiceType.Superset.value

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.all_charts = {}
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: SupersetConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SupersetConnection):
            raise InvalidSourceException(
                f"Expected SupersetConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        """
        Fetching all charts available in superset
        this step is done because fetch_total_charts api fetches all
        the required information which is not available in fetch_charts_with_id api
        """
        current_page = 0
        page_size = 25
        total_charts = self.client.fetch_total_charts()
        while current_page * page_size <= total_charts:
            charts = self.client.fetch_charts(current_page, page_size)
            current_page += 1
            for index in range(len(charts["result"])):
                self.all_charts[charts["ids"][index]] = charts["result"][index]

    def get_dashboards_list(self) -> Optional[List[object]]:
        """
        Get List of all dashboards
        """
        current_page = 0
        page_size = 25
        total_dashboards = self.client.fetch_total_dashboards()
        while current_page * page_size <= total_dashboards:
            dashboards = self.client.fetch_dashboards(current_page, page_size)
            current_page += 1
            for dashboard in dashboards["result"]:
                yield dashboard

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["dashboard_title"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def get_owner_details(self, dashboard_details: dict) -> EntityReference:
        if dashboard_details.get("owners"):
            owner = dashboard_details["owners"][0]
            user = self.metadata.get_user_by_email(owner.get("email"))
            if user:
                return EntityReference(id=user.id.__root__, type="user")
        return None

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        yield CreateDashboardRequest(
            name=dashboard_details["id"],
            displayName=dashboard_details["dashboard_title"],
            description="",
            dashboardUrl=dashboard_details["url"],
            owner=self.get_owner_details(dashboard_details),
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def _get_charts_of_dashboard(self, dashboard_details: dict) -> List[str]:
        """
        Method to fetch chart ids linked to dashboard
        """
        raw_position_data = dashboard_details.get("position_json", {})
        if raw_position_data:
            position_data = json.loads(raw_position_data)
            return [
                value.get("meta", {}).get("chartId")
                for key, value in position_data.items()
                if key.startswith("CHART-") and value.get("meta", {}).get("chartId")
            ]
        return []

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        for chart_id in self._get_charts_of_dashboard(dashboard_details):
            chart_json = self.all_charts.get(chart_id)
            if chart_json:
                datasource_fqn = (
                    self._get_datasource_fqn(
                        chart_json.get("datasource_id"), db_service_name
                    )
                    if chart_json.get("datasource_id")
                    else None
                )
                if not datasource_fqn:
                    continue
                from_entity = self.metadata.get_by_name(
                    entity=Table,
                    fqn=datasource_fqn,
                )
                try:
                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Lineage_Dashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=str(dashboard_details["id"]),
                    )
                    to_entity = self.metadata.get_by_name(
                        entity=Lineage_Dashboard,
                        fqn=dashboard_fqn,
                    )
                    if from_entity and to_entity:
                        yield self._get_add_lineage_request(
                            to_entity=to_entity, from_entity=from_entity
                        )
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
                    )

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Metod to fetch charts linked to dashboard
        """
        for chart_id in self._get_charts_of_dashboard(dashboard_details):
            chart_json = self.all_charts.get(chart_id)
            if not chart_json:
                logger.warning(f"chart details for id: {chart_id} not found, skipped")
                continue
            chart = CreateChartRequest(
                name=chart_json["id"],
                displayName=chart_json.get("slice_name"),
                description="",
                chartType=get_standard_chart_type(
                    chart_json.get("viz_type", ChartType.Other.value)
                ),
                chartUrl=chart_json.get("url"),
                service=EntityReference(
                    id=self.context.dashboard_service.id.__root__,
                    type="dashboardService",
                ),
            )
            yield chart

    def _get_datasource_fqn(
        self, datasource_id: str, db_service_name: str
    ) -> Optional[str]:
        if db_service_name:
            try:
                datasource_json = self.client.fetch_datasource(datasource_id)
                database_json = self.client.fetch_database(
                    datasource_json["result"]["database"]["id"]
                )
                dataset_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    table_name=datasource_json["result"]["table_name"],
                    schema_name=datasource_json["result"]["schema"],
                    database_name=database_json["result"]["parameters"]["database"],
                    service_name=db_service_name,
                )
                return dataset_fqn
            except KeyError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to fetch Datasource with id [{datasource_id}]: {err}"
                )
        return None
