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
"""Verify the REST client request timeout."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, Thread
from time import monotonic
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@patch("metadata.ingestion.ometa.client.requests.Session.request")
def test_rest_client_timeout(mock_request: Mock) -> None:
    """Keep the default and allow an explicit client timeout."""
    mock_request.return_value.text = '{"status": "ok"}'
    mock_request.return_value.json.return_value = {"status": "ok"}

    REST(ClientConfig(base_url="http://localhost:8585/api")).get("/test")
    assert "timeout" not in mock_request.call_args.kwargs

    REST(ClientConfig(base_url="http://localhost:8585/api", timeout=60)).get("/test")
    assert mock_request.call_args.kwargs["timeout"] == 60


@patch("metadata.ingestion.ometa.ometa_api.SecretsManagerFactory")
@patch("metadata.ingestion.ometa.ometa_api.OpenMetadataAuthenticationProvider.create")
@patch.object(OpenMetadata, "log_user_name_from_jwt_token")
@patch("metadata.ingestion.ometa.client.requests.Session.request")
def test_recipe_timeout_override(
    mock_request: Mock,
    _mock_log_user: Mock,
    mock_auth_provider: Mock,
    _mock_secrets_manager: Mock,
) -> None:
    """Apply a recipe timeout only when the recipe supplies it."""
    mock_auth_provider.return_value.get_access_token.return_value = ("token", 3600)
    mock_request.return_value.text = '{"status": "ok"}'
    mock_request.return_value.json.return_value = {"status": "ok"}

    workflow = WorkflowConfig.model_validate(
        {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "enableVersionValidation": False,
            }
        }
    )
    OpenMetadata(workflow.openMetadataServerConfig).client.get("/test")
    assert "timeout" not in mock_request.call_args.kwargs

    workflow = WorkflowConfig.model_validate(
        {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "enableVersionValidation": False,
                "timeout": 60,
            }
        }
    )
    OpenMetadata(workflow.openMetadataServerConfig).client.get("/test")
    assert mock_request.call_args.kwargs["timeout"] == 60

    with pytest.raises(ValidationError):
        WorkflowConfig.model_validate(
            {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "timeout": 0,
                }
            }
        )

    overridden = OpenMetadata(
        workflow.openMetadataServerConfig,
        additional_client_config_arguments={"timeout": 30},
    )
    overridden.client.get("/test")
    assert mock_request.call_args.kwargs["timeout"] == 30


def test_explicit_timeout_expires_when_server_stops_responding() -> None:
    """End an explicit request timeout when the server sends no response."""
    release = Event()

    class UnresponsiveHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            release.wait(8)

    server = ThreadingHTTPServer(("127.0.0.1", 0), UnresponsiveHandler)
    server_thread = Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        client = REST(
            ClientConfig(
                base_url=f"http://127.0.0.1:{server.server_port}/api", timeout=1
            )
        )
        started = monotonic()
        assert client.get("/test") is None
        assert monotonic() - started < 4
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)
