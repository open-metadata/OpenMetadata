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
Unit tests for the connector ingestion User-Agent header.

The ometa REST client used to send every request with the default
``python-requests/<version>`` User-Agent. Workflows now identify themselves
with ``<connector>_<workflowType> (service: <name>; v<version>)`` so the
OpenMetadata server access logs show which connector and workflow issued
each call. Every part is best-effort: an unresolvable piece is dropped
rather than failing the workflow.
"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.sse_client import SSEClient
from metadata.ingestion.ometa.utils import MAX_USER_AGENT_LENGTH, sanitize_user_agent
from metadata.workflow.base import BaseWorkflow
from metadata.workflow.metadata import MetadataWorkflow

BASE_URL = "http://localhost:8585/api"

SNOWFLAKE_SOURCE = {
    "type": "snowflake",
    "serviceName": "local_snowflake",
    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
}


def _user_agent_for(source: dict) -> str | None:
    """Build the User-Agent a MetadataWorkflow would send for the given source config."""
    workflow = MetadataWorkflow.__new__(MetadataWorkflow)
    workflow.config = OpenMetadataWorkflowConfig.model_validate(
        {
            "source": source,
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": BASE_URL,
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "token"},
                }
            },
        }
    )
    return workflow._build_user_agent()


def test_rest_client_applies_configured_user_agent():
    client = REST(ClientConfig(base_url=BASE_URL, user_agent="snowflake_metadata (v1.10.0.0)"))

    assert client._session.headers["User-Agent"] == "snowflake_metadata (v1.10.0.0)"


def test_rest_client_keeps_default_user_agent_when_unset():
    client = REST(ClientConfig(base_url=BASE_URL))

    assert client._session.headers["User-Agent"].startswith("python-requests/")


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_includes_connector_workflow_and_service(*_):
    assert _user_agent_for(SNOWFLAKE_SOURCE) == "snowflake_metadata (service: local_snowflake; v1.10.0.0)"


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_reflects_workflow_type(*_):
    lineage_source = {**SNOWFLAKE_SOURCE, "sourceConfig": {"config": {"type": "DatabaseLineage"}}}
    profiler_source = {**SNOWFLAKE_SOURCE, "sourceConfig": {"config": {"type": "Profiler"}}}

    assert _user_agent_for(lineage_source) == "snowflake_lineage (service: local_snowflake; v1.10.0.0)"
    assert _user_agent_for(profiler_source) == "snowflake_profiler (service: local_snowflake; v1.10.0.0)"


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_falls_back_to_raw_type_for_unmapped_workflow(*_):
    """AutoClassification is absent from the pipeline-type map; we degrade to the raw discriminator."""
    auto_classification = {**SNOWFLAKE_SOURCE, "sourceConfig": {"config": {"type": "AutoClassification"}}}

    assert _user_agent_for(auto_classification) == "snowflake_AutoClassification (service: local_snowflake; v1.10.0.0)"


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_omits_service_when_absent(*_):
    assert _user_agent_for({**SNOWFLAKE_SOURCE, "serviceName": None}) == "snowflake_metadata (v1.10.0.0)"


@patch("metadata.workflow.ingestion.get_client_version", side_effect=RuntimeError("no version"))
def test_user_agent_omits_version_when_unavailable(*_):
    assert _user_agent_for(SNOWFLAKE_SOURCE) == "snowflake_metadata (service: local_snowflake)"


@patch("metadata.workflow.ingestion.get_client_version", side_effect=RuntimeError("no version"))
@patch("metadata.workflow.ingestion.IngestionWorkflow._resolve_workflow_type", return_value=None)
def test_user_agent_degrades_to_connector_only(*_):
    """Workflow type unresolved, no service and no version still yields a usable identifier."""
    assert (
        _user_agent_for({"type": "snowflake", "sourceConfig": {"config": {"type": "DatabaseMetadata"}}}) == "snowflake"
    )


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_is_none_without_connector_type(*_):
    workflow = MetadataWorkflow.__new__(MetadataWorkflow)
    workflow.config = OpenMetadataWorkflowConfig.model_validate(
        {
            "source": SNOWFLAKE_SOURCE,
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": BASE_URL,
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "token"},
                }
            },
        }
    )
    workflow.config.source.type = ""

    assert workflow._build_user_agent() is None


@patch("metadata.workflow.base.get_client_version", return_value="1.10.0.0")
def test_base_workflow_user_agent_includes_version(*_):
    assert BaseWorkflow._build_user_agent(object()) == "openmetadata-ingestion (v1.10.0.0)"


