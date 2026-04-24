#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Kestra REST API client wrapper.
"""
import traceback
from typing import List, Optional

from metadata.generated.schema.entity.services.connections.pipeline.kestraConnection import (
    KestraConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.pipeline.kestra.models import (
    KestraExecution,
    KestraFlow,
    KestraFlowList,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.credentials import generate_http_basic_token
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class KestraClient:
    """
    HTTP client for the Kestra REST API.

    Supports optional HTTP Basic Auth (username + password).
    All methods return empty lists on error rather than raising exceptions,
    so ingestion can continue gracefully when individual API calls fail.
    """

    def __init__(self, config: KestraConnection):
        self.config = config
        base_url = clean_uri(str(config.hostPort))

        client_config = ClientConfig(
            base_url=base_url,
            api_version=None,  # We build full paths ourselves
        )

        # Attach Basic Auth when credentials are provided
        if config.username and config.password:
            client_config.auth_header = AUTHORIZATION_HEADER
            client_config.auth_token_mode = "Basic"
            client_config.auth_token = lambda: (
                generate_http_basic_token(
                    config.username,
                    config.password.get_secret_value(),
                ),
                0,
            )

        self.client = TrackedREST(client_config, source_name="kestra")

    def get_namespaces(self) -> List[str]:
        """
        Return a list of all namespace strings from the Kestra instance.
        Calls GET /api/v1/namespaces.
        """
        try:
            response = self.client.get("/api/v1/namespaces")
            if not response:
                return []
            # Response is a list of namespace objects with an "id" field
            if isinstance(response, list):
                return [ns.get("id", "") for ns in response if ns.get("id")]
            return []
        except Exception as exc:
            logger.warning(
                f"Failed to fetch Kestra namespaces: {exc}\n{traceback.format_exc()}"
            )
            return []

    def get_flows(self, namespace: Optional[str] = None) -> List[KestraFlow]:
        """
        Return a list of KestraFlow objects.

        If namespace is provided, calls GET /api/v1/flows/{namespace}.
        Otherwise falls back to GET /api/v1/flows/search?q=* which returns
        a paginated response wrapped in a KestraFlowList.
        """
        try:
            if namespace:
                response = self.client.get(f"/api/v1/flows/{namespace}")
                if not response:
                    return []
                if isinstance(response, list):
                    return [KestraFlow.model_validate(f) for f in response]
                return []
            else:
                response = self.client.get("/api/v1/flows/search?q=*")
                if not response:
                    return []
                # /flows/search returns {"results": [...], "total": N}
                flow_list = KestraFlowList.model_validate(response)
                return flow_list.results
        except Exception as exc:
            logger.warning(
                f"Failed to fetch Kestra flows (namespace={namespace}): {exc}\n"
                f"{traceback.format_exc()}"
            )
            return []

    def get_executions(self, namespace: str, flow_id: str) -> List[KestraExecution]:
        """
        Return a list of KestraExecution objects for the given flow.
        Calls GET /api/v1/executions/{namespace}/{flow_id}.
        """
        try:
            response = self.client.get(f"/api/v1/executions/{namespace}/{flow_id}")
            if not response:
                return []
            # Response is a paginated object with a "results" key
            if isinstance(response, dict):
                results = response.get("results", [])
            elif isinstance(response, list):
                results = response
            else:
                return []
            return [KestraExecution.model_validate(e) for e in results]
        except Exception as exc:
            logger.warning(
                f"Failed to fetch executions for {namespace}/{flow_id}: {exc}\n"
                f"{traceback.format_exc()}"
            )
            return []
