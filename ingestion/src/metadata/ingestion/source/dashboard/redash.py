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

import uuid
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

import requests

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.dashboard.redashConnection import (
    RedashConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart as ModelChart
from metadata.ingestion.models.table_metadata import Dashboard
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class RedashSourceStatus(SourceStatus):
    items_scanned: int = 0
    filtered: List[str] = field(default_factory=list)

    def item_scanned_status(self) -> None:
        self.items_scanned += 1

    def item_dropped_status(self, item: str) -> None:
        self.filtered.append(item)


class RedashSource(DashboardSourceService):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: RedashSourceStatus
    platform = "redash"
    dashboards_to_charts: Dict[str, List[str]]

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.status = RedashSourceStatus()
        self.dashboards_to_charts = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedashConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedashConnection):
            raise InvalidSourceException(
                f"Expected RedashConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        dashboard_info = self.client.dashboards()
        return dashboard_info["results"]

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details["id"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def get_dashboard_entity(self, dashboard_details: dict) -> Dashboard:
        """
        Method to Get Dashboard Entity
        """
        yield from self.fetch_dashboard_charts(dashboard_details)
        dashboard_id = dashboard_details["id"]
        if dashboard_id is not None:
            self.status.item_scanned_status()
            dashboard_data = self.client.get_dashboard(dashboard_id)
            dashboard_url = f"{self.service_connection.hostPort}/dashboard/{dashboard_data.get('slug', '')}"
            dashboard_description = ""
            for widgets in dashboard_data.get("widgets", []):
                dashboard_description = widgets.get("text")
            yield Dashboard(
                id=uuid.uuid4(),
                name=dashboard_id,
                displayName=dashboard_details["name"],
                description=dashboard_description if dashboard_details else "",
                charts=self.dashboards_to_charts[dashboard_id],
                usageSummary=None,
                service=EntityReference(id=self.service.id, type="dashboardService"),
                url=dashboard_url,
            )

    def get_lineage(self, dashboard_details: dict) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """
        logger.info("Lineage not implemented for redash")

    def process_charts(self) -> Optional[Iterable[Chart]]:
        """
        Metod to fetch Charts
        """
        query_info = self.client.queries()
        for query_info in query_info["results"]:
            query_id = query_info["id"]
            query_name = query_info["name"]
            query_data = requests.get(
                f"{self.service_connection.hostPort}/api/queries/{query_id}"
            ).json()
            for visualization in query_data.get("Visualizations", []):
                chart_type = visualization.get("type", "")
                chart_description = (
                    visualization.get("description", "")
                    if visualization.get("description", "")
                    else ""
                )
                yield Chart(
                    id=uuid.uuid4(),
                    name=query_id,
                    displayName=query_name,
                    chartType=chart_type,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                    description=chart_description,
                )

    def fetch_dashboard_charts(self, dashboard: dict) -> Optional[Iterable[Chart]]:
        """
        Metod to fetch charts linked to dashboard
        """
        dashboard_id = dashboard["id"]
        if dashboard_id is not None:
            dashboard_data = self.client.get_dashboard(dashboard_id)
            self.dashboards_to_charts[dashboard_id] = []
            for widgets in dashboard_data.get("widgets", []):
                visualization = widgets.get("visualization")
                self.dashboards_to_charts[dashboard_id].append(widgets["id"])
                yield ModelChart(
                    name=widgets["id"],
                    displayName=visualization["query"]["name"]
                    if visualization and visualization["query"]
                    else "",
                    chart_type=visualization["type"] if visualization else "",
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                    url=(
                        f"{self.service_connection.hostPort}/dashboard/{dashboard_data.get('slug', '')}"
                    ),
                    description=visualization["description"] if visualization else "",
                )

    def close(self):
        self.client.session.close()
