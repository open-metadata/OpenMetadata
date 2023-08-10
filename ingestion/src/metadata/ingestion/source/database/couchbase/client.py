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
REST Auth & Client for Couchbase
"""
import json
import traceback

from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection,
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

logger = ometa_logger()


class CouchbaseAuthenticationProvider(AuthenticationProvider):
    """
    Handle Couchbase Auth
    """

    def __init__(self, config: CouchbaseConnection):
        self.config = config
        self.service_connection = self.config
        client_config = ClientConfig(
            base_url=config.endpoint,
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)
        self.generated_auth_token = None
        self.expiry = None
        super().__init__()

    @classmethod
    def create(cls, config: CouchbaseConnection):
        return cls(config)

    def auth_token(self) -> None:
        login_request = self._login_request()
        login_response = self.client.post("/security/login", login_request)
        self.generated_auth_token = login_response["access_token"]
        self.expiry = 0

    def _login_request(self) -> str:
        auth_request = {
            "username": self.service_connection.username,
            "password": self.service_connection.password.get_secret_value(),
            "refresh": True
        }
        return json.dumps(auth_request)


class CouchbaseAPIClient:
    """
    Couchbase client wrapper using the REST helper class
    """

    client: REST
    _auth_provider: AuthenticationProvider

    def __init__(self, config: CouchbaseConnection):
        self.config = config
        self._auth_provider = CouchbaseAuthenticationProvider.create(config)
        client_config = ClientConfig(
            base_url=config.endpoint,
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def fetch_total_scope(self) -> int:
        """
        Fetch total dashboard

        Returns:
            int
        """
        try:
            resp_dashboards = self.client.get(f"/pools/default/buckets/{self.config.bucket}/scopes",auth=CouchbaseAuthenticationProvider._login_request())
            if resp_dashboards:
                dashboard_count = SupersetDashboardCount(**resp_dashboards)
                return dashboard_count.count
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard count")
        return 0

    