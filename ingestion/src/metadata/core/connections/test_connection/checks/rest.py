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
from metadata.core.connections.test_connection.checks.summary import count
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Sized

_T = TypeVar("_T")

# Cap on the items ``fetch_list`` counts, so a huge tenant stays bounded.
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