@patch("metadata.workflow.base.get_client_version", side_effect=RuntimeError("no version"))
def test_base_workflow_user_agent_degrades_without_version(*_):
    assert BaseWorkflow._build_user_agent(object()) == "openmetadata-ingestion"


def test_sanitize_user_agent_strips_crlf():
    assert sanitize_user_agent("snowflake\r\nInjected: header") == "snowflakeInjected: header"


def test_sanitize_user_agent_strips_control_characters():
    """NUL, BEL, ESC, DEL, tab and other C0/C1 control bytes get removed."""
    assert sanitize_user_agent("snow\x00fla\x07ke\x1bmeta\tdata\x7f") == "snowflakemetadata"


def test_sanitize_user_agent_strips_non_ascii():
    """Non-visible-ASCII bytes (incl. obs-text) are dropped to keep the header portable."""
    assert sanitize_user_agent("snowflake_metadáta_ñ") == "snowflake_metadta_"


def test_sanitize_user_agent_trims_surrounding_whitespace():
    assert sanitize_user_agent("   snowflake_metadata   ") == "snowflake_metadata"


def test_sanitize_user_agent_caps_length():
    sanitized = sanitize_user_agent("a" * (MAX_USER_AGENT_LENGTH + 50))

    assert sanitized is not None
    assert len(sanitized) == MAX_USER_AGENT_LENGTH


def test_sanitize_user_agent_returns_none_for_none():
    assert sanitize_user_agent(None) is None


def test_sanitize_user_agent_returns_none_for_empty_string():
    assert sanitize_user_agent("") is None


def test_sanitize_user_agent_returns_none_when_only_invalid_chars():
    """Pure CR/LF/NUL input collapses to empty and must fall back to the default agent."""
    assert sanitize_user_agent("\r\n\t\x00") is None


def test_rest_client_sanitizes_user_agent_before_setting_header():
    client = REST(ClientConfig(base_url=BASE_URL, user_agent="snowflake_metadata\r\nX-Injected: 1"))

    assert client._session.headers["User-Agent"] == "snowflake_metadataX-Injected: 1"


def test_rest_client_falls_back_to_default_when_user_agent_unsalvageable():
    """Garbage-only User-Agent must not poison the session header — keep the default."""
    client = REST(ClientConfig(base_url=BASE_URL, user_agent="\r\n\x00"))

    assert client._session.headers["User-Agent"].startswith("python-requests/")


def _capture_sse_headers(client: SSEClient) -> dict:
    """Run client.stream() once against a mocked requests.Session, returning the headers it sent."""
    client._validate_access_token = MagicMock()

    captured_headers: dict = {}
    fake_response = MagicMock()
    fake_response.__enter__.return_value = fake_response
    fake_response.__exit__.return_value = False
    fake_response.iter_lines.return_value = iter(["event: complete", "data: done", ""])

    fake_session = MagicMock()
    fake_session.__enter__.return_value = fake_session
    fake_session.__exit__.return_value = False

    def _capture_request(**kwargs):
        captured_headers.update(kwargs.get("headers") or {})
        return fake_response

    fake_session.request.side_effect = _capture_request

    with patch("metadata.ingestion.ometa.sse_client.requests.Session", return_value=fake_session):
        list(client.stream("GET", "/v1/events"))

    return captured_headers


def test_sse_client_sanitizes_user_agent():
    """SSE stream() must scrub CR/LF from the agent before httpx sees it."""
    client = SSEClient(ClientConfig(base_url=BASE_URL, user_agent="snowflake_metadata\r\nX-Injected: 1"))

    headers = _capture_sse_headers(client)

    assert headers["User-Agent"] == "snowflake_metadataX-Injected: 1"


def test_sse_client_omits_user_agent_when_unsalvageable():
    client = SSEClient(ClientConfig(base_url=BASE_URL, user_agent="\r\n\x00"))

    headers = _capture_sse_headers(client)

    assert "User-Agent" not in headers


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_sanitizes_service_name(*_):
    """A serviceName carrying CR/LF cannot inject a header line — strip control chars in place."""
    poisoned = {**SNOWFLAKE_SOURCE, "serviceName": "local_snowflake\r\nX-Injected: 1"}

    assert _user_agent_for(poisoned) == "snowflake_metadata (service: local_snowflakeX-Injected: 1; v1.10.0.0)"


@patch("metadata.workflow.ingestion.get_client_version", return_value="1.10.0.0")
def test_user_agent_drops_service_name_when_only_control_chars(*_):
    """A serviceName that sanitizes to empty must be omitted, not interpolated as blank."""
    poisoned = {**SNOWFLAKE_SOURCE, "serviceName": "\r\n\x00"}

    assert _user_agent_for(poisoned) == "snowflake_metadata (v1.10.0.0)"
