#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Declarative dataclasses describing expected OM-side state post-ingestion.

Fields that map to OM schema enums use the OM enum type directly.
None on any field means "don't assert this field" — the differ skips it.
Non-None string fields (e.g. description) use substring match, not exact equality.
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
    """Controls how the differ treats extra entities in actual.

    - STRICT: actual must equal expected exactly; unexpected entities flag as diffs.
    - SUPERSET (default): actual ⊇ expected; extras are tolerated.
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
    """A single table's expected shape in OM; column matching is by name."""

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
