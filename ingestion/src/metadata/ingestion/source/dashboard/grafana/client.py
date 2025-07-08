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
REST Auth & Client for Grafana
"""

import base64
from typing import Optional

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()


class GrafanaApiClient:
    """
    REST Auth & Client for Grafana
    """

    client: REST

    def __init__(self, config):
        self.config = config

        # Prepare authentication headers
        extra_headers = {}
        auth_type = config.authType

        if hasattr(auth_type, "apiKey"):
            # Use API key authentication
            extra_headers[
                "Authorization"
            ] = f"Bearer {auth_type.apiKey.get_secret_value()}"
        elif hasattr(auth_type, "username") and hasattr(auth_type, "password"):
            # Use basic authentication
            credentials = base64.b64encode(
                f"{auth_type.username}:{auth_type.password.get_secret_value()}".encode()
            ).decode()
            extra_headers["Authorization"] = f"Basic {credentials}"
        else:
            logger.warning("No valid authentication method found in authType")

        # Add organization header if specified
        if config.orgId:
            extra_headers["X-Grafana-Org-Id"] = str(config.orgId)

        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="api",
            extra_headers=extra_headers,
            verify=getattr(config, "verifySSL", True),
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def search_dashboards(
        self,
        query: str = "",
        tag: Optional[str] = None,
        starred: bool = False,
        limit: int = 5000,
    ) -> dict:
        """Search dashboards using GET /api/search"""
        params = {"type": "dash-db", "query": query, "limit": limit, "starred": starred}
        if tag:
            params["tag"] = tag

        return self.client.get(path="/search", data=params)

    def get_dashboard_by_uid(self, uid: str) -> dict:
        """GET /api/dashboards/uid/{uid}"""
        return self.client.get(f"/dashboards/uid/{uid}")

    def get_folders(self) -> dict:
        """GET /api/folders"""
        return self.client.get("/folders")

    def get_org_info(self) -> dict:
        """GET /api/org"""
        return self.client.get("/org")

    def get_dashboard_permissions(self, dashboard_id: int) -> dict:
        """GET /api/dashboards/id/{id}/permissions"""
        return self.client.get(f"/dashboards/id/{dashboard_id}/permissions")

    def get_dashboard_tags(self) -> dict:
        """GET /api/dashboards/tags"""
        return self.client.get("/dashboards/tags")

    def get_datasources(self) -> dict:
        """GET /api/datasources"""
        return self.client.get("/datasources")

    def get_dashboard_versions(self, dashboard_id: int) -> dict:
        """GET /api/dashboards/id/{id}/versions"""
        return self.client.get(f"/dashboards/id/{dashboard_id}/versions")

    def get_annotations(self, dashboard_id: int) -> dict:
        """GET /api/annotations with dashboard filter"""
        params = {"dashboardId": dashboard_id}
        return self.client.get("/annotations", data=params)
