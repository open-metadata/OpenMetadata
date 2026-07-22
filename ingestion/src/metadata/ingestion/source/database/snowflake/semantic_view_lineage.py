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
"""
Semantic view lineage extraction for the Snowflake lineage workflow.

A Snowflake semantic view is backed by one or more base tables (exposed via
``INFORMATION_SCHEMA.SEMANTIC_TABLES``) and its dimensions/facts/metrics are
defined by expressions over those base tables' columns (via
``INFORMATION_SCHEMA.SEMANTIC_{DIMENSIONS,FACTS,METRICS}``). This module turns
that catalog metadata into OpenMetadata table- and column-level lineage from
each base table into the semantic view.
"""

import re
import traceback
from typing import Callable, Dict, Iterable, List, Optional, Tuple  # noqa: UP035

from sqlalchemy import text

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import (
    Source as LineageSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_DATABASES,
    SNOWFLAKE_GET_SEMANTIC_COLUMNS_IN_DB,
    SNOWFLAKE_GET_SEMANTIC_TABLES_IN_DB,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# A base table identified by (catalog, schema, table)
BaseTable = tuple[str, str, str]
# A semantic view identified within a database by (schema, view)
ViewKey = tuple[str, str]

# A single identifier segment: a double-quoted name or a bare name.
_IDENTIFIER = r'"[^"]*"|[A-Za-z_][\w$]*'
# A dotted chain of two or more identifier segments (e.g. ``orders.amount``,
# ``"orders"."o amount"``, ``db.schema.orders.amount``).
_COLUMN_REF_RE = re.compile(rf"(?:{_IDENTIFIER})(?:\.(?:{_IDENTIFIER}))+")
_SEGMENT_RE = re.compile(_IDENTIFIER)
_MAX_RESOLUTION_DEPTH = 5
SEMANTIC_COLUMN_CATALOG_VIEWS = (
    "semantic_dimensions",
    "semantic_facts",
    "semantic_metrics",
)


def _quote_db(database: str) -> str:
    """Escape a database identifier for interpolation into a double-quoted
    ``"<db>".information_schema...`` prefix (Snowflake escapes ``"`` as ``""``)."""
    return database.replace('"', '""')


def _unquote_identifier(identifier: str) -> str:
    """Strip surrounding double quotes from a Snowflake identifier segment."""
    unquoted = identifier
    if len(identifier) >= 2 and identifier[0] == '"' and identifier[-1] == '"':
        unquoted = identifier[1:-1]
    return unquoted


def extract_column_refs(expression: Optional[str]) -> List[Tuple[str, str]]:  # noqa: UP006, UP045
    """Extract ``(table, column)`` references from a semantic object's expression.

    Handles bare, double-quoted, and multi-part qualified identifiers, always
    taking the last two segments of each dotted chain as ``(table, column)``.
    """
    refs = []
    for chain in _COLUMN_REF_RE.findall(expression or ""):
        segments = _SEGMENT_RE.findall(chain)
        if len(segments) >= 2:
            refs.append((_unquote_identifier(segments[-2]), _unquote_identifier(segments[-1])))
    return refs


def match_semantic_name(name_ref: str, columns: Dict[str, dict]) -> Optional[str]:  # noqa: UP006, UP045
    """Return the semantic object name matching ``name_ref`` (case-insensitively),
    used to detect intra-view references (e.g. a metric defined over a fact)."""
    lowered = name_ref.lower()
    matched = None
    for column_name in columns:
        if column_name.lower() == lowered:
            matched = column_name
            break
    return matched


def lookup_base_table(table_ref: str, table_map: Dict[str, BaseTable]) -> Optional[BaseTable]:  # noqa: UP006, UP045
    """Resolve a logical table alias to its physical base table (case-insensitive)."""
    lowered = table_ref.lower()
    result = None
    for logical_name, base_table in table_map.items():
        if logical_name.lower() == lowered:
            result = base_table
            break
    return result


def resolve_base_columns(
    column_name: str,
    columns: Dict[str, dict],  # noqa: UP006
    table_map: Dict[str, BaseTable],  # noqa: UP006
    depth: int = 0,
) -> List[Tuple[BaseTable, str]]:  # noqa: UP006
    """Resolve a semantic object to the physical base-table columns it derives from.

    Follows intra-view references (metric -> fact -> physical column) up to
    ``_MAX_RESOLUTION_DEPTH`` levels to avoid runaway recursion on cyclic
    definitions. Returns a de-duplicated list of ``(base_table, base_column)``.
    """
    results: List[Tuple[BaseTable, str]] = []  # noqa: UP006
    info = columns.get(column_name)
    if info is not None and depth <= _MAX_RESOLUTION_DEPTH:
        for table_ref, column_ref in extract_column_refs(info.get("expression")):
            matched = match_semantic_name(column_ref, columns)
            if matched is not None and matched != column_name:
                for item in resolve_base_columns(matched, columns, table_map, depth + 1):
                    if item not in results:
                        results.append(item)
            else:
                base_table = lookup_base_table(table_ref, table_map)
                if base_table is not None and (base_table, column_ref) not in results:
                    results.append((base_table, column_ref))
    return results


class SnowflakeSemanticViewLineage:
    """Builds lineage from Snowflake semantic views to their base tables.

    Queries the database-qualified INFORMATION_SCHEMA semantic catalog views,
    resolves the OpenMetadata entities via the injected ``resolve_table_by_fqn``
    (which is expected to be cached), and yields one AddLineageRequest per
    (base table -> semantic view) edge carrying the resolvable column lineage.
    """

    def __init__(
        self,
        service_name: str,
        engine,
        database_filter_pattern,
        resolve_table_by_fqn: Callable[[str], Optional[Table]],  # noqa: UP045
    ):
        self.service_name = service_name
        self.engine = engine
        self.database_filter_pattern = database_filter_pattern
        self.resolve_table_by_fqn = resolve_table_by_fqn

    def iter_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Yield semantic view lineage across every allowed database."""
        for database in self._get_databases():
            try:
                yield from self._iter_database_lineage(database)
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning(f"Failed to extract semantic view lineage for database [{database}]: {exc}")
                logger.debug(traceback.format_exc())

    def _get_databases(self) -> List[str]:  # noqa: UP006
        """List databases allowed by the database filter pattern."""
        databases = []
        try:
            for row in self._run(SNOWFLAKE_GET_DATABASES):
                database = row[1]
                if not filter_by_database(self.database_filter_pattern, database):
                    databases.append(database)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"Failed to list databases for semantic view lineage: {exc}")
            logger.debug(traceback.format_exc())
        return databases

    def _iter_database_lineage(self, database: str) -> Iterable[Either[AddLineageRequest]]:
        table_maps = self._fetch_table_maps(database)
        columns_by_view = self._fetch_columns(database)
        for view_key in set(table_maps) | set(columns_by_view):
            schema, view = view_key
            try:
                yield from self._build_view_lineage(
                    database,
                    schema,
                    view,
                    table_maps.get(view_key, {}),
                    columns_by_view.get(view_key, {}),
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning(f"Failed semantic view lineage for [{database}.{schema}.{view}]: {exc}")
                logger.debug(traceback.format_exc())

    def _fetch_table_maps(self, database: str) -> Dict[ViewKey, Dict[str, BaseTable]]:  # noqa: UP006
        """{(schema, view): {logical_table_name: (base_catalog, base_schema, base_table)}}"""
        table_maps: Dict[ViewKey, Dict[str, BaseTable]] = {}  # noqa: UP006
        for row in self._run(SNOWFLAKE_GET_SEMANTIC_TABLES_IN_DB.format(database=_quote_db(database))):
            schema, view, logical_name, base_catalog, base_schema, base_table = (
                row[0],
                row[1],
                row[2],
                row[3],
                row[4],
                row[5],
            )
            table_maps.setdefault((schema, view), {})[logical_name] = (base_catalog, base_schema, base_table)
        return table_maps

    def _fetch_columns(self, database: str) -> Dict[ViewKey, Dict[str, dict]]:  # noqa: UP006
        """{(schema, view): {column_name: {"logical_table":..., "expression":...}}}"""
        columns_by_view: Dict[ViewKey, Dict[str, dict]] = {}  # noqa: UP006
        for catalog_view in SEMANTIC_COLUMN_CATALOG_VIEWS:
            query = SNOWFLAKE_GET_SEMANTIC_COLUMNS_IN_DB.format(database=_quote_db(database), catalog_view=catalog_view)
            for row in self._run(query):
                schema, view, name, expression = row[0], row[1], row[3], row[4]
                columns = columns_by_view.setdefault((schema, view), {})
                columns.setdefault(name, {"expression": expression})
        return columns_by_view

    def _build_view_lineage(
        self,
        database: str,
        schema: str,
        view: str,
        table_map: Dict[str, BaseTable],  # noqa: UP006
        columns: Dict[str, dict],  # noqa: UP006
    ) -> Iterable[Either[AddLineageRequest]]:
        view_entity = self.resolve_table_by_fqn(fqn._build(self.service_name, database, schema, view))
        requests: List[Either[AddLineageRequest]] = []  # noqa: UP006
        if view_entity is not None:
            pairs_by_base = self._group_pairs_by_base_table(columns, table_map)
            for base_table in set(table_map.values()):
                pairs_by_base.setdefault(base_table, [])
            for base_table, pairs in pairs_by_base.items():
                request = self._build_edge(base_table, view_entity, pairs)
                if request is not None:
                    requests.append(request)
        return requests

    @staticmethod
    def _group_pairs_by_base_table(
        columns: Dict[str, dict],  # noqa: UP006
        table_map: Dict[str, BaseTable],  # noqa: UP006
    ) -> Dict[BaseTable, List[Tuple[str, str]]]:  # noqa: UP006
        """Map each base table to the (base_column, view_column) pairs feeding it."""
        pairs_by_base: Dict[BaseTable, List[Tuple[str, str]]] = {}  # noqa: UP006
        for view_column in columns:
            for base_table, base_column in resolve_base_columns(view_column, columns, table_map):
                pairs_by_base.setdefault(base_table, []).append((base_column, view_column))
        return pairs_by_base

    def _build_edge(
        self,
        base_table: BaseTable,
        view_entity: Table,
        pairs: List[Tuple[str, str]],  # noqa: UP006
    ) -> Optional[Either[AddLineageRequest]]:  # noqa: UP045
        base_catalog, base_schema, base_name = base_table
        base_entity = self.resolve_table_by_fqn(fqn._build(self.service_name, base_catalog, base_schema, base_name))
        result = None
        if base_entity is not None:
            column_lineage = self._build_column_lineage(base_entity, view_entity, pairs)
            result = Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=base_entity.id, type="table"),
                        toEntity=EntityReference(id=view_entity.id, type="table"),
                        lineageDetails=LineageDetails(
                            source=LineageSource.ViewLineage,
                            columnsLineage=column_lineage or None,
                        ),
                    )
                )
            )
        return result

    @staticmethod
    def _build_column_lineage(
        base_entity: Table,
        view_entity: Table,
        pairs: List[Tuple[str, str]],  # noqa: UP006
    ) -> List[ColumnLineage]:  # noqa: UP006
        """Group (base_column, view_column) pairs into ColumnLineage entries by
        destination column, resolving each side to its materialized column FQN."""
        grouped: Dict[str, List[str]] = {}  # noqa: UP006
        for base_column, view_column in pairs:
            from_fqn = get_column_fqn(base_entity, base_column)
            to_fqn = get_column_fqn(view_entity, view_column)
            if from_fqn and to_fqn:
                sources = grouped.setdefault(to_fqn, [])
                if from_fqn not in sources:
                    sources.append(from_fqn)
        return [ColumnLineage(fromColumns=sources, toColumn=to_fqn) for to_fqn, sources in grouped.items()]

    def _run(self, query: str) -> List[tuple]:  # noqa: UP006
        """Execute a query against the Snowflake engine and return all rows."""
        rows = []
        if self.engine is not None:
            with self.engine.connect() as conn:
                rows = list(conn.execute(text(query)))
        return rows
