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
Database service step identity and shared check helpers.

This is the only place in the test-connection core that knows about SQLAlchemy:
the runner and the rest of the package stay engine-agnostic. Connectors reuse
these helpers from their ``@check`` methods. On failure the helpers raise
``CheckError`` carrying the command they attempted, so a failed step still
reports its ``Evidence`` to the backend.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING

from sqlalchemy import event, inspect

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.network import (
    NetworkUnreachableError,
    tcp_probe,
)
from metadata.core.connections.test_connection.records import Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator, Sequence

    from sqlalchemy.engine import Engine, Row
    from sqlalchemy.engine.reflection import Inspector


# A check only needs to prove a statement runs, not return its whole result, so
# probes fetch at most this many rows instead of the full (potentially huge) set.
DEFAULT_SAMPLE_ROWS = 100


class DatabaseStep(StepName):
    """The steps a database connector can be asked to verify."""

    CheckAccess = "CheckAccess"
    GetDatabases = "GetDatabases"
    GetSchemas = "GetSchemas"
    GetTables = "GetTables"
    GetViews = "GetViews"
    GetQueries = "GetQueries"
    GetTags = "GetTags"
    GetStreams = "GetStreams"
    GetColumnMetadata = "GetColumnMetadata"
    GetTableComments = "GetTableComments"
    GetInformationSchemaColumns = "GetInformationSchemaColumns"


@contextmanager
def _captured_sql(client: Engine) -> Iterator[list[str]]:
    """Record the SQL the dialect emits within the wrapped call.

    ``inspect()`` hides the dialect-specific reflection query; capturing it keeps
    the reported ``command`` the real statement, without hard-coding any SQL here.
    The listener is scoped to the wrapped call, which the runner makes
    sequentially on a single thread, so no other query on the engine races it.
    """
    statements: list[str] = []

    def record(
        conn: object,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        statements.append(statement)

    event.listen(client, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(client, "before_cursor_execute", record)


def _without_header(statement: str) -> str:
    """Drop the leading OpenMetadata attribution comment for display.

    The engine prepends ``/* {"app": "OpenMetadata", ...} */`` to every statement
    (for query attribution); it is still sent, but it is noise in the reported
    command, so we strip it here.
    """
    text = statement.lstrip()
    if text.startswith("/*"):
        end = text.find("*/")
        if end != -1:
            text = text[end + 2 :]
    return text.strip()


def _command(statements: list[str]) -> str | None:
    return "; ".join(_without_header(s) for s in statements) or None


def _resolved_command(captured: list[str], statement: str | None = None) -> str | None:
    """The captured SQL, falling back to the raw statement (header stripped)."""
    return _command(captured) or (_without_header(statement) if statement is not None else None)


def run_sql(
    client: Engine,
    statement: str,
    summarize: Callable[[Sequence[Row]], str],
    max_rows: int = DEFAULT_SAMPLE_ROWS,
) -> Evidence:
    """Run a statement and report the command plus a summary of its rows.

    Fetches at most ``max_rows`` so a check that probes an unbounded statement
    cannot pull the whole result into memory. On failure, re-raise as
    ``CheckError`` carrying the attempted command, so the failed step still
    reports what it ran.
    """
    with _captured_sql(client) as captured:
        try:
            with client.connect() as conn:
                rows = conn.exec_driver_sql(statement).fetchmany(max_rows)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=_resolved_command(captured, statement))) from cause
    return Evidence(summary=summarize(rows), command=_resolved_command(captured, statement))


def ping(client: Engine) -> Evidence:
    """Open a connection and run a trivial query to prove access.

    A TCP reachability preflight runs first when the engine URL carries a host
    and port, so an unreachable host fails as a network problem before the
    driver, TLS, or auth is exercised. Engines without a host:port (file-based
    URLs, connector-tunnelled engines) skip the preflight and go straight to the
    query.

    The preflight assumes the driver connects directly to the URL's host:port. A
    connector whose transport differs while the URL still carries a host:port
    (an HTTP gateway, a load balancer, a unix socket) should call ``run_sql``
    directly instead of ``ping`` to avoid a spurious reachability failure.
    """
    _preflight(client)
    return run_sql(client, "SELECT 1", lambda _: "connection established")


def _preflight(client: Engine) -> None:
    host, port = client.url.host, client.url.port
    if host and port:
        try:
            tcp_probe(host, port)
        except NetworkUnreachableError as error:
            raise CheckError(error, Evidence(command=f"TCP connect {host}:{port}")) from error


def _reflect(client: Engine, operation: Callable[[], list[str]]) -> tuple[list[str], str | None]:
    """Run an inspector reflection op, capturing the SQL it emits.

    On failure, re-raise as ``CheckError`` carrying the captured command.
    """
    with _captured_sql(client) as captured:
        try:
            result = operation()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=_resolved_command(captured))) from cause
    return result, _resolved_command(captured)


def _resolve_schema(
    inspector: Inspector, schema: str | None, system_schemas: frozenset[str]
) -> tuple[str | None, bool]:
    """Return the schema to probe and whether it was auto-selected.

    A configured ``schema`` is used as-is. Otherwise the first schema that the
    connector did not flag as a system schema is picked, so table/view checks
    still probe real data when ``databaseSchema`` is left unset.
    """
    if schema:
        return schema, False
    avoid = {name.lower() for name in system_schemas}
    for candidate in inspector.get_schema_names() or []:
        if candidate.lower() not in avoid:
            return candidate, True
    return None, False


def _count(n: int, noun: str) -> str:
    """``3 tables`` / ``1 table`` - pluralize the noun to match the count."""
    return f"{n} {noun if n == 1 else noun + 's'}"


def _enumerated(kind: str, count: int, schema: str | None, auto_selected: bool) -> str:
    counted = _count(count, kind)
    if schema is None:
        return f"{counted} enumerated"
    if auto_selected:
        return f"{counted} in schema '{schema}', auto-selected because no databaseSchema was configured"
    return f"{counted} in schema '{schema}'"


def list_schemas(client: Engine) -> Evidence:
    names, command = _reflect(client, lambda: inspect(client).get_schema_names())
    return Evidence(summary=f"{_count(len(names), 'schema')} enumerated", command=command)


def list_tables(client: Engine, schema: str | None, system_schemas: frozenset[str] = frozenset()) -> Evidence:
    inspector = inspect(client)
    target, auto_selected = _resolve_schema(inspector, schema, system_schemas)
    names, command = _reflect(client, lambda: inspector.get_table_names(target))
    return Evidence(
        summary=_enumerated("table", len(names), target, auto_selected),
        command=command,
    )


def list_views(client: Engine, schema: str | None, system_schemas: frozenset[str] = frozenset()) -> Evidence:
    inspector = inspect(client)
    target, auto_selected = _resolve_schema(inspector, schema, system_schemas)
    names, command = _reflect(client, lambda: inspector.get_view_names(target))
    return Evidence(
        summary=_enumerated("view", len(names), target, auto_selected),
        command=command,
    )
