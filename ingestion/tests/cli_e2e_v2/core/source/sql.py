#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""SQL-family baseline types: SqlSourceBaseline, TableSeed, ViewDefinition, StoredProcedureDefinition."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from .types import BaselineSpec

if TYPE_CHECKING:
    from sqlalchemy import MetaData


@dataclass(frozen=True)
class TableSeed:
    """Deterministic seed rows for a baseline table.

    `insert_sql` must be a dialect-specific idempotent upsert template with
    `:key` placeholders (e.g., `ON DUPLICATE KEY UPDATE` for MySQL). The
    enforcer binds it against `rows` via executemany without dialect branching.
    `expected_row_count` is derived from `len(rows)`.
    """

    table_name: str
    rows: list[dict[str, Any]]
    insert_sql: str

    @property
    def expected_row_count(self) -> int:
        return len(self.rows)


@dataclass(frozen=True)
class ViewDefinition:
    """A single expected view.

    `definition_sql` is executed verbatim at apply time — baselines supply a
    CREATE OR REPLACE VIEW (or dialect equivalent) statement.
    """

    schema: str
    name: str
    definition_sql: str


@dataclass(frozen=True)
class StoredProcedureDefinition:
    """A single expected stored procedure.

    Dialect-specific: MySQL drops + creates (no CREATE OR REPLACE PROCEDURE);
    Postgres uses CREATE OR REPLACE PROCEDURE. The enforcer subclass owns
    the dialect DDL; `definition_sql` carries the body as supplied by the
    baseline.
    """

    schema: str
    name: str
    definition_sql: str


@dataclass(frozen=True)
class SqlSourceBaseline(BaselineSpec):
    """Top-level declarative spec for a SQL-based source.

    `metadata` holds the table DDL via SQLAlchemy Core — one source of truth
    for column types, nullability, primary keys, foreign keys, and comments.
    Seeds / views / stored procedures live alongside as companion data.
    """

    schemas: list[str]
    metadata: MetaData
    seeds: list[TableSeed] = field(default_factory=list)
    views: list[ViewDefinition] = field(default_factory=list)
    stored_procedures: list[StoredProcedureDefinition] = field(default_factory=list)
