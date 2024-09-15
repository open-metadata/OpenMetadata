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
import traceback

from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.superset.models import (
    ListDatabaseResult,
    SupersetChart,
    SupersetDashboardCount,
    SupersetDatasource,
)
from metadata.utils.logger import ometa_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ometa_logger()


class SupersetAuthenticationProvider(AuthenticationProvider):
    """
    Handle SuperSet Auth
    """

    def __init__(self, config: SupersetConnection):
        self.config = config
        self.service_connection = self.config
        get_verify_ssl = get_verify_ssl_fn(config.connection.verifySSL)
        client_config = ClientConfig(
            base_url=str(config.hostPort),
            api_version="api/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
            verify=get_verify_ssl(config.connection.sslConfig),
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
        get_verify_ssl = get_verify_ssl_fn(config.connection.verifySSL)
        client_config = ClientConfig(
            base_url=str(config.hostPort),
            api_version="api/v1",
            auth_token=self._auth_provider.get_access_token,
            auth_header="Authorization",
            allow_redirects=True,
            verify=get_verify_ssl(config.connection.sslConfig),
        )
        self.client = REST(client_config)

    def get_dashboard_count(self) -> int:
        resp_dashboards = self.client.get("/dashboard/?q=(page:0,page_size:1)")
        if resp_dashboards:
            dashboard_count = SupersetDashboardCount(**resp_dashboards)
            return dashboard_count.count
        return 0

    def fetch_total_dashboards(self) -> int:
        """
        Fetch total dashboard

        Returns:
            int
        """
        try:
            return self.get_dashboard_count()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard count")
        return 0

    def fetch_dashboards(
        self, current_page: int, page_size: int
    ) -> SupersetDashboardCount:
        """
        Fetch dashboards

        Args:
            current_page (int): current page number
            page_size (int): total number of pages

        Returns:
            requests.Response
        """

        try:
            dashboard_response = self.client.get(
                f"/dashboard/?q=(page:{current_page},page_size:{page_size})"
            )
            if dashboard_response:
                dashboard_list = SupersetDashboardCount(**dashboard_response)
                return dashboard_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard list")
        return SupersetDashboardCount()

    def get_chart_count(self) -> int:
        resp_chart = self.client.get("/chart/?q=(page:0,page_size:1)")
        if resp_chart:
            chart_count = SupersetChart(**resp_chart)
            return chart_count.count
        return 0

    def fetch_total_charts(self) -> int:
        """
        Fetch the total number of charts

        Returns:
             int
        """
        try:
            return self.get_chart_count()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the chart count")
        return 0

    def fetch_charts(self, current_page: int, page_size: int) -> SupersetChart:
        """
        Fetch charts

        Args:
            current_page (str):
            page_size (str):

        Returns:
            requests.Response
        """

        try:
            chart_response = self.client.get(
                f"/chart/?q=(page:{current_page},page_size:{page_size})"
            )
            if chart_response:
                chart_list = SupersetChart(**chart_response)
                return chart_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the charts list")
        return SupersetChart()

    def fetch_charts_with_id(self, chart_id: str):
        response = self.client.get(f"/chart/{chart_id}")
        return response

    def fetch_datasource(self, datasource_id: str) -> SupersetDatasource:
        """
        Fetch data source

        Args:
            datasource_id (str):
        Returns:
            requests.Response
        """

        try:
            datasource_response = self.client.get(f"/dataset/{datasource_id}")
            if datasource_response:
                datasource_list = SupersetDatasource(**datasource_response)
                return datasource_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the datasource list")

        return SupersetDatasource()

    def fetch_database(self, database_id: str) -> ListDatabaseResult:
        """
        Fetch database

        Args:
            database_id (str):
        Returns:
            requests.Response
        """

        try:
            database_response = self.client.get(f"/database/{database_id}")
            if database_response:
                database_list = ListDatabaseResult(**database_response)
                return database_list
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the database list")
        return ListDatabaseResult()
