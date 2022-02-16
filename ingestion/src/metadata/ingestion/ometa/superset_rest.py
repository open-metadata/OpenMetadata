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
REST Auth & Client for Apache Superset
"""
import json
import logging
from typing import Optional

from pydantic import SecretStr

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig

logger = logging.getLogger(__name__)


class SupersetConfig(ConfigModel):
    """
    Superset Configuration class

    Attributes:
        url (str):
        username (Optional[str]):
        password (Optional[str]):
        service_name (str):
        service_type (str):
        provider (str):
        options (dict):
    """

    url: str = "localhost:8088"
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    service_name: str
    service_type: str = DashboardServiceType.Superset.value
    provider: str = "db"
    options: dict = {}
    db_service_name: Optional[str] = None


class SupersetAuthenticationProvider(AuthenticationProvider):
    """
    Handle SuperSet Auth
    """

    def __init__(self, config: SupersetConfig):
        self.config = config
        client_config = ClientConfig(base_url=config.url, api_version="api/v1")
        self.client = REST(client_config)
        super().__init__()

    @classmethod
    def create(cls, config: SupersetConfig):
        return cls(config)

    def auth_token(self) -> str:
        login_request = self._login_request()
        login_response = self.client.post("/security/login", login_request)
        return login_response["access_token"]

    def _login_request(self) -> str:
        auth_request = {
            "username": self.config.username,
            "password": self.config.password.get_secret_value(),
            "refresh": True,
            "provider": self.config.provider,
        }
        return json.dumps(auth_request)


class SupersetAPIClient:
    """
    Superset client wrapper using the REST helper class
    """

    client: REST
    _auth_provider: AuthenticationProvider

    def __init__(self, config: SupersetConfig):
        self.config = config
        self._auth_provider = SupersetAuthenticationProvider.create(config)
        client_config = ClientConfig(
            base_url=config.url,
            api_version="api/v1",
            auth_token=f"{self._auth_provider.auth_token()}",
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def fetch_total_dashboards(self) -> int:
        """
        Fetch total dahsboard

        Returns:
            int
        """
        response = self.client.get("/dashboard?q=(page:0,page_size:1)")
        return response.get("count") or 0

    def fetch_dashboards(self, current_page: int, page_size: int):
        """
        Fetch dashboards

        Args:
            current_page (int): current page number
            page_size (int): total number of pages

        Returns:
            requests.Response
        """
        response = self.client.get(
            f"/dashboard?q=(page:{current_page},page_size:{page_size})"
        )
        return response

    def fetch_total_charts(self) -> int:
        """
        Fetch the total number of charts

        Returns:
             int
        """
        response = self.client.get("/chart?q=(page:0,page_size:1)")
        return response.get("count") or 0

    def fetch_charts(self, current_page: int, page_size: int):
        """
        Fetch charts

        Args:
            current_page (str):
            page_size (str):

        Returns:
            requests.Response
        """
        response = self.client.get(
            f"/chart?q=(page:{current_page},page_size:{page_size})"
        )
        return response

    def fetch_charts_with_id(self, chart_id):
        response = self.client.get(f"/chart/{chart_id}")
        return response

    def fetch_datasource(self, datasource_id: str):
        """
        Fetch data source

        Args:
            datasource_id (str):
        Returns:
            requests.Response
        """
        response = self.client.get(f"/dataset/{datasource_id}")
        return response

    def fetch_database(self, database_id: str):
        """
        Fetch database

        Args:
            database_id (str):
        Returns:
            requests.Response
        """
        response = self.client.get(f"/database/{database_id}")
        return response
