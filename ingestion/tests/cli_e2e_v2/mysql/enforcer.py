#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL dialect specifics for SqlBaselineEnforcer.

Introspection + compare live in the base (SQLAlchemy Inspector). This
subclass supplies the pieces Inspector doesn't cover:
  - stored-procedure listing (INFORMATION_SCHEMA.ROUTINES)
  - CREATE TABLE DDL with FOREIGN KEY and COMMENT= options
  - DROP + CREATE for procedures (MySQL has no CREATE OR REPLACE PROCEDURE)
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Connection

from ..core.source.sql import (
    BaselineColumn,
    BaselineStoredProcedure,
    BaselineTable,
    SqlSourceBaseline,
)
from ..core.source.sql_enforcer import SqlBaselineEnforcer

logger = logging.getLogger(__name__)


class MySqlEnforcer(SqlBaselineEnforcer):
    _stored_procedure_query_sql = (
        "SELECT ROUTINE_SCHEMA, ROUTINE_NAME "
        "FROM INFORMATION_SCHEMA.ROUTINES "
        "WHERE ROUTINE_SCHEMA IN :schemas AND ROUTINE_TYPE = 'PROCEDURE'"
    )

    @classmethod
    def from_url(
        cls, url: str | URL, baseline: SqlSourceBaseline
    ) -> "MySqlEnforcer":
        """Construct with a SQLAlchemy engine built from a connection URL."""
        return cls(create_engine(url), baseline)

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
                    tbl.schema, tbl.name, count, tbl.seed.expected_row_count,
                )
                conn.execute(text(tbl.seed.sql))

    def _apply_stored_procedure(
        self, conn: Connection, sp: BaselineStoredProcedure
    ) -> None:
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
    # MySQL single-quote escape via doubling.
    return text_value.replace("'", "''")
