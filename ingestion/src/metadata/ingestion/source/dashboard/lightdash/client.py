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

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import utils_logger
from typing import List
from metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashDashboard,
    LightdashChartList,
    LightdashDashboardList,
)

logger = utils_logger()


class LightdashApiClient:
    """
    REST Auth & Client for Lightdash
    """

    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=self.config.hostPort,
            api_version="",
            access_token=self.config.apiKey.get_secret_value(),
            auth_header="Authorization",
            auth_token_mode="ApiKey",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def get_org(self):
        """GET api/org"""
        # legacy=true allows us to get the results in the old way
        return self.client.get(
            "/api/v1/org",
        )

    def get_charts_list(self) -> List[LightdashChart]:
        """
        Get List of all charts
        """
        try:
            project_uuid = "12cfc22e-aa77-46a0-9d27-4ce80af96a7c"
            logger.warning("----Project UUID: " + self.config.projectUUID)
            logger.warning("----Space UUID: " + self.config.spaceUUID)
            response = self.client.get(f"api/v1/projects/{project_uuid}/charts")
            response_json_results = response["results"]

            if len(response_json_results) > 0:
                charts_list = []
                for chart in response_json_results:
                    charts_list.append(LightdashChart(**chart))
                return charts_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the charts list for the Lightdash Connector")
        return []

    def get_dashboards_list(self) -> List[LightdashDashboard]:
        """
        Get List of all charts
        """

        project_uuid = "12cfc22e-aa77-46a0-9d27-4ce80af96a7c"
        space_uuid = "9d995a48-20bb-48ef-a189-8cbc364ddc7e"
        try:
            response = self.client.get(f"api/v1/projects/{project_uuid}/spaces/{space_uuid}")
            results = response["results"]
            dashboards_raw = results["dashboards"]

            if len(dashboards_raw) > 0:
                dashboards_list = []
                for dashboard in dashboards_raw:
                    dashboards_list.append(LightdashDashboard(**dashboard))

                return dashboards_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard list for the Lightdash Connector")
        return []
