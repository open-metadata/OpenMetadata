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
Grafana API client
"""
from typing import List, Optional, Union

import requests
from requests import Session

from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboardResponse,
    GrafanaDatasource,
    GrafanaFolder,
    GrafanaSearchResult,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_TIMEOUT = 30


class GrafanaApiClient:
    """
    Grafana API client for fetching dashboards, folders, and datasources
    """

    def __init__(
        self,
        host_port: str,
        api_key: str,
        verify_ssl: bool = True,
        page_size: int = 100,
    ):
        self.host_port = str(host_port).rstrip("/")
        self.api_key = api_key
        self.verify_ssl = verify_ssl
        self.page_size = page_size
        self._session: Optional[Session] = None

        # Log a warning if not using Service Account Token format
        if not api_key.startswith("glsa_"):
            logger.warning(
                "Token does not appear to be a Service Account Token (should start with 'glsa_'). "
                "Legacy API keys are no longer supported by Grafana as of January 2025. "
                "Please create a Service Account Token in Grafana."
            )

    @property
    def session(self) -> Session:
        """Get or create HTTP session with authentication"""
        if not self._session:
            self._session = Session()
            self._session.headers.update(
                {
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
            )
            self._session.verify = self.verify_ssl
        return self._session

    def _make_request(
        self, method: str, endpoint: str, **kwargs
    ) -> Optional[requests.Response]:
        """Make HTTP request with error handling"""
        url = f"{self.host_port}/api{endpoint}"

        try:
            response = self.session.request(
                method=method, url=url, timeout=API_TIMEOUT, **kwargs
            )
            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as err:
            if err.response.status_code in (401, 403):
                logger.warning(
                    f"Permission denied for {endpoint}. "
                    f"Status: {err.response.status_code}"
                )
            else:
                logger.error(f"HTTP error for {endpoint}: {err}")
            return None
        except Exception as err:
            logger.error(f"Error making request to {endpoint}: {err}")
            return None

    def get_folders(self) -> List[GrafanaFolder]:
        """Get all folders with pagination"""

        try:
            folders = []
            page = 1
            while True:
                response = self._make_request(
                    "GET", "/folders", params={"page": page, "limit": self.page_size}
                )

                if not response:
                    break

                page_data = response.json()
                if not page_data:
                    break

                folders.extend([GrafanaFolder(**folder) for folder in page_data])

                # Check if we need to fetch more pages
                if len(page_data) < self.page_size:
                    break

                page += 1
            return folders

        except Exception as err:
            logger.error(f"Error fetching folders from Grafana: {err}")

    def search_dashboards(
        self, folder_id: Optional[int] = None
    ) -> List[GrafanaSearchResult]:
        """Search for dashboards with optional folder filter"""
        try:
            dashboards = []
            page = 1

            while True:
                params = {
                    "type": "dash-db",
                    "page": page,
                    "limit": self.page_size,
                }

                if folder_id is not None:
                    params["folderIds"] = folder_id

                response = self._make_request("GET", "/search", params=params)

                if not response:
                    break

                page_data = response.json()
                if not page_data:
                    break

                dashboards.extend([GrafanaSearchResult(**dash) for dash in page_data])

                # Check if we need to fetch more pages
                if len(page_data) < self.page_size:
                    break

                page += 1

            return dashboards
        except Exception as err:
            logger.error(f"Error fetching dashboards from Grafana: {err}")

    def get_dashboard(self, uid: str) -> Optional[GrafanaDashboardResponse]:
        """Get detailed dashboard information by UID"""
        try:
            response = self._make_request("GET", f"/dashboards/uid/{uid}")
            if response:
                return GrafanaDashboardResponse(**response.json())
            return None
        except Exception as err:
            logger.error(f"Error fetching dashboard details from Grafana: {err}")
            return None

    def get_datasources(self) -> List[GrafanaDatasource]:
        """Get all datasources"""
        try:
            response = self._make_request("GET", "/datasources")
            if response:
                return [GrafanaDatasource(**ds) for ds in response.json()]
            return []
        except Exception as err:
            logger.error(f"Error fetching datasources from Grafana: {err}")
            return []

    def get_datasource(
        self, datasource_id: Union[int, str]
    ) -> Optional[GrafanaDatasource]:
        """Get datasource by ID or UID"""
        try:
            # Try by ID first if it's numeric
            if isinstance(datasource_id, int) or datasource_id.isdigit():
                response = self._make_request("GET", f"/datasources/{datasource_id}")
            else:
                # Try by UID
                response = self._make_request(
                    "GET", f"/datasources/uid/{datasource_id}"
                )

            if response:
                return GrafanaDatasource(**response.json())

        except Exception as err:
            logger.error(f"Error fetching datasource from Grafana: {err}")
            return None

    def test_connection(self) -> bool:
        """Test connection to Grafana API"""
        try:
            response = self._make_request("GET", "/org")
            return response is not None
        except Exception as err:
            logger.error(f"Failed to test Grafana connection: {err}")
            return False

    def close(self):
        """Close HTTP session"""
        if self._session:
            self._session.close()
            self._session = None
