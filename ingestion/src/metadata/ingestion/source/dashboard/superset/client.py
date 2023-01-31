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

from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class SupersetAuthenticationProvider(AuthenticationProvider):
    """
    Handle SuperSet Auth
    """

    def __init__(self, config: SupersetConnection):
        self.config = config
        self.service_connection = self.config
        client_config = ClientConfig(
            base_url=config.hostPort,
            api_version="api/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)
        self.generated_auth_token = None
        self.expiry = None
        super().__init__()

    @classmethod
    def create(cls, config: SupersetConnection):
        return cls(config)

    def auth_token(self) -> None:
        login_request = self._login_request()
        login_response = self.client.post("/security/login", login_request)
        self.generated_auth_token = login_response["access_token"]
        self.expiry = 0

    def _login_request(self) -> str:
        auth_request = {
            "username": self.service_connection.connection.username,
            "password": self.service_connection.connection.password.get_secret_value(),
            "refresh": True,
            "provider": self.service_connection.connection.provider.value,
        }
        return json.dumps(auth_request)

    def get_access_token(self):
        self.auth_token()
        return self.generated_auth_token, self.expiry


class SupersetAPIClient:
    """
    Superset client wrapper using the REST helper class
    """

    client: REST
    _auth_provider: AuthenticationProvider

    def __init__(self, config: SupersetConnection):
        self.config = config
        self._auth_provider = SupersetAuthenticationProvider.create(config)
        client_config = ClientConfig(
            base_url=config.hostPort,
            api_version="api/v1",
            auth_token=self._auth_provider.get_access_token,
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def fetch_total_dashboards(self) -> int:
        """
        Fetch total dashboard

        Returns:
            int
        """
        response = self.client.get("/dashboard/?q=(page:0,page_size:1)")
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
            f"/dashboard/?q=(page:{current_page},page_size:{page_size})"
        )
        return response

    def fetch_total_charts(self) -> int:
        """
        Fetch the total number of charts

        Returns:
             int
        """
        response = self.client.get("/chart/?q=(page:0,page_size:1)")
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
            f"/chart/?q=(page:{current_page},page_size:{page_size})"
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
