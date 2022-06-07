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
"""Metabase source module"""

import traceback
import uuid
from typing import Iterable, List, Optional

import requests

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
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
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils import fqn
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import replace_special_with
from metadata.utils.logger import ingestion_logger

HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}

logger = ingestion_logger()


class MetabaseSource(DashboardSourceService):
    """Metabase entity class

    Args:
        config:
        metadata_config:
    Attributes:
        config:
        metadata_config:
        status:
        metabase_session:
        dashboard_service:
        charts:
        metric_charts:
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: SQLSourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        params = dict()
        params["username"] = self.service_connection.username
        params["password"] = self.service_connection.password.get_secret_value()
        self.connection = get_connection(self.service_connection)
        self.metabase_session = self.connection.client["metabase_session"]
        self.charts = []
        self.metric_charts = []

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Instantiate object

        Args:
            config_dict:
            metadata_config:
        Returns:
            MetabaseSource
        """
        config = WorkflowSource.parse_obj(config_dict)
        connection: MetabaseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MetabaseConnection):
            raise InvalidSourceException(
                f"Expected MetabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            return resp_dashboards.json()
        return []

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        resp_dashboard = self.req_get(f"/api/dashboard/{dashboard['id']}")
        return resp_dashboard.json()

    def get_dashboard_entity(self, dashboard_details: dict) -> Dashboard:
        """
        Method to Get Dashboard Entity
        """
        dashboard_url = (
            f"/dashboard/{dashboard_details['id']}-"
            f"{replace_special_with(raw=dashboard_details['name'].lower(), replacement='-')}"
        )

        yield from self.fetch_dashboard_charts(dashboard_details)
        yield Dashboard(
            id=uuid.uuid4(),
            name=dashboard_details["name"],
            url=dashboard_url,
            displayName=dashboard_details["name"],
            description=dashboard_details["description"]
            if dashboard_details["description"] is not None
            else "",
            charts=self.charts,
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def fetch_dashboard_charts(self, dashboard_details: dict) -> Iterable[Chart]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        charts = dashboard_details["ordered_cards"]
        for chart in charts:
            try:
                chart_details = chart["card"]

                chart_url = (
                    f"/question/{chart_details['id']}-"
                    f"{replace_special_with(raw=chart_details['name'].lower(), replacement='-')}"
                )

                if not ("name" in chart_details):
                    continue
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_details["name"]
                ):
                    self.status.filter(
                        chart_details["name"], "Chart Pattern not allowed"
                    )
                    continue
                yield Chart(
                    id=uuid.uuid4(),
                    name=chart_details["name"],
                    displayName=chart_details["name"],
                    description=chart_details["description"]
                    if chart_details["description"] is not None
                    else "",
                    chart_type=str(chart_details["display"]),
                    url=chart_url,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                )
                self.charts.append(chart_details["name"])
                self.status.scanned(chart_details["name"])
            except Exception as err:  # pylint: disable=broad-except
                logger.error(repr(err))
                logger.debug(traceback.format_exc())
                continue

    def get_lineage(self, dashboard_details: dict) -> AddLineageRequest:
        """Get lineage method

        Args:
            dashboard_details
        """
        chart_list, dashboard_name = (
            dashboard_details["ordered_cards"],
            dashboard_details["name"],
        )
        for chart in chart_list:
            try:
                chart_details = chart["card"]
                if not chart_details.get("table_id"):
                    continue
                resp_tables = self.req_get(f"/api/table/{chart_details['table_id']}")
                if resp_tables.status_code == 200:
                    table = resp_tables.json()
                    from_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.source_config.dbServiceName,
                        database_name=table["db"]["details"]["db"],
                        schema_name=table.get("schema"),
                        table_name=table.get("display_name"),
                    )
                    from_entity = self.metadata.get_by_name(
                        entity=Table,
                        fqn=from_fqn,
                    )
                    to_fqn = fqn.build(
                        self.metadata,
                        entity_type=LineageDashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=dashboard_name,
                    )
                    to_entity = self.metadata.get_by_name(
                        entity=LineageDashboard,
                        fqn=to_fqn,
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
            except Exception as err:  # pylint: disable=broad-except,unused-variable
                logger.debug(traceback.format_exc())
                logger.error(err)

    def req_get(self, path):
        """Send get request method

        Args:
            path:
        """
        return requests.get(
            self.service_connection.hostPort + path, headers=self.metabase_session
        )

    def get_card_detail(self, card_list):
        # TODO: Need to handle card lineage
        metadata = OpenMetadata(self.metadata_config)
        for card in card_list:
            try:
                card_details = card["card"]
                if not card_details.get("id"):
                    continue
                card_detail_resp = self.req_get(f"/api/card/{card_details['id']}")
                if card_detail_resp.status_code == 200:
                    raw_query = (
                        card_details.get("dataset_query", {})
                        .get("native", {})
                        .get("query", "")
                    )
            except Exception as e:
                logger.error(repr(e))

    def get_cards(self):
        """Get cards method"""
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            for dashboard in resp_dashboards.json():
                resp_dashboard = self.req_get(f"/api/dashboard/{dashboard['id']}")
                dashboard_details = resp_dashboard.json()
                card_list = dashboard_details["ordered_cards"]
                self.get_card_detail(card_list)
