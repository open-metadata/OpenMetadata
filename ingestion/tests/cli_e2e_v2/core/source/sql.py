#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""SQL-family baseline types.

`SqlSourceBaseline` carries a SQLAlchemy `MetaData` (tables + columns + FKs +
comments) plus companion data for things Core doesn't model: seed rows,
view definitions, stored procedures. DDL is emitted by
`metadata.create_all(conn)` in the enforcer; seed INSERTs are dialect-specific
(the `TableSeed.insert_sql` template is supplied by each connector's
baseline).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import MetaData

from .types import BaselineSpec


@dataclass(frozen=True)
class TableSeed:
    """Deterministic seed rows for a baseline table.

    `rows` is portable data (list of dicts). `insert_sql` is a
    dialect-specific template with `:key` placeholders that SQLAlchemy binds
    against each row via executemany — this is where idempotent upsert
    clauses live (MySQL `ON DUPLICATE KEY UPDATE`, Postgres `ON CONFLICT DO
    UPDATE`, etc.). The base enforcer runs `insert_sql` against `rows`
    without knowing the dialect.

    `expected_row_count` is derived — `len(rows)` — so the seed spec has
    one source of truth.
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
