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
from requests.exceptions import JSONDecodeError, SSLError, Timeout

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
    fetch_list,
    http_status,
    verify_access,
)
from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection as DBTCloudConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.dbtcloud.client import (
    DBTCloudApiError,
    DBTCloudClient,
)

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

TOKENS_DOC = "https://docs.getdbt.com/docs/dbt-apis/authentication"
RATE_LIMITS_DOC = "https://docs.getdbt.com/docs/dbt-apis/rate-limits"

ACCOUNT_ID_FIX = (
    "Check the Account Id - it is the number in https://<host>/settings/accounts/<accountId>/ - "
    "and that the Token belongs to that account."
)


def _dbt_status(error: BaseException) -> int | None:
    """The status of a dbt Cloud API error only.

    Narrower than the shared default on purpose: the client raises
    ``DBTCloudApiError`` for every non-2xx, so anything else carrying a
    ``status_code`` is not a dbt Cloud API answer and must not be diagnosed as one.
    """
    return error.status_code if isinstance(error, DBTCloudApiError) else None


NO_JOBS_CAVEAT = Diagnosis(
    title="No jobs visible",
    remediation="The account is readable but has no job. Ingestion reads pipelines from dbt Cloud "
    "jobs, so it would find nothing.",
)

DBTCLOUD_ERRORS = ErrorPack(
    # A wrong account id answers 403 "Token is not scoped to account.", never 404.
    when(Matchers.contains("not scoped to account")).diagnose(
        "Token is not scoped to this account",
        fix=ACCOUNT_ID_FIX,
        doc=TOKENS_DOC,
    ),
    when(http_status(401, extract=_dbt_status)).diagnose(
        "Authentication failed",
        fix="dbt Cloud rejected the token. Check Token holds a current service token or personal access token, copied "
        "whole and not expired.",
        doc=TOKENS_DOC,
    ),
    when(http_status(403, extract=_dbt_status)).diagnose(
        "Access denied",
        fix=f"dbt Cloud refused the request. {ACCOUNT_ID_FIX} If both are right, check the token's "
        "permission set covers the projects to ingest.",
        doc=TOKENS_DOC,
    ),
    when(http_status(404, extract=_dbt_status)).diagnose(
        "Endpoint not found",
        fix=f"Host and Account Id build the path the API answered 404 for. {ACCOUNT_ID_FIX}",
    ),
    when(http_status(429, extract=_dbt_status)).diagnose(
        "Rate limited",
        fix="dbt Cloud limits the API to 5,000 requests a minute per account, and then makes you wait. Try again in about "
        "five minutes.",
        doc=RATE_LIMITS_DOC,
    ),
    # A Host that is a valid URL but not the dbt Cloud API (e.g. the marketing site)
    # redirects to an HTML page, which answers 200 and fails to decode.
    when(Matchers.exception(JSONDecodeError)).diagnose(
        "Host is not the dbt Cloud API",
        fix="The address in Host returned something that is not the dbt Cloud API. Set it to your dbt Cloud access URL, "
        "for example https://cloud.getdbt.com.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The certificate could not be verified from where ingestion runs. Check Host points at dbt Cloud, and if your "
        "network inspects TLS traffic, that its certificate is trusted on that machine.",
    ),
    when(Matchers.exception(Timeout)).diagnose(
        "Connection timed out",
        fix="dbt Cloud did not answer in time. Check that a firewall or network ACL lets the machine ingestion runs on "
        "reach the address in Host.",
    ),
    when(Matchers.exception(RequestsConnectionError)).diagnose(
        "Cannot reach the host",
        fix="Could not reach the address in Host. Check it for typos - dbt Cloud is regional, so the access URL is "
        "different depending on where your account is hosted.",
    ),
)
# NETWORK_ERRORS not folded in: the requests-typed rules above already claim every
# network failure, and NetworkUnreachableError needs a tcp_probe this connector
# never runs. No preflight added - it would break a proxied setup (requests honours
# HTTPS_PROXY, a raw probe does not).


class DBTCloudChecks:
    """Test-connection checks for dbt Cloud.

    ``CheckAccess`` is the gate: it reads one job, which proves the host, the token
    and the account id at once, so the later steps are skipped rather than each
    re-dialling the API. The client is borrowed from the connection that owns it.
    """

    errors = DBTCLOUD_ERRORS

    def __init__(self, dbt: Borrowed[DBTCloudClient]) -> None:
        self._dbt = dbt

    @check(PipelineStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._dbt.client.test_check_access(),  # noqa: PLW0108
            command="read one job of the configured account",
        )

    @check(PipelineStep.GetJobs)
    def get_jobs(self) -> Evidence:
        return fetch_list(
            lambda: self._dbt.client.test_get_jobs(),  # noqa: PLW0108
            noun="job",
            command="fetch the jobs of the account",
            empty_caveat=NO_JOBS_CAVEAT,
        )

    @check(PipelineStep.GetRuns)
    def get_runs(self) -> Evidence:
        return fetch_list(
            lambda: self._dbt.client.test_get_runs(),  # noqa: PLW0108
            noun="run",
            command="fetch the runs of the account",
        )


class DBTCloudConnection(BaseConnection[DBTCloudConnectionConfig, DBTCloudClient]):
    def _get_client(self) -> DBTCloudClient:
        return DBTCloudClient(self.service_connection)

    def checks(self) -> ChecksProvider:
        return DBTCloudChecks(dbt=self.borrow())
