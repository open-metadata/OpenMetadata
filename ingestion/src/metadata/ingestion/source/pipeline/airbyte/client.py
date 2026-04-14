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
from typing import Iterable, Optional, Tuple, Type, Union
from urllib.parse import quote

import requests
from pydantic import BaseModel

from metadata.generated.schema.entity.services.connections.pipeline.airbyte.basicAuth import (
    BasicAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
    Oauth20ClientCredentialsAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import APIError, ClientConfig
from metadata.ingestion.source.pipeline.airbyte.models import (
    AirbyteCloudJob,
    AirbyteConnectionList,
    AirbyteConnectionModel,
    AirbyteDestinationResponse,
    AirbytePublicCloudJobList,
    AirbytePublicConnectionList,
    AirbytePublicWorkspaceList,
    AirbyteSelfHostedJob,
    AirbyteSelfHostedJobList,
    AirbyteSourceResponse,
    AirbyteWorkspace,
    AirbyteWorkspaceList,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.credentials import generate_http_basic_token
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AirbyteClient:
    """
    Client for self-hosted Airbyte instances.
    Supports Basic Authentication or no authentication.
    Automatically detects if the public API is being used based on apiVersion.
    """

    def __init__(self, config: AirbyteConnection):
        self.config = config
        self._use_public_api = "public" in (self.config.apiVersion or "").lower()

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version=self.config.apiVersion,
        )

        if self.config.auth and isinstance(self.config.auth, BasicAuthentication):
            client_config.auth_header = AUTHORIZATION_HEADER
            client_config.auth_token_mode = "Basic"
            client_config.auth_token = lambda: (
                generate_http_basic_token(
                    self.config.auth.username,
                    self.config.auth.password.get_secret_value(),
                ),
                0,
            )

        self.client = TrackedREST(client_config, source_name="airbyte")

    def _paginate_get(self, path: str, response_cls: Type[BaseModel]) -> Iterable:
        """
        Handle offset-based pagination for the Airbyte public API.
        All public API list endpoints default to 20 items per page (max 100).
        Yields individual items from each page.
        """
        limit = 100
        offset = 0
        while True:
            separator = "&" if "?" in path else "?"
            response = self.client.get(
                f"{path}{separator}limit={limit}&offset={offset}"
            )
            if not response:
                raise APIError({"message": "Empty response from Airbyte API"})
            if response.get("exceptionStack"):
                raise APIError(response)
            parsed = response_cls.model_validate(response)
            yield from parsed.data
            if len(parsed.data) < limit or not parsed.next:
                break
            offset += limit

    def list_workspaces(self) -> Iterable[AirbyteWorkspace]:
        """
        Method returns the list of workflows.
        An airbyte instance can contain multiple workflows.
        """
        if self._use_public_api:
            yield from self._paginate_get("/workspaces", AirbytePublicWorkspaceList)
            return

        response = self.client.post("/workspaces/list")
        if not response:
            raise APIError({"message": "Empty response from Airbyte API"})
        if response.get("exceptionStack"):
            raise APIError(response)
        yield from AirbyteWorkspaceList.model_validate(response).workspaces

    def list_connections(self, workflow_id: str) -> Iterable[AirbyteConnectionModel]:
        """
        Method returns the list of all connections of a workflow.
        """
        if self._use_public_api:
            yield from self._paginate_get(
                f"/connections?workspaceIds={quote(workflow_id, safe='')}",
                AirbytePublicConnectionList,
            )
            return

        data = {"workspaceId": workflow_id}
        response = self.client.post("/connections/list", data=json.dumps(data))
        if not response:
            raise APIError({"message": "Empty response from Airbyte API"})
        if response.get("exceptionStack"):
            raise APIError(response)
        yield from AirbyteConnectionList.model_validate(response).connections

    def list_jobs(
        self, connection_id: str
    ) -> Iterable[Union[AirbyteSelfHostedJob, AirbyteCloudJob]]:
        """
        Method returns the list of all jobs of a connection.
        """
        if self._use_public_api:
            yield from self._paginate_get(
                f"/jobs?connectionId={quote(connection_id, safe='')}",
                AirbytePublicCloudJobList,
            )
            return

        data = {"configId": connection_id, "configTypes": ["sync", "reset_connection"]}
        response = self.client.post("/jobs/list", data=json.dumps(data))
        if not response:
            raise APIError({"message": "Empty response from Airbyte API"})
        if response.get("exceptionStack"):
            raise APIError(response)
        yield from AirbyteSelfHostedJobList.model_validate(response).jobs

    def get_source(self, source_id: str) -> AirbyteSourceResponse:
        """
        Method returns source details.
        """
        if self._use_public_api:
            response = self.client.get(f"/sources/{quote(source_id, safe='')}")
            if not response:
                raise APIError({"message": "Empty response from Airbyte API"})
            if response.get("exceptionStack"):
                raise APIError(response)
            return AirbyteSourceResponse.model_validate(response)

        data = {"sourceId": source_id}
        response = self.client.post("/sources/get", data=json.dumps(data))
        if not response:
            raise APIError({"message": "Empty response from Airbyte API"})
        if response.get("exceptionStack"):
            raise APIError(response)
        return AirbyteSourceResponse.model_validate(response)

    def get_destination(self, destination_id: str) -> AirbyteDestinationResponse:
        """
        Method returns destination details.
        """
        if self._use_public_api:
            response = self.client.get(
                f"/destinations/{quote(destination_id, safe='')}"
            )
            if not response:
                raise APIError({"message": "Empty response from Airbyte API"})
            if response.get("exceptionStack"):
                raise APIError(response)
            return AirbyteDestinationResponse.model_validate(response)

        data = {"destinationId": destination_id}
        response = self.client.post("/destinations/get", data=json.dumps(data))
        if not response:
            raise APIError({"message": "Empty response from Airbyte API"})
        if response.get("exceptionStack"):
            raise APIError(response)
        return AirbyteDestinationResponse.model_validate(response)


class AirbyteCloudClient(AirbyteClient):
    """
    Client for Airbyte Cloud instances.
    Uses OAuth 2.0 Client Credentials authentication.
    Inherits public API endpoint methods from AirbyteClient.
    """

    def __init__(self, config: AirbyteConnection):
        self.config = config
        self._use_public_api = True
        self._oauth_token: Optional[str] = None
        self._oauth_token_expiry: float = 0

        if not isinstance(config.auth, Oauth20ClientCredentialsAuthentication):
            raise ValueError(
                "AirbyteCloudClient requires OAuth 2.0 Client Credentials authentication"
            )

        # The connection schema defaults apiVersion to "api/v1" (the internal API path).
        # AirbyteCloudClient always uses the public API, so silently promote the
        # internal-API default to the correct public-API path.
        api_version = self.config.apiVersion or "api/v1"
        if api_version == "api/v1":
            api_version = "api/public/v1"

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version=api_version,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=self._get_oauth_token,
        )
        client_config.auth_token_mode = "Bearer"

        self.client = TrackedREST(client_config)

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
                raise APIError({"message": "No access_token in OAuth response"})

            logger.info("Successfully obtained OAuth access token for Airbyte Cloud")
            return access_token, token_data.get("expires_in", 180)

        except requests.exceptions.RequestException as exc:
            logger.error(f"Failed to fetch OAuth token: {exc}")
            raise APIError({"message": f"OAuth token fetch failed: {exc}"}) from exc

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
