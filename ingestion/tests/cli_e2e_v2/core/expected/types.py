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
    - SUBSET: actual ⊆ expected. Rare — for scenarios where we assert the pipeline
      did NOT ingest anything unexpected into an empty namespace.
    """

    STRICT = "strict"
    SUPERSET = "superset"
    SUBSET = "subset"


@dataclass
class ExpectedColumn:
    """A single column's expected shape in OM."""

    name: str
    data_type: DataType
    tags: set[str] = field(default_factory=set)
    constraint: Constraint | None = None
    description: str | None = None  # None = don't assert; str = substring match
    primary_key: bool = False


@dataclass
class ExpectedTable:
    """A single table's expected shape in OM."""

    name: str
    columns: list[ExpectedColumn]
    ordered: bool = False  # column match: False = by-name (default); True = by-position
    owner: str | None = None
    tags: set[str] = field(default_factory=set)
    description: str | None = None


@dataclass
class ExpectedSchema:
    name: str
    tables: list[ExpectedTable]


@dataclass
class ExpectedDatabase:
    name: str
    schemas: list[ExpectedSchema]


@dataclass
class ExpectedService:
    name: str
    service_type: DatabaseServiceType
    databases: list[ExpectedDatabase]
