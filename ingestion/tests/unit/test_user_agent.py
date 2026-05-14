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

from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
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
