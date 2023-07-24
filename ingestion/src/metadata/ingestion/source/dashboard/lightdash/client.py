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
REST Auth & Client for Redash
"""
import traceback

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import utils_logger
from typing import List, Optional
from ingestion.src.metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashChartList,
    LightdashDashboard,
    LightdashDashboardList
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
            base_url="https://app.lightdash.cloud",
            api_version="",
            access_token="2e55cf38b3194b916bffee6032e96bea",
            auth_header="ApiKey",
            auth_token_mode="Key",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def get_org(self):
        """GET api/orgs/<slug>"""

        # The API changed from redash v9 onwards
        # legacy=true allows us to get the results in the old way
        return self.client.get(
           "/api/v1/org",
        )

    def get_charts_list(self, project_uuid) -> List[LightdashChart]:
        """
        Get List of all charts
        """
        try:
            resp_charts = self.client.get("/api/v1/projects/" + project_uuid + "/charts")
            if resp_charts:
                charts_list = LightdashChartList(charts=resp_charts)
                return charts_list.charts
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the charts list")
        return []

    def get_dashboards_list(self, project_uuid,space_uuid) -> List[LightdashDashboard]:
        """
        Get List of all charts
        """
        try:
            resp_dashboards = self.client.get("/api/v1/projects/" + project_uuid + "/spaces/" + space_uuid)
            if resp_dashboards:
                charts_list = LightdashDashboardList(dashboards=resp_dashboards)
                return charts_list.dashboards
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboards list")
        return []




