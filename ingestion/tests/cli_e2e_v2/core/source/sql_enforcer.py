#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Dialect-agnostic SQL baseline enforcer via SQLAlchemy Inspector + Core.

Introspection goes through `sqlalchemy.inspect(conn)` — dialect-agnostic.
DDL emission goes through `metadata.create_all(conn)` — also dialect-aware
via SQLAlchemy Core. Seeds apply via a dialect-specific INSERT template
carried on each `TableSeed`, so the base enforcer runs them without
knowing the dialect. Stored procedures and their listing query stay
subclass responsibility (SQLAlchemy doesn't model SPs uniformly).
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from sqlalchemy import bindparam, inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.schema import Table

from .sql import (
    SqlSourceBaseline,
    StoredProcedureDefinition,
    TableSeed,
    ViewDefinition,
)
from .types import BaselineSpec, Diff, DiffKind, SourceState

logger = logging.getLogger(__name__)


class _TableSnapshot(TypedDict):
    """Per-table metadata collected by the Inspector snapshot."""

    columns: dict[str, dict[str, Any]]


class _SqlSnapshot(TypedDict):
    """Typed shape of `_snapshot()`'s return payload.

    Lets the `_diff_*` methods take a real type (not `dict`) so typos like
    `state["tabels"]` are caught by the type checker rather than silently
    at runtime.
    """

    schemas: set[str]
    tables: dict[tuple[str, str], _TableSnapshot]
    views: set[tuple[str, str]]
    stored_procedures: set[tuple[str, str]]

_TYPE_ALIASES: dict[str, str] = {
    "INTEGER": "INT",
    "NUMERIC": "DECIMAL",
}

_INTEGER_TYPES: frozenset[str] = frozenset(
    {"TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT"}
)


class SqlBaselineEnforcer:
    """SQL-family SourceBaselineEnforcer via SQLAlchemy Inspector + Core.

    Subclasses customize only:
      - `_stored_procedure_query_sql`: raw SQL returning `(schema, name)`
        rows for procedures; binds a `:schemas` IN-list (expanding).
      - `_apply_stored_procedure(conn, sp)`: dialect-specific procedure DDL.
      - `_apply_view` default runs `view.definition_sql` verbatim — override
        only if the dialect needs special plumbing.

    Tables, columns, FKs, comments, and PK come from the baseline's
    SQLAlchemy `MetaData` — `metadata.create_all(conn)` emits the right
    DDL per dialect. Seed INSERTs are dialect-specific templates on each
    `TableSeed`, bound against the (portable) row data at apply time.
    """

    _stored_procedure_query_sql: str | None = None

    def __init__(self, engine: Engine, baseline: SqlSourceBaseline) -> None:
        self._engine = engine
        self._baseline = baseline

    # --- introspect -----------------------------------------------------

    def introspect(self) -> SourceState:
        if not self._baseline.schemas:
            empty: _SqlSnapshot = {
                "schemas": set(),
                "tables": {},
                "views": set(),
                "stored_procedures": set(),
            }
            return SourceState(payload=empty)
        with self._engine.connect() as conn:
            return SourceState(payload=self._snapshot(conn))

    def _snapshot(self, conn: Connection) -> _SqlSnapshot:
        inspector = inspect(conn)
        wanted = set(self._baseline.schemas)
        logger.debug("[sql] snapshotting schemas=%s", sorted(wanted))

        schemas = {s for s in inspector.get_schema_names() if s in wanted}

        tables: dict[tuple[str, str], _TableSnapshot] = {}
        for schema in schemas:
            for table in inspector.get_table_names(schema=schema):
                pk_cols = set(
                    inspector.get_pk_constraint(table, schema=schema).get(
                        "constrained_columns", []
                    )
                )
                tables[(schema, table)] = {
                    "columns": {
                        col["name"]: {
                            "sql_type": str(col["type"]).upper(),
                            "nullable": col["nullable"],
                            "primary_key": col["name"] in pk_cols,
                        }
                        for col in inspector.get_columns(table, schema=schema)
                    }
                }

        views = {
            (s, v)
            for s in schemas
            for v in inspector.get_view_names(schema=s)
        }

        stored_procedures = self._query_stored_procedures(conn, schemas)

        return {
            "schemas": schemas,
            "tables": tables,
            "views": views,
            "stored_procedures": stored_procedures,
        }

    def _query_stored_procedures(
        self, conn: Connection, schemas: set[str]
    ) -> set[tuple[str, str]]:
        if not self._stored_procedure_query_sql or not schemas:
            return set()
        query = text(self._stored_procedure_query_sql).bindparams(
            bindparam("schemas", expanding=True)
        )
        return {
            (row[0], row[1])
            for row in conn.execute(query, {"schemas": sorted(schemas)})
        }

    # --- compare --------------------------------------------------------

    def compare(self, expected: BaselineSpec) -> list[Diff]:
        assert isinstance(expected, SqlSourceBaseline), (
            f"expected SqlSourceBaseline, got {type(expected).__name__}"
        )
        if not expected.schemas:
            return []

        drifts: list[Diff] = []
        with self._engine.connect() as conn:
            state = self._snapshot(conn)
            drifts.extend(self._diff_schemas(expected, state))
            drifts.extend(self._diff_tables(expected, state))
            drifts.extend(self._diff_seeds(expected, state, conn))
            drifts.extend(self._diff_views(expected, state))
            drifts.extend(self._diff_stored_procedures(expected, state))

        logger.debug("[sql] compare produced %d drifts", len(drifts))
        return drifts

    @staticmethod
    def _diff_schemas(
        expected: SqlSourceBaseline, state: _SqlSnapshot
    ) -> list[Diff]:
        return [
            Diff(path=f"schema[{s}]", kind=DiffKind.MISSING)
            for s in expected.schemas
            if s not in state["schemas"]
        ]

    def _diff_tables(
        self, expected: SqlSourceBaseline, state: _SqlSnapshot
    ) -> list[Diff]:
        drifts: list[Diff] = []
        actual_tables = state["tables"]
        for tbl in expected.metadata.sorted_tables:
            fqn = tbl.fullname
            actual_tbl = actual_tables.get((tbl.schema, tbl.name))
            if actual_tbl is None:
                drifts.append(
                    Diff(path=f"table[{fqn}]", kind=DiffKind.MISSING)
                )
                continue
            drifts.extend(self._diff_columns(tbl, actual_tbl["columns"], fqn))
        return drifts

    @staticmethod
    def _diff_columns(
        tbl: Table, actual_cols: dict[str, dict[str, Any]], fqn: str
    ) -> list[Diff]:
        drifts: list[Diff] = []
        for col in tbl.columns:
            actual_col = actual_cols.get(col.name)
            col_path = f"table[{fqn}].column[{col.name}]"
            if actual_col is None:
                drifts.append(
                    Diff(path=col_path, kind=DiffKind.MISSING)
                )
                continue
            expected_type_str = str(col.type).upper()
            if _normalize_type(actual_col["sql_type"]) != _normalize_type(expected_type_str):
                drifts.append(
                    Diff(
                        path=f"{col_path}.type",
                        expected=expected_type_str,
                        actual=actual_col["sql_type"],
                    )
                )
            if actual_col["primary_key"] != col.primary_key:
                drifts.append(
                    Diff(
                        path=f"{col_path}.primary_key",
                        expected=col.primary_key,
                        actual=actual_col["primary_key"],
                    )
                )
        return drifts

    def _diff_seeds(
        self, expected: SqlSourceBaseline, state: _SqlSnapshot, conn: Connection
    ) -> list[Diff]:
        """Compare seed row counts for tables that already exist.

        Skips seeds whose target table isn't in the snapshot — the missing
        table is already flagged by `_diff_tables`, and issuing COUNT(*)
        against a nonexistent table (or schema) would raise. The apply()
        pass creates the tables + seeds them; next compare() can then
        verify row counts.
        """
        drifts: list[Diff] = []
        actual_tables = state["tables"]
        schema = expected.metadata.schema
        for seed in expected.seeds:
            if (schema, seed.table_name) not in actual_tables:
                continue
            fqn = self._seed_fqn(seed)
            count = conn.execute(text(f"SELECT COUNT(*) FROM {fqn}")).scalar_one()
            if count != seed.expected_row_count:
                drifts.append(
                    Diff(
                        path=f"table[{fqn}].seed.row_count",
                        expected=seed.expected_row_count,
                        actual=count,
                    )
                )
        return drifts

    @staticmethod
    def _diff_views(
        expected: SqlSourceBaseline, state: _SqlSnapshot
    ) -> list[Diff]:
        return [
            Diff(path=f"view[{v.schema}.{v.name}]", kind=DiffKind.MISSING)
            for v in expected.views
            if (v.schema, v.name) not in state["views"]
        ]

    @staticmethod
    def _diff_stored_procedures(
        expected: SqlSourceBaseline, state: _SqlSnapshot
    ) -> list[Diff]:
        return [
            Diff(path=f"procedure[{sp.schema}.{sp.name}]", kind=DiffKind.MISSING)
            for sp in expected.stored_procedures
            if (sp.schema, sp.name) not in state["stored_procedures"]
        ]

    # --- apply orchestration --------------------------------------------

    def apply(self, drifts: list[Diff]) -> None:
        logger.debug("[sql] applying %d drifts", len(drifts))
        with self._engine.begin() as conn:
            for schema_name in self._baseline.schemas:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
            # metadata.create_all emits CREATE TABLE IF NOT EXISTS + FKs +
            # column comments + table comments in the engine's dialect.
            self._baseline.metadata.create_all(conn)
            for seed in self._baseline.seeds:
                self._apply_seed(conn, seed)
            for view in self._baseline.views:
                self._apply_view(conn, view)
            for sp in self._baseline.stored_procedures:
                self._apply_stored_procedure(conn, sp)

    def _apply_seed(self, conn: Connection, seed: TableSeed) -> None:
        fqn = self._seed_fqn(seed)
        count = conn.execute(text(f"SELECT COUNT(*) FROM {fqn}")).scalar_one()
        if count == seed.expected_row_count:
            return
        logger.info(
            "[seed] %s: inserting (current=%d, expected=%d)",
            fqn, count, seed.expected_row_count,
        )
        conn.execute(text(seed.insert_sql), seed.rows)

    def _seed_fqn(self, seed: TableSeed) -> str:
        schema = self._baseline.metadata.schema
        return f"{schema}.{seed.table_name}" if schema else seed.table_name

    @staticmethod
    def _apply_view(conn: Connection, view: ViewDefinition) -> None:
        """Default: run `view.definition_sql` verbatim."""
        conn.execute(text(view.definition_sql))

    def _apply_stored_procedure(
        self, conn: Connection, sp: StoredProcedureDefinition
    ) -> None:
        raise NotImplementedError(
            "subclasses must provide dialect-specific procedure DDL"
        )


def _normalize_type(t: str) -> str:
    """Canonicalize a SQL native-type string for cross-dialect comparison.

    - upper case
    - strip `UNSIGNED`
    - collapse whitespace, including "DECIMAL(10, 2)" -> "DECIMAL(10,2)"
    - strip single quotes (enum/set members: "ENUM('a','b')" -> "ENUM(A,B)")
    - alias INTEGER -> INT, NUMERIC -> DECIMAL
    - drop display width for integer family (INT(11) -> INT)
    """
    raw = " ".join(t.upper().replace("UNSIGNED", "").split())
    raw = raw.replace(", ", ",").replace("'", "")
    head, paren, rest = raw.partition("(")
    head = _TYPE_ALIASES.get(head, head)
    if head in _INTEGER_TYPES:
        return head
    return f"{head}({rest}" if paren else head
