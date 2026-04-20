#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL enforcer for SQL-family source baselines.

Implements SourceBaselineEnforcer (Task 17 Protocol) for MySQL via SQLAlchemy.
introspect() queries INFORMATION_SCHEMA to snapshot schemas, tables, columns,
and views. compare() diffs that snapshot against a declared SqlSourceBaseline
plus a COUNT(*) check per seeded table. apply() runs CREATE SCHEMA / CREATE TABLE
IF NOT EXISTS / CREATE OR REPLACE VIEW and executes idempotent seed SQL when
row counts don't match.

Idempotency assumptions (per Decision #18):
  - Seed.sql uses ON DUPLICATE KEY UPDATE so it's safe to re-run.
  - CREATE TABLE uses IF NOT EXISTS so it's a no-op when already present.
  - Views use CREATE OR REPLACE (supplied verbatim by the baseline).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Engine

from tests.cli_e2e_v2.core.source.sql import (
    BaselineStoredProcedure,
    BaselineTable,
    BaselineView,
    SqlSourceBaseline,
)
from tests.cli_e2e_v2.core.source.types import BaselineSpec, Drift, SourceState

logger = logging.getLogger(__name__)


class MySqlEnforcer:
    """SqlSourceBaseline enforcer for MySQL via SQLAlchemy."""

    def __init__(self, engine: Engine, baseline: SqlSourceBaseline) -> None:
        self._engine = engine
        self._baseline = baseline

    @classmethod
    def from_url(cls, url: str, baseline: SqlSourceBaseline) -> "MySqlEnforcer":
        """Construct with a SQLAlchemy engine built from a connection URL."""
        return cls(create_engine(url), baseline)

    # --- SourceBaselineEnforcer protocol methods ------------------------

    def introspect(self) -> SourceState:
        """Snapshot schemas / tables / columns / views from INFORMATION_SCHEMA."""
        schemas_list = list(self._baseline.schemas)
        if not schemas_list:
            return SourceState(
                payload={
                    "schemas": set(),
                    "tables": {},
                    "views": set(),
                    "stored_procedures": set(),
                }
            )

        with self._engine.connect() as conn:
            schemas = self._query_schemas(conn, schemas_list)
            tables = self._query_tables_with_columns(conn, schemas_list)
            views = self._query_views(conn, schemas_list)
            stored_procedures = self._query_stored_procedures(conn, schemas_list)

        return SourceState(
            payload={
                "schemas": schemas,
                "tables": tables,
                "views": views,
                "stored_procedures": stored_procedures,
            }
        )

    def compare(self, expected: BaselineSpec) -> list[Drift]:
        """Diff the current snapshot against the expected baseline."""
        assert isinstance(expected, SqlSourceBaseline), (
            f"MySqlEnforcer expects SqlSourceBaseline, got {type(expected).__name__}"
        )

        state = self.introspect().payload
        drifts: list[Drift] = []

        drifts.extend(self._diff_schemas(expected, state))
        drifts.extend(self._diff_tables(expected, state))
        drifts.extend(self._diff_views(expected, state))
        drifts.extend(self._diff_stored_procedures(expected, state))

        return drifts

    def apply(self, drifts: list[Drift]) -> None:
        """Reconcile drifts by running CREATE SCHEMA/TABLE/VIEW + idempotent seed SQL."""
        with self._engine.begin() as conn:
            for schema_name in self._baseline.schemas:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))

            for table in self._baseline.tables:
                self._apply_table(conn, table)

            for view in self._baseline.views:
                self._apply_view(conn, view)

            for sp in self._baseline.stored_procedures:
                self._apply_stored_procedure(conn, sp)

    # --- introspection helpers ------------------------------------------

    @staticmethod
    def _query_schemas(conn, schemas_list: list[str]) -> set[str]:
        query = text(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA "
            "WHERE SCHEMA_NAME IN :schemas"
        ).bindparams(bindparam("schemas", expanding=True))
        return {row[0] for row in conn.execute(query, {"schemas": schemas_list})}

    @staticmethod
    def _query_tables_with_columns(
        conn, schemas_list: list[str]
    ) -> dict[tuple[str, str], dict[str, Any]]:
        tables_query = text(
            "SELECT TABLE_SCHEMA, TABLE_NAME "
            "FROM INFORMATION_SCHEMA.TABLES "
            "WHERE TABLE_SCHEMA IN :schemas AND TABLE_TYPE = 'BASE TABLE'"
        ).bindparams(bindparam("schemas", expanding=True))

        tables: dict[tuple[str, str], dict[str, Any]] = {}
        for row in conn.execute(tables_query, {"schemas": schemas_list}):
            tables[(row[0], row[1])] = {"columns": {}}

        columns_query = text(
            "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, "
            "IS_NULLABLE, COLUMN_KEY "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA IN :schemas"
        ).bindparams(bindparam("schemas", expanding=True))
        for row in conn.execute(columns_query, {"schemas": schemas_list}):
            key = (row[0], row[1])
            if key not in tables:
                continue  # column for a table we don't care about (e.g., a view's columns)
            tables[key]["columns"][row[2]] = {
                "sql_type": row[3].upper(),
                "nullable": row[4] == "YES",
                "primary_key": row[5] == "PRI",
            }

        return tables

    @staticmethod
    def _query_views(conn, schemas_list: list[str]) -> set[tuple[str, str]]:
        query = text(
            "SELECT TABLE_SCHEMA, TABLE_NAME "
            "FROM INFORMATION_SCHEMA.VIEWS "
            "WHERE TABLE_SCHEMA IN :schemas"
        ).bindparams(bindparam("schemas", expanding=True))
        return {
            (row[0], row[1])
            for row in conn.execute(query, {"schemas": schemas_list})
        }

    @staticmethod
    def _query_stored_procedures(conn, schemas_list: list[str]) -> set[tuple[str, str]]:
        query = text(
            "SELECT ROUTINE_SCHEMA, ROUTINE_NAME "
            "FROM INFORMATION_SCHEMA.ROUTINES "
            "WHERE ROUTINE_SCHEMA IN :schemas AND ROUTINE_TYPE = 'PROCEDURE'"
        ).bindparams(bindparam("schemas", expanding=True))
        return {
            (row[0], row[1])
            for row in conn.execute(query, {"schemas": schemas_list})
        }

    # --- diff helpers ---------------------------------------------------

    @staticmethod
    def _diff_schemas(expected: SqlSourceBaseline, state: dict) -> list[Drift]:
        actual_schemas: set[str] = state["schemas"]
        drifts: list[Drift] = []
        for s in expected.schemas:
            if s not in actual_schemas:
                drifts.append(
                    Drift(path=f"schema[{s}]", expected="present", actual="missing")
                )
        return drifts

    def _diff_tables(self, expected: SqlSourceBaseline, state: dict) -> list[Drift]:
        drifts: list[Drift] = []
        actual_tables: dict[tuple[str, str], dict[str, Any]] = state["tables"]

        for tbl in expected.tables:
            key = (tbl.schema, tbl.name)
            actual_tbl = actual_tables.get(key)
            fqn = f"{tbl.schema}.{tbl.name}"
            if actual_tbl is None:
                drifts.append(
                    Drift(path=f"table[{fqn}]", expected="present", actual="missing")
                )
                continue

            drifts.extend(self._diff_columns(tbl, actual_tbl["columns"], fqn))

            if tbl.seed is not None:
                drifts.extend(self._diff_seed_row_count(tbl, fqn))

        return drifts

    @staticmethod
    def _diff_columns(
        tbl: BaselineTable, actual_cols: dict[str, dict[str, Any]], fqn: str
    ) -> list[Drift]:
        drifts: list[Drift] = []
        for col in tbl.columns:
            actual_col = actual_cols.get(col.name)
            col_path = f"table[{fqn}].column[{col.name}]"
            if actual_col is None:
                drifts.append(
                    Drift(path=col_path, expected="present", actual="missing")
                )
                continue
            if MySqlEnforcer._normalize_type(
                actual_col["sql_type"]
            ) != MySqlEnforcer._normalize_type(col.sql_type):
                drifts.append(
                    Drift(
                        path=f"{col_path}.type",
                        expected=col.sql_type,
                        actual=actual_col["sql_type"],
                    )
                )
            if actual_col["primary_key"] != col.primary_key:
                drifts.append(
                    Drift(
                        path=f"{col_path}.primary_key",
                        expected=col.primary_key,
                        actual=actual_col["primary_key"],
                    )
                )
        return drifts

    def _diff_seed_row_count(self, tbl: BaselineTable, fqn: str) -> list[Drift]:
        with self._engine.connect() as conn:
            count = conn.execute(
                text(f"SELECT COUNT(*) FROM {tbl.schema}.{tbl.name}")
            ).scalar_one()
        assert tbl.seed is not None  # checked by caller
        if count != tbl.seed.expected_row_count:
            return [
                Drift(
                    path=f"table[{fqn}].seed.row_count",
                    expected=tbl.seed.expected_row_count,
                    actual=count,
                )
            ]
        return []

    @staticmethod
    def _diff_views(expected: SqlSourceBaseline, state: dict) -> list[Drift]:
        drifts: list[Drift] = []
        actual_views: set[tuple[str, str]] = state["views"]
        for v in expected.views:
            if (v.schema, v.name) not in actual_views:
                drifts.append(
                    Drift(
                        path=f"view[{v.schema}.{v.name}]",
                        expected="present",
                        actual="missing",
                    )
                )
        return drifts

    @staticmethod
    def _diff_stored_procedures(expected: SqlSourceBaseline, state: dict) -> list[Drift]:
        drifts: list[Drift] = []
        actual_sps: set[tuple[str, str]] = state.get("stored_procedures", set())
        for sp in expected.stored_procedures:
            if (sp.schema, sp.name) not in actual_sps:
                drifts.append(
                    Drift(
                        path=f"procedure[{sp.schema}.{sp.name}]",
                        expected="present",
                        actual="missing",
                    )
                )
        return drifts

    # --- apply helpers --------------------------------------------------

    def _apply_table(self, conn, tbl: BaselineTable) -> None:
        column_defs: list[str] = []
        primary_keys: list[str] = []
        for col in tbl.columns:
            null_sql = "NULL" if col.nullable else "NOT NULL"
            column_defs.append(f"`{col.name}` {col.sql_type} {null_sql}")
            if col.primary_key:
                primary_keys.append(f"`{col.name}`")
        pk_clause = f", PRIMARY KEY ({', '.join(primary_keys)})" if primary_keys else ""
        conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {tbl.schema}.{tbl.name} "
                f"({', '.join(column_defs)}{pk_clause})"
            )
        )
        if tbl.seed is not None:
            count = conn.execute(
                text(f"SELECT COUNT(*) FROM {tbl.schema}.{tbl.name}")
            ).scalar_one()
            if count != tbl.seed.expected_row_count:
                logger.info(
                    "[%s.%s] seeding (current=%d, expected=%d)",
                    tbl.schema,
                    tbl.name,
                    count,
                    tbl.seed.expected_row_count,
                )
                conn.execute(text(tbl.seed.sql))

    @staticmethod
    def _apply_view(conn, view: BaselineView) -> None:
        conn.execute(text(view.definition_sql))

    @staticmethod
    def _apply_stored_procedure(conn, sp: BaselineStoredProcedure) -> None:
        conn.execute(text(f"DROP PROCEDURE IF EXISTS {sp.schema}.{sp.name}"))
        conn.execute(text(sp.definition_sql))

    # --- type normalization ---------------------------------------------

    @staticmethod
    def _normalize_type(t: str) -> str:
        """Minimal normalization for MySQL type comparison.

        INFORMATION_SCHEMA.COLUMN_TYPE returns strings like "bigint(20) unsigned"
        while a BaselineColumn might declare "BIGINT". We strip UNSIGNED and
        collapse whitespace; leave length-qualified variants alone (the baseline
        should declare types precisely matching what MySQL reports).
        """
        return " ".join(t.upper().replace("UNSIGNED", "").split()).strip()
