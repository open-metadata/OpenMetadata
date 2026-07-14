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
Source connection handler
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import MissingSchema, SSLError, Timeout

from metadata.core.connections.test_connection import (
    Diagnosis,
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.pipeline import (
    PipelineStep,
    fetch_list,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection as DBTCloudConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.dbtcloud.client import (
    DBTCloudApiError,
    DBTCloudClient,
)

if TYPE_CHECKING:
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

ACCOUNT_ID_DOC = "https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens"


def _http_status(*codes: int) -> Matcher:
    """Match a dbt Cloud API error by HTTP status, across the cause chain.

    The status is the stable signal - dbt Cloud's error text varies by endpoint.
    """
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        return any(
            isinstance(current, DBTCloudApiError) and current.status_code in wanted
            for current in exception_chain(error)
        )

    return match


NO_JOBS_CAVEAT = Diagnosis(
    title="No jobs visible",
    remediation="The account is reachable but exposes no job. Check that the account has at least "
    "one dbt Cloud job defined and that the token's permission set covers the project it "
    "belongs to; ingestion reads pipelines from jobs, so it would otherwise find nothing.",
)

DBTCLOUD_ERRORS = ErrorPack(
    when(_http_status(401)).diagnose(
        "Authentication failed",
        fix="dbt Cloud rejected the token (401). Check the Token is a valid, unexpired service "
        "token or personal access token for this account.",
        doc=ACCOUNT_ID_DOC,
    ),
    when(_http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The token is valid but not authorized for this account (403). Grant its permission "
        "set at least read access to the jobs and runs of the projects to ingest.",
        doc=ACCOUNT_ID_DOC,
    ),
    when(_http_status(404)).diagnose(
        "Account not found",
        fix="dbt Cloud could not find the account (404). Check the Account Id - it is the number "
        "in the dbt Cloud URL, https://<host>/deploy/<accountId>/... - and that Host matches the "
        "region the account lives in.",
    ),
    when(_http_status(429)).diagnose(
        "Rate limited",
        fix="dbt Cloud is rate limiting the token (429). Wait for the limit to reset and retry; if "
        "it persists, use a token that is not shared with other integrations.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The certificate presented by the host could not be verified. Check that Host points at "
        "dbt Cloud and that any TLS-intercepting proxy on the path is trusted where ingestion runs.",
    ),
    when(Matchers.exception(Timeout)).diagnose(
        "Connection timed out",
        fix="dbt Cloud did not answer in time; check that a firewall, security group, or network "
        "ACL allows egress to the Host from where ingestion runs.",
    ),
    when(Matchers.exception(MissingSchema)).diagnose(
        "Invalid host",
        fix="Host must be an absolute URL including the scheme, e.g. https://cloud.getdbt.com.",
    ),
    when(Matchers.exception(RequestsConnectionError)).diagnose(
        "Cannot reach the host",
        fix="Check Host for typos, that DNS resolves it, and that it is reachable from where "
        "ingestion runs - dbt Cloud is regional, e.g. https://emea.dbt.com.",
    ),
).including(NETWORK_ERRORS)


class DBTCloudChecks:
    """Test-connection checks for dbt Cloud.

    ``CheckAccess`` is the gate: it reads the first page of one job, the smallest
    authenticated call that proves the host, the token and the account id at once,
    so a bad token or a wrong account fails there and the remaining steps are
    skipped rather than each re-dialling the API.

    The client is the one ``BaseConnection`` owns, not a second one built here.
    Constructing it opens no connection - it only builds the REST client config and
    a session - so the gate is still the first call that reaches dbt Cloud.
    """

    errors = DBTCLOUD_ERRORS

    def __init__(self, client: DBTCloudClient) -> None:
        self._client = client

    @check(PipelineStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            self._client.test_check_access,
            command="read one job of the configured account",
        )

    @check(PipelineStep.GetJobs)
    def get_jobs(self) -> Evidence:
        return fetch_list(
            self._client.test_get_jobs,
            noun="job",
            command="fetch the jobs of the account",
            empty_caveat=NO_JOBS_CAVEAT,
        )

    @check(PipelineStep.GetRuns)
    def get_runs(self) -> Evidence:
        return fetch_list(
            self._client.test_get_runs,
            noun="run",
            command="fetch the runs of the account",
        )


class DBTCloudConnection(BaseConnection[DBTCloudConnectionConfig, DBTCloudClient]):
    def _get_client(self) -> DBTCloudClient:
        return DBTCloudClient(self.service_connection)

    def checks(self) -> ChecksProvider:
        return DBTCloudChecks(client=self.client)
