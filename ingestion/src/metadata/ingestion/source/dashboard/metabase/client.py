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
REST Auth & Client for Metabase
"""
import json
from typing import List, Optional

import requests

from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.metabase.models import (
    MetabaseDashboard,
    MetabaseDashboardDetails,
    MetabaseDashboardList,
    MetabaseDatabase,
    MetabaseTable,
)
from metadata.utils.constants import AUTHORIZATION_HEADER, NO_ACCESS_TOKEN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

USERNAME_HEADER = "username"
PASSWORD_HEADER = "password"
SESSION_HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}
DEFAULT_TIMEOUT = 30
METABASE_SESSION_HEADER = "X-Metabase-Session"
API_VERSION = "api"


class MetabaseClient:
    """
    Client Handling API communication with Metabase
    """

    def _get_metabase_session(self) -> str:
        try:
            params = {USERNAME_HEADER: self.config.username}
            if self.config.password:
                params[PASSWORD_HEADER] = self.config.password.get_secret_value()
            self.resp = requests.post(
                f"{self.config.hostPort}/{API_VERSION}/session/",
                data=json.dumps(params),
                headers=SESSION_HEADERS,
                timeout=DEFAULT_TIMEOUT,
            )
            return self.resp.json()["id"]
        except Exception as exc:
            msg = f"Unknown error in connection: {exc}."
            raise SourceConnectionException(msg) from exc

    def __init__(
        self,
        config: MetabaseConnection,
    ):
        self.config = config
        session_token = self._get_metabase_session()
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.hostPort,
            api_version=API_VERSION,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (NO_ACCESS_TOKEN, 0),
            extra_headers={METABASE_SESSION_HEADER: session_token},
        )
        self.client = REST(client_config)

    def get_dashboards_list(self) -> List[MetabaseDashboard]:
        """
        Get List of all dashboards
        """
        resp_dashboards = self.client.get("/dashboard")
        if resp_dashboards:
            dashboard_list = MetabaseDashboardList(dashboards=resp_dashboards)
            return dashboard_list.dashboards
        logger.warning(f"Failed to fetch the dashboards: {resp_dashboards.text}")
        return []

    def get_dashboard_details(
        self, dashboard_id: str
    ) -> Optional[MetabaseDashboardDetails]:
        """
        Get Dashboard Details
        """
        resp_dashboard = self.client.get(f"/dashboard/{dashboard_id}")
        if resp_dashboard:
            return MetabaseDashboardDetails(**resp_dashboard)
        logger.warning(f"Failed to fetch the dashboard: {resp_dashboard.text}")
        return None

    def get_database(self, database_id: str) -> Optional[MetabaseDatabase]:
        """
        Get Database using database ID
        """
        resp_database = self.client.get(f"/database/{database_id}")
        if resp_database:
            return MetabaseDatabase(**resp_database)
        logger.warning(f"Failed to fetch the database: {resp_database.text}")
        return None

    def get_table(self, table_id: str) -> Optional[MetabaseTable]:
        """
        Get Table using table ID
        """
        resp_table = self.client.get(f"/table/{table_id}")
        if resp_table:
            return MetabaseTable(**resp_table)
        logger.warning(f"Failed to fetch the table: {resp_table.text}")
        return None
