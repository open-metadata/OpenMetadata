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
Database service step identity and check helpers.

The only place in the test-connection core that knows about SQLAlchemy.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING

from sqlalchemy import event, inspect

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.checks.summary import count, enumerated
from metadata.core.connections.test_connection.network import probe_or_fail
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator, Sequence

    from sqlalchemy.engine import Engine, Row
    from sqlalchemy.engine.reflection import Inspector


# Rows a probe fetches; proving a statement runs never needs the whole result.
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
    GetAccessHistory = "GetAccessHistory"
    GetColumnMetadata = "GetColumnMetadata"
    GetTableComments = "GetTableComments"
    GetInformationSchemaColumns = "GetInformationSchemaColumns"
    GetViewDefinitions = "GetViewDefinitions"
    GetCatalogTags = "GetCatalogTags"
    GetSchemaTags = "GetSchemaTags"
    GetTableTags = "GetTableTags"
    GetColumnTags = "GetColumnTags"
    GetTableLineage = "GetTableLineage"
    GetColumnLineage = "GetColumnLineage"


@contextmanager
def _captured_sql(client: Engine) -> Iterator[list[str]]:
    """Record the SQL the dialect emits within the wrapped call.

    Scoped to the wrapped call; safe because the runner drives checks
    sequentially on one thread.
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
    """Drop the leading ``/* {"app": "OpenMetadata"} */`` attribution comment."""
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
    """Run a statement, reporting the command and a summary of at most ``max_rows`` rows."""
    with _captured_sql(client) as captured:
        try:
            with client.connect() as conn:
                rows = conn.exec_driver_sql(statement).fetchmany(max_rows)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=_resolved_command(captured, statement))) from cause
    return Evidence(summary=summarize(rows), command=_resolved_command(captured, statement))


def ping(client: Engine) -> Evidence:
    """Open a connection and run ``SELECT 1``, TCP-probing host:port first.

    The probe assumes the driver dials the URL's host:port directly. A connector
    whose transport differs (gateway, load balancer, unix socket) should call
    ``run_sql`` instead, to avoid a spurious reachability failure.
    """
    _preflight(client)
    return run_sql(client, "SELECT 1", lambda _: "connection established")


def _preflight(client: Engine) -> None:
    host, port = client.url.host, client.url.port
    if host and port:
        probe_or_fail(host, port)


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
    """The schema to probe, and whether it was auto-selected.

    Falls back to the first non-system schema so the checks still probe real data.
    """
    if schema:
        return schema, False
    avoid = {name.lower() for name in system_schemas}
    for candidate in inspector.get_schema_names() or []:
        if candidate.lower() not in avoid:
            return candidate, True
    return None, False


def _in_schema(kind: str, number: int, schema: str | None, auto_selected: bool) -> str:
    """``3 tables in schema 'sales'``; falls back to ``enumerated`` with no schema.

    Reflection returns every name, so the count carries no cap.
    """
    if schema is None:
        return enumerated(number, kind)
    counted = count(number, kind)
    if auto_selected:
        return f"{counted} in schema '{schema}', auto-selected because no databaseSchema was configured"
    return f"{counted} in schema '{schema}'"


def _empty_caveat(kind: str, scope: str) -> Diagnosis:
    """A non-blocking advisory for a scope that exposes none of ``kind``.

    An empty reflection never raises: the catalog filters what the login cannot
    see, so "none visible" and "none exist" read identically. ``list_views``
    stays silent - an empty view list is normal.
    """
    return Diagnosis(
        title=f"No {kind}s visible in {scope}",
        remediation=f"Verify the login can see the {kind}s (object permissions), or confirm {scope} is not empty.",
    )


def list_schemas(client: Engine) -> Evidence:
    names, command = _reflect(client, lambda: inspect(client).get_schema_names())
    return Evidence(
        summary=enumerated(len(names), "schema"),
        command=command,
        caveat=None if names else _empty_caveat("schema", "the database"),
    )


def list_tables(client: Engine, schema: str | None, system_schemas: frozenset[str] = frozenset()) -> Evidence:
    inspector = inspect(client)
    target, auto_selected = _resolve_schema(inspector, schema, system_schemas)
    names, command = _reflect(client, lambda: inspector.get_table_names(target))
    scope = f"schema '{target}'" if target else "the database"
    return Evidence(
        summary=_in_schema("table", len(names), target, auto_selected),
        command=command,
        caveat=None if names else _empty_caveat("table", scope),
    )


def list_views(client: Engine, schema: str | None, system_schemas: frozenset[str] = frozenset()) -> Evidence:
    inspector = inspect(client)
    target, auto_selected = _resolve_schema(inspector, schema, system_schemas)
    names, command = _reflect(client, lambda: inspector.get_view_names(target))
    return Evidence(
        summary=_in_schema("view", len(names), target, auto_selected),
        command=command,
    )
