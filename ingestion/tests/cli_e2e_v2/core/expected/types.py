#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Declarative dataclasses describing expected OM-side state post-ingestion.

Per Decision #4 of the v2 spec: these reuse OM's Pydantic value types
(DataType, Constraint, DatabaseServiceType) for fields that map to schema
enums — automatic drift-safety whenever the generated schema updates.
They deliberately expose ONLY fields tests assert on, not every field on
the underlying OM entity (Table alone has 30+ fields, most noise for a
structural spec).

Rules enforced:
  - Fields that map to OM schema enums MUST use the OM enum type.
  - Fields that don't map to enums stay as plain Python types.
  - Unset / None means "don't assert this field" — differ skips it.
  - For string fields like description, non-None means substring-match
    (Decision #16), not exact equality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import Constraint, DataType
    from metadata.generated.schema.entity.services.databaseService import (
        DatabaseServiceType,
    )


class MatchMode(Enum):
    """Controls how strictly the structural differ treats "extra" entities in actual.

    - STRICT: actual must equal expected exactly — any unexpected table or column
      flags as a diff. Used for filter tests where we care the filter eliminated
      unwanted entities.
    - SUPERSET (default): actual ⊇ expected. Extras are tolerated; only missing
      or mismatched entities flag. Right for cloud accounts where shared schemas
      may accumulate unrelated tables over time.
    """

    STRICT = "strict"
    SUPERSET = "superset"


@dataclass(frozen=True)
class ExpectedColumn:
    """A single column's expected shape in OM."""

    name: str
    data_type: DataType
    tags: frozenset[str] = field(default_factory=frozenset)
    constraint: Constraint | None = None
    description: str | None = None  # None = don't assert; str = substring match
    primary_key: bool = False


@dataclass(frozen=True)
class ExpectedTable:
    """A single table's expected shape in OM.

    Column matching is always by-name (dict lookup). Use STRICT match mode
    on the differ to fail when actual tables carry unexpected extra columns.
    """

    name: str
    columns: list[ExpectedColumn]
    owner: str | None = None
    tags: frozenset[str] = field(default_factory=frozenset)
    description: str | None = None


@dataclass(frozen=True)
class ExpectedStoredProcedure:
    """A single stored procedure's expected presence in OM."""

    name: str
    description: str | None = None  # None = don't assert; str = substring match


@dataclass(frozen=True)
class ExpectedSchema:
    name: str
    tables: list[ExpectedTable]
    stored_procedures: list[ExpectedStoredProcedure] = field(default_factory=list)


@dataclass(frozen=True)
class ExpectedDatabase:
    name: str
    schemas: list[ExpectedSchema]


@dataclass(frozen=True)
class ExpectedService:
    name: str
    service_type: DatabaseServiceType
    databases: list[ExpectedDatabase]
