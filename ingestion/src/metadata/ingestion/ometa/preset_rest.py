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
REST Auth & Client for Apache Preset
"""
import json

from metadata.generated.schema.entity.services.connections.dashboard.presetConnection import (
    PresetConnection,
)
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.superset_rest import SupersetAPIClient
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class PresetAuthenticationProvider(AuthenticationProvider):
    """
    Handle PreSet Auth
    """

    def __init__(self, config: PresetConnection):
        self.config = config
        self.service_connection = self.config
        client_config = ClientConfig(
            base_url=config.hostPort,
            api_version="api/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
        )
        auth_config = ClientConfig(
            base_url=config.authHost,
            api_version="api/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)
        self.auth = REST(auth_config)
        self.generated_auth_token = None
        self.expiry = None
        super().__init__()

    @classmethod
    def create(cls, config: PresetConnection):
        return cls(config)

    def auth_token(self) -> None:
        login_request = self._login_request()
        login_response = self.auth.post("/auth", login_request)
        logger.info(f"Login response: {login_response}")
        self.generated_auth_token = login_response["payload"].get('access_token')
        self.expiry = 0

    def _login_request(self) -> str:
        auth_request = {
            "name": self.service_connection.apiToken,
            "secret": self.service_connection.apiSecret.get_secret_value(),
        }
        return json.dumps(auth_request)

    def get_access_token(self):
        self.auth_token()
        return self.generated_auth_token, self.expiry


class PresetAPIClient(SupersetAPIClient):
    """
    Preset client wrapper extending SupersetAPIClient
    """
    def __init__(self, config: PresetConnection):
        super().__init__(config)
        self._auth_provider = PresetAuthenticationProvider.create(config)
        client_config = ClientConfig(
            base_url=config.hostPort,
            api_version="api/v1",
            auth_token=self._auth_provider.get_access_token,
            auth_header="Authorization",
            allow_redirects=True,
        )
        self.client = REST(client_config)
