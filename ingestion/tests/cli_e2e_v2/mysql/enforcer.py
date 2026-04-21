#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""SQLAlchemy-backed SourceBaselineEnforcer for MySQL.

introspect / compare / apply over INFORMATION_SCHEMA and DDL. One
connection per phase (compare threads a single connection through
snapshot + per-table row counts). apply() wraps all DDL + seeds in one
transaction. CREATE TABLE / VIEW / PROCEDURE are all idempotent (IF NOT
EXISTS / CREATE OR REPLACE / DROP + CREATE respectively).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import URL, Connection, Engine

from ..core.source.sql import (
    BaselineColumn,
    BaselineStoredProcedure,
    BaselineTable,
    BaselineView,
    SqlSourceBaseline,
)
from ..core.source.types import BaselineSpec, Drift, SourceState

logger = logging.getLogger(__name__)

# Integer family — normalize these by stripping any (width) qualifier so
# MySQL's reported `TINYINT(1)` / `INT(11)` match a baseline declaration of
# bare `TINYINT` / `INT`. Length matters for CHAR / VARCHAR / DECIMAL so we
# leave those intact.
_INTEGER_TYPES: frozenset[str] = frozenset(
    {"TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT"}
)


class MySqlEnforcer:
    """SqlSourceBaseline enforcer for MySQL via SQLAlchemy."""

    def __init__(self, engine: Engine, baseline: SqlSourceBaseline) -> None:
        self._engine = engine
        self._baseline = baseline

    @classmethod
    def from_url(
        cls, url: str | URL, baseline: SqlSourceBaseline
    ) -> "MySqlEnforcer":
        """Construct with a SQLAlchemy engine built from a connection URL.

        Accepts either a plain string or a SQLAlchemy `URL` object — the
        latter is preferred when usernames/passwords might contain
        URL-reserved characters.
        """
        return cls(create_engine(url), baseline)

    # --- SourceBaselineEnforcer protocol methods ------------------------

    def introspect(self) -> SourceState:
        """Snapshot schemas / tables / columns / views / SPs from INFORMATION_SCHEMA."""
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
            return SourceState(payload=self._snapshot(conn, schemas_list))

    def compare(self, expected: BaselineSpec) -> list[Drift]:
        """Diff the current snapshot against the expected baseline."""
        assert isinstance(expected, SqlSourceBaseline), (
            f"MySqlEnforcer expects SqlSourceBaseline, got {type(expected).__name__}"
        )

        drifts: list[Drift] = []
        if not expected.schemas:
            return drifts

        with self._engine.connect() as conn:
            state = self._snapshot(conn, list(expected.schemas))

            drifts.extend(self._diff_schemas(expected, state))
            drifts.extend(self._diff_tables(expected, state, conn))
            drifts.extend(self._diff_views(expected, state))
            drifts.extend(self._diff_stored_procedures(expected, state))

        logger.debug("[mysql] compare produced %d drifts", len(drifts))
        return drifts

    def apply(self, drifts: list[Drift]) -> None:
        """Reconcile drifts via CREATE SCHEMA/TABLE/VIEW + idempotent seed SQL."""
        logger.debug("[mysql] applying %d drifts", len(drifts))
        with self._engine.begin() as conn:
            for schema_name in self._baseline.schemas:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))

            for table in self._baseline.tables:
                self._apply_table(conn, table)

            for view in self._baseline.views:
                self._apply_view(conn, view)

            for sp in self._baseline.stored_procedures:
                self._apply_stored_procedure(conn, sp)

    # --- snapshot -------------------------------------------------------

    def _snapshot(self, conn: Connection, schemas_list: list[str]) -> dict[str, Any]:
        """Run all introspection queries on one connection. Returns the raw
        payload dict (consumers may wrap in SourceState)."""
        logger.debug("[mysql] snapshotting schemas=%s", schemas_list)
        return {
            "schemas": self._query_schemas(conn, schemas_list),
            "tables": self._query_tables_with_columns(conn, schemas_list),
            "views": self._query_views(conn, schemas_list),
            "stored_procedures": self._query_stored_procedures(conn, schemas_list),
        }

    # --- introspection helpers ------------------------------------------

    @staticmethod
    def _query_schemas(conn: Connection, schemas_list: list[str]) -> set[str]:
        query = text(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA "
            "WHERE SCHEMA_NAME IN :schemas"
        ).bindparams(bindparam("schemas", expanding=True))
        return {row[0] for row in conn.execute(query, {"schemas": schemas_list})}

    @staticmethod
    def _query_tables_with_columns(
        conn: Connection, schemas_list: list[str]
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
                continue  # column for a table we don't care about (e.g. a view's)
            tables[key]["columns"][row[2]] = {
                "sql_type": row[3].upper(),
                "nullable": row[4] == "YES",
                "primary_key": row[5] == "PRI",
            }

        return tables

    @staticmethod
    def _query_views(conn: Connection, schemas_list: list[str]) -> set[tuple[str, str]]:
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
    def _query_stored_procedures(
        conn: Connection, schemas_list: list[str]
    ) -> set[tuple[str, str]]:
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
        return [
            Drift(path=f"schema[{s}]", expected="present", actual="missing")
            for s in expected.schemas
            if s not in actual_schemas
        ]

    def _diff_tables(
        self, expected: SqlSourceBaseline, state: dict, conn: Connection
    ) -> list[Drift]:
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
                drifts.extend(self._diff_seed_row_count(tbl, fqn, conn))

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
            if _normalize_type(actual_col["sql_type"]) != _normalize_type(col.sql_type):
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

    @staticmethod
    def _diff_seed_row_count(
        tbl: BaselineTable, fqn: str, conn: Connection
    ) -> list[Drift]:
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
        actual_views: set[tuple[str, str]] = state["views"]
        return [
            Drift(
                path=f"view[{v.schema}.{v.name}]",
                expected="present",
                actual="missing",
            )
            for v in expected.views
            if (v.schema, v.name) not in actual_views
        ]

    @staticmethod
    def _diff_stored_procedures(
        expected: SqlSourceBaseline, state: dict
    ) -> list[Drift]:
        actual_sps: set[tuple[str, str]] = state.get("stored_procedures", set())
        return [
            Drift(
                path=f"procedure[{sp.schema}.{sp.name}]",
                expected="present",
                actual="missing",
            )
            for sp in expected.stored_procedures
            if (sp.schema, sp.name) not in actual_sps
        ]

    # --- apply helpers --------------------------------------------------

    def _apply_table(self, conn: Connection, tbl: BaselineTable) -> None:
        column_defs: list[str] = []
        primary_keys: list[str] = []
        foreign_keys: list[str] = []
        for col in tbl.columns:
            column_defs.append(_column_definition(col))
            if col.primary_key:
                primary_keys.append(f"`{col.name}`")
            if col.foreign_key is not None:
                foreign_keys.append(_foreign_key_clause(tbl.schema, col))
        pk_clause = f", PRIMARY KEY ({', '.join(primary_keys)})" if primary_keys else ""
        fk_clause = ", " + ", ".join(foreign_keys) if foreign_keys else ""
        table_comment = (
            f" COMMENT='{_escape_comment(tbl.description)}'"
            if tbl.description
            else ""
        )
        logger.debug("[mysql] CREATE TABLE IF NOT EXISTS %s.%s", tbl.schema, tbl.name)
        conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {tbl.schema}.{tbl.name} "
                f"({', '.join(column_defs)}{pk_clause}{fk_clause}){table_comment}"
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
    def _apply_view(conn: Connection, view: BaselineView) -> None:
        logger.debug("[mysql] CREATE OR REPLACE VIEW %s.%s", view.schema, view.name)
        conn.execute(text(view.definition_sql))

    @staticmethod
    def _apply_stored_procedure(conn: Connection, sp: BaselineStoredProcedure) -> None:
        logger.debug("[mysql] DROP+CREATE PROCEDURE %s.%s", sp.schema, sp.name)
        conn.execute(text(f"DROP PROCEDURE IF EXISTS {sp.schema}.{sp.name}"))
        conn.execute(text(sp.definition_sql))


# --- DDL fragment helpers (module-level — no instance state needed) ---------


def _column_definition(col: BaselineColumn) -> str:
    null_sql = "NULL" if col.nullable else "NOT NULL"
    fragment = f"`{col.name}` {col.sql_type} {null_sql}"
    if col.description:
        fragment += f" COMMENT '{_escape_comment(col.description)}'"
    return fragment


def _foreign_key_clause(schema: str, col: BaselineColumn) -> str:
    assert col.foreign_key is not None  # caller checks
    ref_table, ref_column = col.foreign_key
    return (
        f"FOREIGN KEY (`{col.name}`) "
        f"REFERENCES {schema}.{ref_table}(`{ref_column}`)"
    )


def _escape_comment(text_value: str) -> str:
    # MySQL single-quote escape via doubling. Backslashes are a separate
    # concern MySQL handles via NO_BACKSLASH_ESCAPES mode; the comments we
    # emit don't contain backslashes so skip that dimension for now.
    return text_value.replace("'", "''")


def _normalize_type(t: str) -> str:
    """Normalize a native MySQL type for baseline comparison.

    MySQL's INFORMATION_SCHEMA.COLUMN_TYPE returns strings like
    `bigint(20) unsigned` or `tinyint(1)` while a BaselineColumn commonly
    declares `BIGINT` or `TINYINT` without width. We:
      - upper-case
      - strip the `UNSIGNED` modifier
      - collapse whitespace
      - for integer family types only, drop the (width) qualifier

    VARCHAR/CHAR/DECIMAL keep their length — baselines must declare those
    precisely matching what MySQL will report.
    """
    raw = " ".join(t.upper().replace("UNSIGNED", "").split()).strip()
    head = raw.split("(", 1)[0]
    if head in _INTEGER_TYPES:
        return head
    return raw
