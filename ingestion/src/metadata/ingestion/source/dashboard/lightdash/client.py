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
REST Auth & Client for Lightdash
"""
import traceback
from typing import List

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashDashboard,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()


class LightdashApiClient:
    """
    REST Auth & Client for Lightdash
    """

    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=str(self.config.hostPort),
            api_version="",
            access_token=self.config.apiKey.get_secret_value(),
            auth_header="Authorization",
            auth_token_mode="ApiKey",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def get_org(self):
        """GET api/org"""
        return self.client.get(
            "/api/v1/org",
        )

    def get_charts_list(self) -> List[LightdashChart]:
        """
        Get List of all charts
        """
        try:
            response = self.client.get(
                f"api/v1/projects/{self.config.projectUUID}/charts"
            )
            response_json_results = response.get("results")
            if response_json_results is None:
                logger.warning(
                    "Failed to fetch the charts list for the Lightdash Connector"
                )
                return []

            if len(response_json_results) > 0:
                charts_list = []
                for chart in response_json_results:
                    charts_list.append(LightdashChart(**chart))
                return charts_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to fetch the charts list for the Lightdash Connector"
            )
        return []

    def get_dashboards_list(self) -> List[LightdashDashboard]:
        """
        Get List of all charts
        """

        try:
            response = self.client.get(
                f"api/v1/projects/{self.config.projectUUID}/spaces/{self.config.spaceUUID}"
            )
            results = response.get("results")
            if results is None:
                logger.warning(
                    "Failed to fetch the dashboard list for the Lightdash Connector"
                )
                return []

            dashboards_raw = results["dashboards"]

            if len(dashboards_raw) > 0:
                dashboards_list = []
                for dashboard in dashboards_raw:
                    dashboards_list.append(LightdashDashboard(**dashboard))

                self.add_dashboard_lineage(dashboards_list=dashboards_list)
                return dashboards_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to fetch the dashboard list for the Lightdash Connector"
            )
        return []

    def add_dashboard_lineage(self, dashboards_list) -> None:
        charts_uuid_list = []
        for dashboard in dashboards_list:
            response = self.client.get(f"api/v1/dashboards/{dashboard.uuid}")
            response_json_results = response.get("results")

            if response_json_results is None:
                logger.warning(
                    "Failed to fetch dashboard charts for the Lightdash Connector"
                )
                return

            charts = response_json_results["tiles"]
            charts_properties = [chart["properties"] for chart in charts]

            for chart in charts_properties:
                charts_uuid_list.append(chart["savedChartUuid"])

            dashboard.charts = self.get_charts_objects(charts_uuid_list)

    def get_charts_objects(self, charts_uuid_list) -> List[LightdashChart]:
        all_charts = self.get_charts_list()
        charts_objects = []

        for chart_uuid in charts_uuid_list:
            for chart in all_charts:
                if chart.uuid == chart_uuid:
                    charts_objects.append(chart)

        return charts_objects
