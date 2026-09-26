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
"""Declared SQL tables, seed rows, and ordered creation statements."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy import MetaData


@dataclass(frozen=True)
class TableSeed:
    """Deterministic rows for one declared table."""

    table_name: str
    rows: list[dict[str, Any]]


@dataclass(frozen=True)
class SqlSourceBaseline:
    """Tables and seeds followed by connector-owned DDL in creation order."""

    metadata: MetaData
    seeds: list[TableSeed] = field(default_factory=list)
    ddl: list[str] = field(default_factory=list)
