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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MetabaseClient:
    """
    Client Handling API communication with Metabase
    """

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        host_port: Optional[str] = None,
    ):
        self.username = username
        self.password = password
        self.host_port = host_port
        try:
            params = {}
            params["username"] = self.username
            params["password"] = self.password.get_secret_value()
            headers = {"Content-Type": "application/json", "Accept": "*/*"}
            self.resp = requests.post(  # pylint: disable=missing-timeout
                host_port + "/api/session/",
                data=json.dumps(params),
                headers=headers,
            )
            session_id = self.resp.json()["id"]
            metabase_session = {"X-Metabase-Session": session_id}
            self.metabase_session = metabase_session

        except Exception as exc:
            msg = f"Unknown error in connection: {exc}."
            raise SourceConnectionException(msg) from exc

    def req_get(self, path: str) -> requests.Response:
        """Send get request method

        Args:
            path:
        """
        return requests.get(
            self.host_port + path,
            headers=self.metabase_session,
            timeout=30,
        )

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            return resp_dashboards.json()
        return []

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["name"]

    def get_dashboard_details(self, dashboard_id: str) -> dict:
        """
        Get Dashboard Details
        """
        resp_dashboard = self.req_get(f"/api/dashboard/{dashboard_id}")
        return resp_dashboard.json()

    def get_database(self, database_id: str) -> Optional[dict]:
        """
        Get Database using database ID
        """
        resp_database = self.req_get(f"/api/database/{database_id}")
        if resp_database.status_code == 200:
            return resp_database.json()
        else:
            return None

    def get_table(self, table_id: str) -> Optional[dict]:
        """
        Get Table using table ID
        """
        resp_table = self.req_get(f"/api/table/{table_id}")
        if resp_table.status_code == 200:
            return resp_table.json()
        else:
            return None
