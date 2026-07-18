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
Check helpers for the REST-backed verticals (dashboard, pipeline).

Each runs a connector-supplied callable and summarizes what it returned, raising
``CheckError`` with the attempted command on failure. Step identity comes from
the matching vertical module; matchers live in ``classifier``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Sized

    from metadata.core.connections.test_connection.classifier import Matcher

_T = TypeVar("_T")

# Cap on the items ``fetch_list`` counts, so a huge tenant stays bounded.
DEFAULT_LIST_CAP = 100


def verify_access(authenticate: Callable[[], object], command: str) -> Evidence:
    """Run the connector's auth callable, proving it can reach the REST API."""
    try:
        authenticate()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    return Evidence(summary="authenticated", command=command)


def call_endpoint(call: Callable[[], _T], command: str) -> _T:
    """Call a REST endpoint and hand its result back, for a check that summarizes it itself."""
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

    ``empty_caveat`` makes an empty result a non-blocking Warning; a connector
    opts in when "nothing visible" may mean the fetch was filtered rather than
    the source being empty.
    """
    try:
        items = fetch()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    counted = min(len(items) if items else 0, cap)
    caveat = empty_caveat if counted == 0 else None
    return Evidence(summary=enumerated(counted, noun, cap), command=command, caveat=caveat)


def response_status(error: BaseException) -> int | None:
    """The HTTP status a ``requests``-shaped error carries, or ``None``."""
    code = getattr(error, "status_code", None)
    if not isinstance(code, int):
        code = getattr(getattr(error, "response", None), "status_code", None)
    return code if isinstance(code, int) else None


def http_status(*codes: int, extract: Callable[[BaseException], int | None] = response_status) -> Matcher:
    """Match a REST error by HTTP status. ``extract`` says where the SDK keeps it."""
    wanted = frozenset(codes)
    return lambda error: any(extract(current) in wanted for current in exception_chain(error))


# A check only needs to prove the list endpoint is reachable and returns items,
# not enumerate every one, so ``fetch_list`` counts at most this many and renders
# ``<cap>+`` when the count meets or exceeds it, keeping the summary bounded on
# huge tenants and accounts.
