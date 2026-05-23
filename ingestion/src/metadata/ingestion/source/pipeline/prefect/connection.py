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
Connection handler for Prefect
"""
import httpx

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.ssl_registry import get_verify_ssl_fn


def _build_base_url(connection: PrefectConnection) -> str:
    """
    Build the Prefect API base URL based on connection mode.

    Returns:
        Base URL for Prefect API (Cloud or self-hosted)
    """
    if connection.accountId and connection.workspaceId:
        # Prefect Cloud mode
        host = getattr(connection, "hostPort", None) or "https://api.prefect.cloud"
        return (
            f"{host}/api/accounts"
            f"/{connection.accountId}"
            f"/workspaces/{connection.workspaceId}"
        )
    else:
        # Self-hosted Prefect Server mode
        host = getattr(connection, "hostPort", None) or "http://localhost:4200"
        return f"{host}/api"


def get_connection(connection: PrefectConnection) -> httpx.Client:
    """
    Create an HTTP client for Prefect Cloud or self-hosted Prefect Server.
    """
    # Validate accountId/workspaceId consistency
    has_account = bool(connection.accountId)
    has_workspace = bool(connection.workspaceId)
    if has_account != has_workspace:
        raise ValueError(
            "Both accountId and workspaceId must be provided for "
            "Prefect Cloud, or both must be empty for self-hosted mode."
        )

    # Handle both SecretStr and plain string for apiKey
    api_key = connection.apiKey
    if hasattr(api_key, "get_secret_value"):
        api_key_str = api_key.get_secret_value()
    else:
        api_key_str = str(api_key)

    # Build base URL using shared helper
    base_url = _build_base_url(connection)

    headers = {
        "Authorization": f"Bearer {api_key_str}",
        "Content-Type": "application/json",
        "User-Agent": "OpenMetadata/Prefect-Connector",
    }

    # Handle SSL verification (required for enterprise deployments)
    verify_ssl = True  # Default to verifying SSL for security
    if connection.verifySSL:
        verify_ssl_fn = get_verify_ssl_fn(connection.verifySSL)
        ssl_result = verify_ssl_fn(connection.sslConfig)
        # None (no-ssl) and False (ignore) both mean disable verification
        verify_ssl = ssl_result if ssl_result is not None else False

    return httpx.Client(
        base_url=base_url, headers=headers, timeout=30, verify=verify_ssl
    )


def test_connection(
    metadata: OpenMetadata,
    client: httpx.Client,
    service_connection: PrefectConnection,
    base_url: str = None,
    headers: dict = None,
    automation_workflow: AutomationWorkflow = None,
) -> None:
    """
    Test connection to Prefect Cloud by fetching flows.
    """

    def custom_test_connection(client: httpx.Client) -> None:
        # Test using POST /flows/filter as per Prefect 3.x API
        # Use provided base_url and headers if available (from metadata.py)
        # Otherwise construct them (when called from get_connection)
        if base_url and headers:
            url = f"{base_url}/flows/filter"
            response = client.post(url, headers=headers, json={"limit": 1, "offset": 0})
        else:
            # Fallback: client already has base_url and headers configured
            response = client.post("/flows/filter", json={"limit": 1, "offset": 0})
        response.raise_for_status()

    test_fn = {"GetFlows": custom_test_connection}
    test_connection_steps(
        metadata=metadata,
        service_type="Prefect",
        test_fn=test_fn,
        automation_workflow=automation_workflow,
    )
