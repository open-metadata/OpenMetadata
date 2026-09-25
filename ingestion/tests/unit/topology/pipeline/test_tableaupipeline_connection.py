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
"""Tableau pipeline connection handling and its test-connection checks."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from tableauserverclient.server.endpoint.exceptions import (
    GraphQLError,
    ServerResponseError,
)

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection as TableauPipelineConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauSiteAdminRequiredError,
)
from metadata.ingestion.source.pipeline.tableaupipeline.connection import (
    TABLEAU_PIPELINE_ERRORS,
    TableauPipelineChecks,
    TableauPipelineConnection,
    get_connection,
)
from metadata.ingestion.source.pipeline.tableaupipeline.service_spec import ServiceSpec

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.tableaupipeline.connection"
TEST_CONNECTION_DEFINITION = (
    Path(__file__).parents[5]
    / "openmetadata-service/src/main/resources/json/data/testConnections/pipeline/tableaupipeline.json"
)


def _config(**overrides) -> TableauPipelineConnectionConfig:
    return TableauPipelineConnectionConfig(
        hostPort="https://tableau.example.com",
        authType={"personalAccessTokenName": "pat", "personalAccessTokenSecret": "secret"},
        siteName="MarketingTeam",
        **overrides,
    )


@pytest.fixture
def client():
    return MagicMock()


@pytest.fixture
def checks(client):
    return TableauPipelineChecks(server=Borrowed.of(client))


def test_service_spec_uses_the_base_connection():
    assert ServiceSpec.connection_class == f"{CONNECTION_MODULE}.TableauPipelineConnection"
    assert issubclass(TableauPipelineConnection, BaseConnection)


def test_every_definition_step_has_a_check():
    """A step without a check is silently Skipped, so the JSON definition and the
    provider must name the same steps."""
    steps = {step["name"] for step in json.loads(TEST_CONNECTION_DEFINITION.read_text())["steps"]}
    with patch(f"{CONNECTION_MODULE}.get_connection"):
        resolved = collect_checks(TableauPipelineConnection(_config()).checks())

    assert set(resolved) == {
        PipelineStep.GetPipelines,
        PipelineStep.GetRuns,
        PipelineStep.GetJobs,
        PipelineStep.GetLineage,
    }
    assert steps == {step.value for step in resolved}


def test_get_connection_signs_in_with_the_pat_and_ssl_mode():
    with patch(f"{CONNECTION_MODULE}.TableauPipelineClient") as client_cls:
        get_connection(_config(verifySSL="ignore"))

    kwargs = client_cls.call_args.kwargs
    assert kwargs["verify_ssl"] is False
    assert kwargs["tableau_server_auth"].token_name == "pat"
    assert kwargs["tableau_server_auth"].site_id == "MarketingTeam"


def test_get_connection_wraps_client_failures():
    with (
        patch(f"{CONNECTION_MODULE}.TableauPipelineClient", side_effect=RuntimeError("boom")),
        pytest.raises(SourceConnectionException, match="boom"),
    ):
        get_connection(_config())


def test_closing_the_connection_signs_out():
    with patch(f"{CONNECTION_MODULE}.get_connection") as build:
        conn = TableauPipelineConnection(_config())
        _ = conn.client
        conn.close()

    build.return_value.sign_out.assert_called_once_with()


def test_get_pipelines_counts_flows(checks, client):
    client.test_get_flows.return_value = [MagicMock()]

    evidence = checks.get_pipelines()

    assert evidence.summary == "1 flow enumerated"
    assert evidence.caveat is None


def test_get_pipelines_caveats_a_site_with_no_flows(checks, client):
    client.test_get_flows.return_value = []

    assert checks.get_pipelines().caveat.title == "No Prep flows visible"


def test_get_runs_caveats_flows_that_never_ran(checks, client):
    client.test_get_flow_runs.return_value = []

    assert checks.get_runs().caveat.title == "No flow runs visible"


def test_get_jobs_is_skipped_when_extract_refreshes_are_off(checks, client):
    client.config.includeExtractRefreshes = False

    evidence = checks.get_jobs()

    assert evidence.summary == "extract refresh ingestion is turned off"
    client.test_get_extract_refresh_jobs.assert_not_called()


def test_get_jobs_counts_the_jobs(checks, client):
    client.config.includeExtractRefreshes = True
    client.test_get_extract_refresh_jobs.return_value = [MagicMock(), MagicMock()]

    assert checks.get_jobs().summary == "2 jobs enumerated"


def test_a_non_admin_is_told_jobs_need_a_site_administrator():
    diagnosis = TABLEAU_PIPELINE_ERRORS.classify(TableauSiteAdminRequiredError("403004"))

    assert diagnosis.title == "Extract refresh history needs a site administrator"


def test_get_lineage_reports_what_it_ran_when_it_fails(checks, client):
    client.test_metadata_api.side_effect = GraphQLError([{"message": "disabled"}])

    with pytest.raises(CheckError) as failure:
        checks.get_lineage()

    assert failure.value.evidence.command == "query flows through the Tableau Metadata API"


def test_metadata_api_errors_are_diagnosed():
    diagnosis = TABLEAU_PIPELINE_ERRORS.classify(GraphQLError([{"message": "disabled"}]))

    assert diagnosis.title == "Metadata API query failed"


def test_shared_tableau_auth_diagnosis_still_applies():
    diagnosis = TABLEAU_PIPELINE_ERRORS.classify(ServerResponseError("401002", "Unauthorized", "bad token"))

    assert diagnosis.title == "Authentication failed"
