#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""SQL-family baseline spec dataclasses.

Declarative description of the expected source state for any SQL-based connector
(MySQL, Postgres, Snowflake, etc.). Each per-connector baseline module (e.g.
`tests/cli_e2e_v2/mysql/baseline.py`) constructs a SqlSourceBaseline instance
and hands it to the enforcer.

Seed rows are deterministic: `expected_row_count` is the gate (cheap SELECT
COUNT), `sql` is the idempotent INSERT used only when drift is detected and
policy.mode="apply". Cloud sources stay check-only, so `sql` never runs there
— the operator CLI is the escape path.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from tests.cli_e2e_v2.core.source.types import BaselineSpec


@dataclass
class BaselineColumn:
    """A single column's declared shape in the source database.

    sql_type is the native type string (e.g., "BIGINT", "VARCHAR(255)") — we
    don't translate to OM's DataType here; the enforcer compares native types
    verbatim against INFORMATION_SCHEMA output.
    """

    name: str
    sql_type: str
    nullable: bool = True
    primary_key: bool = False


@dataclass
class Seed:
    """Deterministic seed rows for a baseline table.

    `sql` must be idempotent — ON DUPLICATE KEY UPDATE (MySQL) or ON CONFLICT
    DO UPDATE (Postgres) so apply() can run it repeatedly without failing.

    `expected_row_count` is the read-only gate: drift is detected when
    SELECT COUNT(*) != expected_row_count. Keep seeds small (5-50 rows)
    for snappy COUNT checks.
    """

    sql: str
    expected_row_count: int


@dataclass
class BaselineTable:
    """A single expected table in the source database."""

    schema: str
    name: str
    columns: list[BaselineColumn]
    seed: Seed | None = None


@dataclass
class BaselineView:
    """A single expected view in the source database.

    definition_sql must be idempotent (CREATE OR REPLACE VIEW ...).
    """

    schema: str
    name: str
    definition_sql: str


@dataclass
class BaselineStoredProcedure:
    """A single expected stored procedure in the source database.

    MySQL has no CREATE OR REPLACE PROCEDURE; the enforcer handles this by
    issuing DROP PROCEDURE IF EXISTS before each CREATE in apply().

    definition_sql is sent verbatim to the server. MySQL's DELIMITER is a
    CLI-only convenience — via PyMySQL the whole CREATE PROCEDURE statement
    is one string and MySQL's server-side parser handles the procedure body.
    """

    schema: str
    name: str
    definition_sql: str


@dataclass
class SqlSourceBaseline(BaselineSpec):
    """Top-level declarative spec for a SQL-based source.

    Lists the schemas, tables (with optional seed data), and views that must
    exist before ingestion tests run. The enforcer's introspect() and apply()
    methods use this to drive diffs and DDL statements respectively.
    """

    schemas: list[str]
    tables: list[BaselineTable]
    views: list[BaselineView] = field(default_factory=list)
    stored_procedures: list[BaselineStoredProcedure] = field(default_factory=list)
