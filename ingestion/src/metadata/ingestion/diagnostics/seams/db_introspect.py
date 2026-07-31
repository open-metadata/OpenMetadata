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
SQLAlchemy event-based DB query instrumentation.

Attaches global `before_cursor_execute` / `after_cursor_execute` /
`handle_error` listeners on `sqlalchemy.engine.Engine`. Every SQL query
across every SQLAlchemy-backed connector (Postgres, Snowflake, Redshift,
MySQL, MSSQL, Trino, BigQuery, Oracle, ...) becomes a labeled
`{dialect}.query` operation in the registry with truncated SQL text — so
a stuck DB connector shows up as e.g.

    diag.warn.stuck op=snowflake.query duration=312s
        sql='SELECT column_name, ...'

instead of the opaque `op=source.iter`.

The token is stored on the SQLAlchemy `ExecutionContext` (unique per
`cursor.execute`) so before/after/error pair up cleanly without
thread-locals or cursor-id maps.
"""

from typing import Any

from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry

_TOKEN_ATTR = "_diag_op_token"
_KWARGS_SQL_MAX_CHARS = 2000


class DbIntrospector:
    """Registers SQLAlchemy event listeners that push ops on the registry."""

    def __init__(self, registry: OperationRegistry) -> None:
        self._registry = registry
        self._installed = False
        self._engine_cls: Any = None  # cached SQLAlchemy `Engine` class

    def install(self) -> bool:
        """Attach the listeners. Returns True if successful.

        Idempotent and best-effort: if SQLAlchemy isn't importable or
        event registration fails, returns False and leaves diagnostics
        otherwise functional.
        """
        if self._installed:
            return True
        try:
            from sqlalchemy import event  # noqa: PLC0415
            from sqlalchemy.engine import Engine  # noqa: PLC0415
        except ImportError:
            return False

        try:
            event.listen(Engine, "before_cursor_execute", self._before)
            event.listen(Engine, "after_cursor_execute", self._after)
            event.listen(Engine, "handle_error", self._error)
        except Exception:
            return False

        self._engine_cls = Engine
        self._installed = True
        return True

    def uninstall(self) -> None:
        if not self._installed:
            return
        try:
            from sqlalchemy import event  # noqa: PLC0415

            event.remove(self._engine_cls, "before_cursor_execute", self._before)
            event.remove(self._engine_cls, "after_cursor_execute", self._after)
            event.remove(self._engine_cls, "handle_error", self._error)
        except Exception:
            pass
        self._installed = False

    # ---- listeners ----

    def _before(
        self,
        conn: Any,
        cursor: Any,
        statement: Any,
        parameters: Any,
        context: Any,
        executemany: Any,
    ) -> None:
        """Push a `{dialect}.query` op for the duration of `cursor.execute`."""
        try:
            op_name = self._op_name(conn)
            sql_short = (statement or "")[:_KWARGS_SQL_MAX_CHARS]
            token = self._registry.push(
                op_name,
                {"sql": sql_short, "executemany": str(bool(executemany))},
            )
            if context is not None:
                setattr(context, _TOKEN_ATTR, token)
        except Exception:
            # Never let a diagnostics listener break SQL execution.
            pass

    def _after(
        self,
        conn: Any,
        cursor: Any,
        statement: Any,
        parameters: Any,
        context: Any,
        executemany: Any,
    ) -> None:
        try:
            token = getattr(context, _TOKEN_ATTR, None) if context is not None else None
            if token is not None:
                self._registry.pop(token)
                setattr(context, _TOKEN_ATTR, None)
        except Exception:
            pass

    def _error(self, exception_context: Any) -> None:
        """SQLAlchemy fires `handle_error` instead of `after_cursor_execute`
        when `cursor.execute` raises. Make sure we still pop the op so the
        stack stays balanced.
        """
        try:
            ctx = getattr(exception_context, "execution_context", None)
            token = getattr(ctx, _TOKEN_ATTR, None) if ctx is not None else None
            if token is not None:
                self._registry.pop(token)
                setattr(ctx, _TOKEN_ATTR, None)
        except Exception:
            pass

    @staticmethod
    def _op_name(conn: Any) -> str:
        try:
            dialect = conn.dialect.name if conn is not None and conn.dialect else "sql"
        except Exception:
            dialect = "sql"
        return f"{dialect}.query"
