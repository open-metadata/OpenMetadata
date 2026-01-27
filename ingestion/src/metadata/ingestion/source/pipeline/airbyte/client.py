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
Client to interact with airbyte apis
"""
import json
import time
from typing import List, Optional, Tuple

import requests

from metadata.generated.schema.entity.services.connections.pipeline.airbyte.basicAuth import (
    BasicAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
    Oauth20ClientCredentialsAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.utils.constants import AUTHORIZATION_HEADER, NO_ACCESS_TOKEN
from metadata.utils.credentials import generate_http_basic_token
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AirbyteClient:
    """
    Client for self-hosted Airbyte instances.
    Supports Basic Authentication or no authentication.
    """

    def __init__(self, config: AirbyteConnection):
        self.config = config

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version=self.config.apiVersion,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (NO_ACCESS_TOKEN, 0),
        )

        if self.config.auth and isinstance(self.config.auth, BasicAuthentication):
            client_config.auth_token_mode = "Basic"
            client_config.auth_token = lambda: (
                generate_http_basic_token(
                    self.config.auth.username,
                    self.config.auth.password.get_secret_value(),
                ),
                0,
            )

        self.client = REST(client_config)

    def list_workspaces(self) -> List[dict]:
        """
        Method returns the list of workflows
        an airbyte instance can contain multiple workflows
        """
        response = self.client.post("/workspaces/list")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("workspaces")

    def list_connections(self, workflow_id: str) -> List[dict]:
        """
        Method returns the list all of connections of workflow
        """
        data = {"workspaceId": workflow_id}
        response = self.client.post("/connections/list", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("connections")

    def list_jobs(self, connection_id: str) -> List[dict]:
        """
        Method returns the list all of jobs of a connection
        """
        data = {"configId": connection_id, "configTypes": ["sync", "reset_connection"]}
        response = self.client.post("/jobs/list", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("jobs")

    def get_source(self, source_id: str) -> dict:
        """
        Method returns source details
        """
        data = {"sourceId": source_id}
        response = self.client.post("/sources/get", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response

    def get_destination(self, destination_id: str) -> dict:
        """
        Method returns destination details
        """
        data = {"destinationId": destination_id}
        response = self.client.post("/destinations/get", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response


class AirbyteCloudClient(AirbyteClient):
    """
    Client for Airbyte Cloud instances.
    Uses OAuth 2.0 Client Credentials authentication.
    Overrides methods with Cloud-specific API endpoints.
    """

    def __init__(self, config: AirbyteConnection):
        self.config = config
        self._oauth_token: Optional[str] = None
        self._oauth_token_expiry: float = 0

        if not isinstance(config.auth, Oauth20ClientCredentialsAuthentication):
            raise ValueError(
                "AirbyteCloudClient requires OAuth 2.0 Client Credentials authentication"
            )

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version=self.config.apiVersion,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=self._get_oauth_token,
        )
        client_config.auth_token_mode = "Bearer"

        self.client = REST(client_config)

    def _fetch_oauth_token(self) -> Tuple[str, int]:
        """
        Fetch OAuth 2.0 access token using client credentials
        """
        token_url = f"{clean_uri(self.config.hostPort)}/v1/applications/token"
        payload = {
            "client_id": self.config.auth.clientId,
            "client_secret": self.config.auth.clientSecret.get_secret_value(),
        }

        try:
            response = requests.post(
                token_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            token_data = response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                raise APIError("No access_token in OAuth response")

            logger.info("Successfully obtained OAuth access token for Airbyte Cloud")
            return access_token, token_data.get("expires_in", 180)

        except requests.exceptions.RequestException as exc:
            logger.error(f"Failed to fetch OAuth token: {exc}")
            raise APIError(f"OAuth token fetch failed: {exc}") from exc

    def _get_oauth_token(self):
        """
        Get OAuth token with automatic refresh.
        Returns tuple of (token, expiry_timestamp)
        """
        current_time = time.time()

        if not self._oauth_token or current_time >= (self._oauth_token_expiry - 30):
            self._oauth_token, expires_in = self._fetch_oauth_token()
            self._oauth_token_expiry = current_time + expires_in

        return (self._oauth_token, 0)

    def list_workspaces(self) -> List[dict]:
        """
        Method returns the list of workspaces for Airbyte Cloud.
        Uses the Cloud API endpoint which returns data in a different format.
        """
        response = self.client.get("/workspaces")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("data", [])

    def list_connections(self, workflow_id: str) -> List[dict]:
        """
        Method returns the list of connections for a workspace in Airbyte Cloud.
        Uses GET endpoint with workspaceIds query parameter.
        """
        response = self.client.get(f"/connections?workspaceIds={workflow_id}")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("data", [])

    def list_jobs(self, connection_id: str) -> List[dict]:
        """
        Method returns the list of jobs for a connection in Airbyte Cloud.
        Uses GET endpoint with connectionId query parameter.
        """
        response = self.client.get(f"/jobs?connectionId={connection_id}")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("data", [])

    def get_source(self, source_id: str) -> dict:
        """
        Method returns source details for Airbyte Cloud.
        Uses GET endpoint with path parameter instead of POST.
        """
        response = self.client.get(f"/sources/{source_id}")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response

    def get_destination(self, destination_id: str) -> dict:
        """
        Method returns destination details for Airbyte Cloud.
        Uses GET endpoint with path parameter instead of POST.
        """
        response = self.client.get(f"/destinations/{destination_id}")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response
