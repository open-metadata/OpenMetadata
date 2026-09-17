#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Declarative expected database catalog state post-ingestion.

Fields that map to OM schema enums use the OM enum type directly.
None on any field means "don't assert this field" — the differ skips it.
Non-None string fields (e.g. description) use substring match, not exact equality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any


class DiffKind(Enum):
    MISSING = "missing"
    UNEXPECTED = "unexpected"
    VALUE_MISMATCH = "value"


@dataclass(frozen=True)
class Diff:
    path: str
    kind: DiffKind = DiffKind.VALUE_MISMATCH
    expected: Any = None
    actual: Any = None

    def __str__(self) -> str:
        if self.kind is DiffKind.MISSING:
            return f"  {self.path}: missing"
        if self.kind is DiffKind.UNEXPECTED:
            extra = f" ({self.actual!r})" if self.actual is not None else ""
            return f"  {self.path}: unexpected{extra}"
        return f"  {self.path}:\n    expected: {self.expected!r}\n    actual:   {self.actual!r}"


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
