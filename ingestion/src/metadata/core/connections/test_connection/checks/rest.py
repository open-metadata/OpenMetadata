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
Shared check helpers for connectors that reach their source over a REST API.

Dashboard and pipeline connectors authenticate with OAuth or a token and read
list endpoints; neither has a SQLAlchemy engine, so their checks reduce to the
same two shapes: run a connector-supplied callable, and summarize what it
returned. These helpers stay protocol-generic - they never touch a client, a
status code, or a response body - so the runner and the rest of the package stay
engine- and protocol-agnostic.

On failure every helper re-raises as ``CheckError`` carrying the label of the
call it attempted, so a failed step still reports its ``Evidence`` to the
backend. A connector imports these directly and takes its step identity from the
matching vertical module (``checks.dashboard`` / ``checks.pipeline``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.summary import count
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Sized

    from metadata.core.connections.test_connection.classifier import Matcher

_T = TypeVar("_T")


def response_status(error: BaseException) -> int | None:
    """The HTTP status of a REST error, from the two shapes ``requests`` produces.

    An SDK error usually exposes the status directly on ``.status_code``; a raw
    ``requests.HTTPError`` carries it one level down at ``.response.status_code``.
    A connector whose SDK reports the status somewhere else (in an error document,
    or encoded in a vendor code) passes its own extractor to ``http_status``.
    """
    code = getattr(error, "status_code", None)
    if not isinstance(code, int):
        code = getattr(getattr(error, "response", None), "status_code", None)
    return code if isinstance(code, int) else None


def http_status(*codes: int, extract: Callable[[BaseException], int | None] = response_status) -> Matcher:
    """Match a REST error by HTTP status, across the cause chain.

    The status is the stable signal - an error's message and detail vary by
    endpoint, tenant, and server version. ``extract`` says where this connector's
    SDK keeps it; the default covers the plain ``requests`` shapes.
    """
    wanted = frozenset(codes)
    return lambda error: any(extract(current) in wanted for current in exception_chain(error))


# A check only needs to prove the list endpoint is reachable and returns items,
# not enumerate every one, so ``fetch_list`` counts at most this many and renders
# ``<cap>+`` when the count meets or exceeds it, keeping the summary bounded on
# huge tenants and accounts.
DEFAULT_LIST_CAP = 100


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
    counted = min(len(items) if items else 0, cap)
    caveat = empty_caveat if counted == 0 else None
    return Evidence(summary=f"{count(counted, noun, cap)} enumerated", command=command, caveat=caveat)
