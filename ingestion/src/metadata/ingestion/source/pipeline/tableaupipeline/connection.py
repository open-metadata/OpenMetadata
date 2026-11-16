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
Source connection handler for Tableau Pipeline
"""

from __future__ import annotations

import traceback
from typing import TYPE_CHECKING

from tableauserverclient.server.endpoint.exceptions import (
    FailedSignInError,
    GraphQLError,
    InternalServerError,
    NonXMLResponseError,
)
from tableauserverclient.server.exceptions import EndpointUnavailableError

from metadata.core.connections.test_connection import (
    Diagnosis,
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.core.connections.test_connection.checks.rest import (
    call_endpoint,
    fetch_list,
)
from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection as TableauPipelineConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.tableau.connection import (
    METADATA_API_DOC,
    TABLEAU_ERRORS,
    build_server_config,
    set_verify_ssl,
)
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauPipelineClient,
    TableauSiteAdminRequiredError,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

logger = ingestion_logger()

PREP_CONDUCTOR_DOC = "https://help.tableau.com/current/prep/en-us/prep_conductor_overview.htm"
API_VERSIONS_DOC = "https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm"
JOBS_DOC = "https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_jobs_tasks_and_schedules.htm"

NO_FLOWS_CAVEAT = Diagnosis(
    title="No Prep flows visible",
    remediation="The site is readable but no published flow is visible to this user. Publish a flow, or grant "
    "the user View permission on the projects that hold them.",
)

NO_RUNS_CAVEAT = Diagnosis(
    title="No flow runs visible",
    remediation="Flows are readable but none has run yet, so no pipeline status will be ingested. Scheduled "
    "runs need Tableau Prep Conductor (Data Management); non-admins only see runs of flows they can view.",
    doc_url=PREP_CONDUCTOR_DOC,
)

# The shared Tableau rules cover HTTP statuses, SSL, site and network failures.
# These come first: TSC raises its own types for a failed sign-in, a 5xx, an
# endpoint the API version lacks and a non-XML answer, and none of them carries
# the status the shared rules read.
TABLEAU_PIPELINE_ERRORS = ErrorPack(
    when(Matchers.exception(FailedSignInError)).diagnose(
        "Authentication failed",
        fix="Tableau rejected the sign-in. Check the Personal Access Token name and secret (or the username "
        "and password), that the token has not expired, and that the Site Name matches the site they belong to.",
    ),
    when(Matchers.exception(EndpointUnavailableError)).diagnose(
        "REST API version too old",
        fix="The REST API version in use does not offer flows (REST API 3.3+) or flow runs (3.10+). If API "
        "Version is set, raise it; if not, the server version could not be read, so set it explicitly.",
        doc=API_VERSIONS_DOC,
    ),
    when(Matchers.exception(InternalServerError)).diagnose(
        "Tableau server error",
        fix="Tableau answered with a server error (5xx). Retry later, and check the Tableau Server logs if it "
        "persists.",
    ),
    when(Matchers.exception(NonXMLResponseError)).diagnose(
        "Host is not the Tableau REST API",
        fix="The host answered with something that is not a Tableau REST API response. Check Host and Port "
        "points at the Tableau server or Tableau Cloud pod and that no proxy rewrites the response.",
    ),
    when(Matchers.exception(TableauSiteAdminRequiredError)).diagnose(
        "Extract refresh history needs a site administrator",
        fix="Tableau only lists background jobs to server and site administrators, so extract refresh "
        "pipelines will be ingested without status. Use a site administrator account, or turn off "
        "Include Extract Refreshes.",
        doc=JOBS_DOC,
    ),
    when(Matchers.exception(GraphQLError)).diagnose(
        "Metadata API rejected the query",
        fix="The Tableau Metadata API answered but rejected the flow query, so pipelines and runs will be "
        "ingested without lineage. Check the Metadata API is enabled on Tableau Server (it is always on for "
        "Tableau Cloud) and that the user can see flows through it.",
        doc=METADATA_API_DOC,
    ),
).including(TABLEAU_ERRORS)


def get_connection(connection: TableauPipelineConnectionConfig) -> TableauPipelineClient:
    """
    Create connection to Tableau for Prep flow and extract refresh extraction.
    """
    tableau_server_auth = build_server_config(connection)
    verify_ssl, ssl_manager = set_verify_ssl(connection)
    try:
        return TableauPipelineClient(
            tableau_server_auth=tableau_server_auth,
            config=connection,
            verify_ssl=verify_ssl,
            ssl_manager=ssl_manager,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        # No client owns the certificate temp files yet, so nothing else removes them.
        if ssl_manager:
            ssl_manager.cleanup_temp_files()
        raise SourceConnectionException(
            f"Unknown error connecting to Tableau at {connection.hostPort}: {exc}."
        ) from exc


class TableauPipelineChecks:
    """Test-connection checks for Tableau Prep flows and extract refreshes.

    ``GetPipelines`` is the gate: borrowing the client signs in, so bad
    credentials or an unreachable server fail there and the rest are skipped.
    Runs, extract refresh jobs and lineage are optional - flows still ingest
    without them.
    """

    errors = TABLEAU_PIPELINE_ERRORS

    def __init__(self, server: Borrowed[TableauPipelineClient]) -> None:
        self._server = server

    @check(PipelineStep.GetPipelines)
    def get_pipelines(self) -> Evidence:
        return fetch_list(
            lambda: self._server.client.test_get_flows(),  # noqa: PLW0108
            noun="flow",
            command="fetch the Prep flows of the site",
            empty_caveat=NO_FLOWS_CAVEAT,
        )

    @check(PipelineStep.GetRuns)
    def get_runs(self) -> Evidence:
        return fetch_list(
            lambda: self._server.client.test_get_flow_runs(),  # noqa: PLW0108
            noun="flow run",
            command="fetch the flow runs of the site",
            empty_caveat=NO_RUNS_CAVEAT,
        )

    @check(PipelineStep.GetJobs)
    def get_jobs(self) -> Evidence:
        command = "fetch the extract refresh jobs of the site"
        if not self._server.client.config.includeExtractRefreshes:
            return Evidence(summary="extract refresh ingestion is turned off", command=command)
        return fetch_list(
            lambda: self._server.client.test_get_extract_refresh_jobs(),  # noqa: PLW0108
            noun="job",
            command=command,
        )

    @check(PipelineStep.GetLineage)
    def get_lineage(self) -> Evidence:
        command = "query flows through the Tableau Metadata API"
        call_endpoint(lambda: self._server.client.test_metadata_api(), command=command)  # noqa: PLW0108
        return Evidence(summary="Metadata API answers flow queries", command=command)


def _sign_out(client: TableauPipelineClient) -> None:
    """Best-effort: close() unwinds teardowns without catching, so a failed sign-out
    must not replace the error being unwound."""
    try:
        client.sign_out()
    except Exception:
        logger.warning("Tableau sign-out failed while closing the connection", exc_info=True)


class TableauPipelineConnection(BaseConnection[TableauPipelineConnectionConfig, TableauPipelineClient]):
    step_timeout_seconds = THREE_MIN

    def _get_client(self) -> TableauPipelineClient:
        client = get_connection(self.service_connection)
        # sign_out releases the server session and clears the SSL temp files.
        self._on_close(lambda: _sign_out(client))
        return client

    def checks(self) -> ChecksProvider:
        return TableauPipelineChecks(server=self.borrow())
