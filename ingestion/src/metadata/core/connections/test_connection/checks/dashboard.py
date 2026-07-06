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

from typing import TYPE_CHECKING

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.records import Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Sized


class DashboardStep(StepName):
    """The steps a dashboard connector can be asked to verify."""

    CheckAccess = "CheckAccess"
    GetDashboards = "GetDashboards"


def _count(number: int, noun: str) -> str:
    """``3 dashboards`` / ``1 dashboard`` - pluralize the noun to match the count."""
    return f"{number} {noun if number == 1 else noun + 's'}"


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


def fetch_list(fetch: Callable[[], Sized | None], noun: str, command: str) -> Evidence:
    """Call a REST list endpoint and report how many items it returned.

    Reports the command it attempted and a count summary. On failure, re-raise as
    ``CheckError`` carrying the command so the failed step still reports what it
    ran.
    """
    try:
        items = fetch()
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    count = len(items) if items else 0
    return Evidence(summary=f"{_count(count, noun)} enumerated", command=command)
