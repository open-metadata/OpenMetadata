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
Dashboard service step identity and shared check helpers.

Dashboard connectors reach their source over a REST API (with OAuth or token
auth), not a SQLAlchemy engine, so these helpers stay HTTP-generic: they call a
connector-supplied callable and summarize what it returned, and on failure raise
``CheckError`` carrying the label of the call they attempted, so a failed step
still reports its ``Evidence`` to the backend. The runner and the rest of the
package stay engine- and protocol-agnostic; connectors reuse these helpers from
their ``@check`` methods.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Sized

_T = TypeVar("_T")


# A check only needs to prove the list endpoint is reachable and returns items,
# not enumerate every one, so ``fetch_list`` counts at most this many and renders
# ``<cap>+`` when the count meets or exceeds it, keeping the summary bounded on
# huge tenants.
DEFAULT_LIST_CAP = 100


class DashboardStep(StepName):
    """The steps a dashboard connector can be asked to verify."""

    CheckAccess = "CheckAccess"
    GetDashboards = "GetDashboards"
    ServerInfo = "ServerInfo"
    ValidateApiVersion = "ValidateApiVersion"
    ValidateVersion = "ValidateVersion"
    ValidateSiteUrl = "ValidateSiteUrl"
    GetWorkbooks = "GetWorkbooks"
    GetViews = "GetViews"
    GetOwners = "GetOwners"
    GetDataModels = "GetDataModels"
    ListDashboards = "ListDashboards"
    ListLookMLModels = "ListLookMLModels"


def _count(number: int, noun: str, cap: int | None = None) -> str:
    """``3 dashboards`` / ``1 dashboard`` - pluralize the noun to match the count.

    When ``cap`` is given and the count meets or exceeds it, the figure is
    rendered ``<cap>+`` so a capped sample is not read as an exact total. The
    caller caps ``number`` at ``cap`` first, so this only ever renders ``<cap>+``
    at the boundary, never a larger bare number.
    """
    plural = noun if number == 1 else noun + "s"
    shown = f"{cap}+" if cap is not None and number >= cap else str(number)
    return f"{shown} {plural}"


def verify_access(authenticate: Callable[[], object], command: str) -> Evidence:
    """Prove the connector can authenticate against the REST API.

    Runs the connector's auth callable (e.g. an OAuth token acquisition) and, on
    failure, re-raises as ``CheckError`` carrying the attempted command so the
    gate step still reports what it tried.
    """
    try:
        authenticate()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    return Evidence(summary="authenticated", command=command)


def call_endpoint(call: Callable[[], _T], command: str) -> _T:
    """Call a REST endpoint and hand its result back to the check.

    For steps whose evidence is not a count: the check summarizes the returned
    value itself (an API version, a resolved owner). On failure, re-raise as
    ``CheckError`` carrying the attempted command so the failed step still
    reports what it ran.
    """
    try:
        return call()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause


def fetch_list(
    fetch: Callable[[], Sized | None],
    noun: str,
    command: str,
    cap: int = DEFAULT_LIST_CAP,
    empty_caveat: Diagnosis | None = None,
) -> Evidence:
    """Call a REST list endpoint and report how many items it returned.

    Reports the command it attempted and a count summary; the count is capped at
    ``cap`` and rendered ``<cap>+`` when it meets or exceeds it, so a huge tenant
    does not produce an unbounded figure. When the endpoint returns nothing and
    ``empty_caveat`` is given, the step still passes but carries the caveat as a
    non-blocking Warning - a connector opts in when "nothing visible" is worth
    surfacing (e.g. it may mean the fetch was filtered or silently failed rather
    than the source being genuinely empty). On failure, re-raise as ``CheckError``
    carrying the command so the failed step still reports what it ran.
    """
    try:
        items = fetch()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    count = min(len(items) if items else 0, cap)
    caveat = empty_caveat if count == 0 else None
    return Evidence(summary=f"{_count(count, noun, cap)} enumerated", command=command, caveat=caveat)
