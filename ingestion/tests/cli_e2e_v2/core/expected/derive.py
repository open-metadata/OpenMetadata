#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Derive Expected* trees from a SQLAlchemy MetaData.

Stored procedures are not derivable from MetaData; pass them explicitly to `derive_expected_service`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import Constraint

from .type_map import TypeMap, resolve_om_type
from .types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)

if TYPE_CHECKING:
    from sqlalchemy import MetaData
    from sqlalchemy.schema import Column as SqlColumn

    from metadata.generated.schema.entity.services.databaseService import (
        DatabaseServiceType,
    )


def derive_expected_tables(metadata: MetaData, type_map: TypeMap) -> list[ExpectedTable]:
    """Build one ExpectedTable per Table in `metadata`, iterated in FK-safe order."""
    return [
        ExpectedTable(
            name=tbl.name,
            columns=[_derive_column(col, type_map) for col in tbl.columns],
            description=tbl.comment,
        )
        for tbl in metadata.sorted_tables
    ]


def _derive_column(col: SqlColumn, type_map: TypeMap) -> ExpectedColumn:
    return ExpectedColumn(
        name=col.name,
        data_type=resolve_om_type(col.type, type_map),
        primary_key=bool(col.primary_key),
        constraint=_constraint_for(col),
        description=col.comment,
    )


def _constraint_for(col: SqlColumn) -> Constraint | None:
    if col.primary_key:
        return Constraint.PRIMARY_KEY
    if not col.nullable:
        return Constraint.NOT_NULL
    return None


def derive_expected_service(
    *,
    service_name: str,
    service_type: DatabaseServiceType,
    metadata: MetaData,
    type_map: TypeMap,
    database: str = "default",
    schema: str | None = None,
    views: list[ExpectedTable] | None = None,
    stored_procedures: list[ExpectedStoredProcedure] | None = None,
) -> ExpectedService:
    """Build a full ExpectedService tree from MetaData.

    `schema` defaults to `metadata.schema`; raises ValueError if neither is set.
    Views are appended to the table list (OM models them as Table entities).
    """
    schema_name = schema or metadata.schema
    if schema_name is None:
        raise ValueError("metadata has no schema — pass `schema=` explicitly")
    return ExpectedService(
        name=service_name,
        service_type=service_type,
        databases=[
            ExpectedDatabase(
                name=database,
                schemas=[
                    ExpectedSchema(
                        name=schema_name,
                        tables=derive_expected_tables(metadata, type_map) + (views or []),
                        stored_procedures=stored_procedures or [],
                    ),
                ],
            ),
        ],
    )
