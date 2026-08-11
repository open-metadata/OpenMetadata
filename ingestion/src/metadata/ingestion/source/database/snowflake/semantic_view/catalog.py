#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""I/O layer over Snowflake's semantic-view catalog.

Primary fetch is one query per catalog view (dim/fact/metric/tables) against
``SEMANTIC_VIEW_SCHEMA = '{schema}'`` — every view's rows in one round trip,
grouped by view client-side. Errno 90030 ("information schema query returned
too much data") triggers a per-view fallback for the specific catalog that
overflowed. Results cache per schema in a bounded LRU so the column-fetch and
metric-emit paths share catalog data across the ~2 lookups per view."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from cachetools import LRUCache
from sqlalchemy import text

from metadata.ingestion.source.database.snowflake.semantic_view.queries import (
    _CATALOG_DIMENSIONS,
    _CATALOG_FACTS,
    _CATALOG_METRICS,
    SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW,
    SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA,
    SNOWFLAKE_GET_SEMANTIC_TABLES_IN_SCHEMA,
    SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION,
    SNOWFLAKE_GET_SEMANTIC_VIEWS,
    SNOWFLAKE_INFO_SCHEMA_TOO_LARGE_ERRNO,
)
from snowflake.connector.errors import ProgrammingError

_SCHEMA_CATALOG_CACHE_SIZE = 4


@dataclass(frozen=True)
class SemanticViewCatalog:
    """The ``INFORMATION_SCHEMA.SEMANTIC_*`` snapshot for ONE semantic view.

    ``base_tables`` is empty when the SEMANTIC_TABLES fetch fails (older
    Snowflake accounts / permission gaps) so dim/fact/metric flow is never
    dropped.
    """

    dimensions: list[tuple]
    facts: list[tuple]
    metrics: list[tuple]
    base_tables: dict[str, tuple[str, str, str]]


@dataclass
class SchemaCatalog:
    """Aggregated schema-wide catalog indexed by ``semantic_view_name``."""

    dimensions_by_view: dict[str, list[tuple]] = field(default_factory=dict)
    facts_by_view: dict[str, list[tuple]] = field(default_factory=dict)
    metrics_by_view: dict[str, list[tuple]] = field(default_factory=dict)
    base_tables_by_view: dict[str, dict[str, tuple[str, str, str]]] = field(default_factory=dict)

    def view(self, view_name: str) -> SemanticViewCatalog:
        return SemanticViewCatalog(
            dimensions=self.dimensions_by_view.get(view_name, []),
            facts=self.facts_by_view.get(view_name, []),
            metrics=self.metrics_by_view.get(view_name, []),
            base_tables=self.base_tables_by_view.get(view_name, {}),
        )


class SemanticCatalogCache:
    """Bounded per-schema catalog cache — one entry holds every view's rows."""

    def __init__(self, maxsize: int = _SCHEMA_CATALOG_CACHE_SIZE) -> None:
        self._cache: LRUCache = LRUCache(maxsize=maxsize)

    def get_or_load(self, connection: Any, schema: str, view_names: list[str]) -> SchemaCatalog:
        if schema not in self._cache:
            self._cache[schema] = _fetch_schema_catalog(connection, schema, view_names)
        return self._cache[schema]

    def invalidate(self, schema: str) -> None:
        self._cache.pop(schema, None)


def fetch_view_names(connection: Any, schema: str) -> list[str]:
    """Return the semantic-view names in ``schema``."""
    rows = _rows(connection, SNOWFLAKE_GET_SEMANTIC_VIEWS.format(schema=schema))
    return [row[0] for row in rows]


def fetch_definition(connection: Any, fully_qualified_name: str) -> str | None:
    """Return ``GET_DDL('SEMANTIC_VIEW', ...)`` or ``None`` on failure."""
    try:
        rows = _rows(connection, SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION.format(fqn=fully_qualified_name))
        return rows[0][0] if rows else None
    except Exception:
        return None


def _fetch_schema_catalog(connection: Any, schema: str, view_names: list[str]) -> SchemaCatalog:
    return SchemaCatalog(
        dimensions_by_view=_fetch_objects(connection, schema, _CATALOG_DIMENSIONS, view_names),
        facts_by_view=_fetch_objects(connection, schema, _CATALOG_FACTS, view_names),
        metrics_by_view=_fetch_objects(connection, schema, _CATALOG_METRICS, view_names),
        base_tables_by_view=_try_base_tables(connection, schema),
    )


def _fetch_objects(
    connection: Any,
    schema: str,
    catalog_view: str,
    view_names: list[str],
) -> dict[str, list[tuple]]:
    """Schema-wide query, fall back per-view on Snowflake errno 90030."""
    try:
        rows = _rows(
            connection,
            SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA.format(catalog_view=catalog_view, schema=schema),
        )
        return _group_by_view(rows, view_index=0, row_start_index=1)
    except ProgrammingError as exc:
        if getattr(exc, "errno", None) != SNOWFLAKE_INFO_SCHEMA_TOO_LARGE_ERRNO:
            raise
    grouped: dict[str, list[tuple]] = {}
    for view in view_names:
        try:
            rows = _rows(
                connection,
                SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW.format(
                    catalog_view=catalog_view,
                    schema=schema,
                    semantic_view=view,
                ),
            )
        except Exception:
            grouped[view] = []
            continue
        grouped[view] = [tuple(row[1:]) for row in rows]
    return grouped


def _try_base_tables(connection: Any, schema: str) -> dict[str, dict[str, tuple[str, str, str]]]:
    """Return ``{view_name: {logical_table_name: (base_catalog, base_schema, base_name)}}``
    so column-level lineage can look up physical tables by the logical alias used in
    semantic-view expressions."""
    try:
        rows = _rows(connection, SNOWFLAKE_GET_SEMANTIC_TABLES_IN_SCHEMA.format(schema=schema))
    except Exception:
        return {}
    grouped: dict[str, dict[str, tuple[str, str, str]]] = {}
    for row in rows:
        view_name, logical_name, base_catalog, base_schema, base_name = row[0], row[1], row[2], row[3], row[4]
        if not (view_name and logical_name and base_catalog and base_schema and base_name):
            continue
        grouped.setdefault(view_name, {})[logical_name] = (base_catalog, base_schema, base_name)
    return grouped


def _group_by_view(rows: list[tuple], view_index: int, row_start_index: int) -> dict[str, list[tuple]]:
    grouped: dict[str, list[tuple]] = {}
    for row in rows:
        view = row[view_index]
        if not view:
            continue
        grouped.setdefault(view, []).append(tuple(row[row_start_index:]))
    return grouped


def _rows(connection: Any, sql: str) -> list[tuple]:
    return list(connection.execute(text(sql)))
