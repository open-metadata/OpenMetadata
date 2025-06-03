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
REST Auth & Client for Lightdash
"""
import traceback
from typing import List

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashDashboard,
    LightdashSpace,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()


class LightdashApiClient:
    """
    REST Auth & Client for Lightdash
    API Documentation: https://docs.lightdash.com/api-reference/v1
    """

    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
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

    def get_spaces(self) -> List[LightdashSpace]:
        """GET Lightdash Spaces within the project"""
        try:
            response = self.client.get(
                f"api/v1/projects/{self.config.projectUUID}/spaces"
            )
            response_json_results = response.get("results")
            if response_json_results is None:
                logger.warning(
                    "Failed to fetch the spaces list for the Lightdash Connector"
                )
                return []

            if len(response_json_results) > 0:
                spaces_list = []
                for space in response_json_results:
                    spaces_list.append(LightdashSpace(**space))
                return spaces_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to fetch the spaces list for the Lightdash Connector"
            )
        return []

    def get_project_name(self, project_uuid: str) -> str:
        """GET project name"""
        try:
            response = self.client.get(f"api/v1/projects/{project_uuid}")
            response_json_results = response.get("results")
            return response_json_results["name"]
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to fetch the project data from the Lightdash Connector"
            )
            return ""

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

            space_name = results["name"]
            dashboards_raw = results["dashboards"]

            if len(dashboards_raw) > 0:
                dashboards_list = []
                for dashboard in dashboards_raw:
                    dashboards_list.append(
                        LightdashDashboard(**dashboard, spaceName=space_name)
                    )

                self.add_dashboard_lineage(dashboards_list=dashboards_list)
                return dashboards_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to fetch the dashboard list for the Lightdash Connector"
            )
        return []

    def add_dashboard_lineage(self, dashboards_list: List[LightdashDashboard]) -> None:
        """
        Get Lineage of all dashboard charts
        """
        for dashboard in dashboards_list:
            response = self.client.get(f"api/v1/dashboards/{dashboard.uuid}")
            response_json_results = response.get("results")

            if response_json_results is None:
                logger.warning(
                    "Failed to fetch dashboard charts for the Lightdash Connector"
                )
                return

            charts = response_json_results["tiles"]
            # Lightdash has title, loom & markdown chart types which we want to ignore
            accepted_chart_types = ["saved_chart", "sql_chart", "semantic_viewer_chart"]
            charts_properties = [
                chart["properties"]
                for chart in charts
                if chart["type"] in accepted_chart_types
            ]

            dashboard_external_uuid_charts = []
            dashboard_internal_charts = []
            for chart in charts_properties:
                if chart["belongsToDashboard"]:
                    dashboard_internal_charts.append(
                        LightdashChart(
                            uuid=chart["savedChartUuid"],
                            name=chart["chartName"],
                            organizationUuid=dashboard.organizationUuid,
                            projectUuid=dashboard.projectUuid,
                            spaceUuid=dashboard.spaceUuid,
                            spaceName=dashboard.spaceName,
                            chartType=chart["lastVersionChartKind"],
                            chartKind=chart["lastVersionChartKind"],
                        )
                    )
                else:
                    dashboard_external_uuid_charts.append(chart["savedChartUuid"])

            dashboard_external_charts = self.get_charts_objects(
                dashboard_external_uuid_charts
            )
            dashboard.charts = dashboard_external_charts + dashboard_internal_charts

    def get_charts_objects(self, charts_uuid_list) -> List[LightdashChart]:
        """
        Get Lineage of all non-dashboard charts
        """
        all_charts = self.get_charts_list()
        charts_objects = []

        for chart_uuid in charts_uuid_list:
            for chart in all_charts:
                if chart.uuid == chart_uuid:
                    charts_objects.append(chart)

        return charts_objects
