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
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
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
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    build_metric_name,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# A base table identified by (catalog, schema, table)
BaseTable = tuple[str, str, str]
# A semantic view identified within a database by (schema, view)
ViewKey = tuple[str, str]
# A semantic object's identity within one view: (logical_table, name). The name alone
# is not unique -- Snowflake declares every object as ``<table_alias>.<name>``.
SemanticKey = tuple[str, str]

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


def match_semantic_name(
    table_ref: str,
    name_ref: str,
    columns: Dict[SemanticKey, dict],  # noqa: UP006
) -> Optional[SemanticKey]:  # noqa: UP045
    """Return the ``(logical_table, name)`` key matching a table-qualified reference
    (case-insensitively), used to detect intra-view references (e.g. a metric defined
    over a fact).

    Matching on the name alone would jump to a same-named object on a *different*
    logical table, which Snowflake allows: names are scoped to the logical table.
    """
    lowered = (table_ref.lower(), name_ref.lower())
    matched = None
    for key in columns:
        if (key[0].lower(), key[1].lower()) == lowered:
            matched = key
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
    column_key: SemanticKey,
    columns: Dict[SemanticKey, dict],  # noqa: UP006
    table_map: Dict[str, BaseTable],  # noqa: UP006
    depth: int = 0,
) -> List[Tuple[BaseTable, str]]:  # noqa: UP006
    """Resolve a semantic object to the physical base-table columns it derives from.

    ``column_key`` is ``(logical_table, name)`` -- the name alone does not identify a
    semantic object, since Snowflake scopes it to the logical table.

    Follows intra-view references (metric -> fact -> physical column) up to
    ``_MAX_RESOLUTION_DEPTH`` levels to avoid runaway recursion on cyclic
    definitions. Returns a de-duplicated list of ``(base_table, base_column)``.
    """
    results: List[Tuple[BaseTable, str]] = []  # noqa: UP006
    info = columns.get(column_key)
    if info is not None and depth <= _MAX_RESOLUTION_DEPTH:
        for table_ref, column_ref in extract_column_refs(info.get("expression")):
            matched = match_semantic_name(table_ref, column_ref, columns)
            if matched is not None and matched != column_key:
                for item in resolve_base_columns(matched, columns, table_map, depth + 1):
                    if item not in results:
                        results.append(item)
            else:
                base_table = lookup_base_table(table_ref, table_map)
                if base_table is not None and (base_table, column_ref) not in results:
                    results.append((base_table, column_ref))
    return results


def _table_reference(entity: Table) -> EntityReference:
    """Build a table EntityReference for a lineage edge endpoint."""
    return EntityReference(id=entity.id, type="table")  # pyright: ignore[reportCallIssue]


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
        resolve_metric_by_name: Callable[[str], Optional[Metric]],  # noqa: UP045
        configured_database: Optional[str] = None,  # noqa: UP045
    ):
        self.service_name = service_name
        self.engine = engine
        self.database_filter_pattern = database_filter_pattern
        self.resolve_table_by_fqn = resolve_table_by_fqn
        self.resolve_metric_by_name = resolve_metric_by_name
        self.configured_database = configured_database
        self._connection = None

    def iter_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Yield semantic view lineage across every allowed database."""
        try:
            for database in self._get_databases():
                try:
                    yield from self._iter_database_lineage(database)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning(f"Failed to extract semantic view lineage for database [{database}]: {exc}")
                    logger.debug(traceback.format_exc())
        finally:
            self._close()

    def _get_databases(self) -> List[str]:  # noqa: UP006
        """Databases to scan for semantic views.

        Mirrors ``_compute_filtered_database_names`` in the metadata source: when the
        service connection pins a database, that is the only one in scope, so the
        account-wide ``SHOW DATABASES`` sweep is skipped entirely. Without that
        short-circuit we issue the four semantic catalog queries against every
        database in the account, including ones this service never ingested.
        """
        if self.configured_database:
            return [self.configured_database]
        databases = []
        try:
            for row in self._run(SNOWFLAKE_GET_DATABASES):
                database = row[1]
                if not filter_by_database(self.database_filter_pattern, database):
                    databases.append(database)
            logger.info(f"Semantic view lineage will scan {len(databases)} database(s)")
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"Failed to list databases for semantic view lineage: {exc}")
            logger.debug(traceback.format_exc())
        return databases

    def _iter_database_lineage(self, database: str) -> Iterable[Either[AddLineageRequest]]:
        table_maps = self._fetch_table_maps(database)
        columns_by_view = self._fetch_columns(database)
        metrics_by_view = self._fetch_view_metrics(database)
        for view_key in set(table_maps) | set(columns_by_view) | set(metrics_by_view):
            schema, view = view_key
            try:
                yield from self._build_view_lineage(
                    database,
                    schema,
                    view,
                    table_maps.get(view_key, {}),
                    columns_by_view.get(view_key, {}),
                )
                view_entity = self.resolve_table_by_fqn(fqn._build(self.service_name, database, schema, view))
                if view_entity is not None:
                    yield from self._build_view_metric_edges(
                        database, schema, view, view_entity, metrics_by_view.get(view_key, [])
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

    def _fetch_columns(self, database: str) -> Dict[ViewKey, Dict[SemanticKey, dict]]:  # noqa: UP006
        """{(schema, view): {(logical_table, name): {"logical_table":..., "expression":...}}}

        Keyed by ``(TABLE_NAME, NAME)`` rather than ``NAME``: Snowflake scopes a
        semantic object's name to its logical table, so one view may define both
        ``orders.status`` and ``returns.status``. Collapsing them onto one entry
        resolved the second through the first's expression, silently attributing its
        column lineage to the wrong base table.
        """
        columns_by_view: Dict[ViewKey, Dict[SemanticKey, dict]] = {}  # noqa: UP006
        for catalog_view in SEMANTIC_COLUMN_CATALOG_VIEWS:
            query = SNOWFLAKE_GET_SEMANTIC_COLUMNS_IN_DB.format(database=_quote_db(database), catalog_view=catalog_view)
            for row in self._run(query):
                schema, view, logical_table, name, expression = row[0], row[1], row[2], row[3], row[4]
                columns = columns_by_view.setdefault((schema, view), {})
                columns.setdefault((logical_table, name), {"logical_table": logical_table, "expression": expression})
        return columns_by_view

    def _fetch_view_metrics(self, database: str) -> Dict[ViewKey, List[SemanticKey]]:  # noqa: UP006
        """{(schema, view): [(logical_table, metric_name), ...]} for the whole database.

        The logical table is part of the metric's identity and feeds
        ``build_metric_name``; dropping it here would make this pass look up a name
        the metadata pass never wrote.
        """
        metrics_by_view: Dict[ViewKey, List[SemanticKey]] = {}  # noqa: UP006
        query = SNOWFLAKE_GET_SEMANTIC_COLUMNS_IN_DB.format(
            database=_quote_db(database), catalog_view="semantic_metrics"
        )
        for row in self._run(query):
            schema, view, logical_table, name = row[0], row[1], row[2], row[3]
            metrics_by_view.setdefault((schema, view), []).append((logical_table, name))
        return metrics_by_view

    def _build_view_metric_edges(
        self,
        database: str,
        schema: str,
        view: str,
        view_entity: Table,
        metrics: List[SemanticKey],  # noqa: UP006
    ) -> Iterable[Either[AddLineageRequest]]:
        """Yield one `semantic view -> Metric` edge per resolvable metric."""
        requests: List[Either[AddLineageRequest]] = []  # noqa: UP006
        for logical_table, metric_name in metrics:
            name = build_metric_name(self.service_name, database, schema, view, logical_table, metric_name)
            metric = self.resolve_metric_by_name(name)
            if metric is not None:
                requests.append(
                    Either(  # pyright: ignore[reportCallIssue]
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=_table_reference(view_entity),
                                toEntity=EntityReference(id=metric.id, type="metric"),  # pyright: ignore[reportCallIssue]
                                lineageDetails=LineageDetails(  # pyright: ignore[reportCallIssue]
                                    source=LineageSource.ViewLineage,
                                ),
                            )
                        )
                    )
                )
        return requests

    def _build_view_lineage(
        self,
        database: str,
        schema: str,
        view: str,
        table_map: Dict[str, BaseTable],  # noqa: UP006
        columns: Dict[SemanticKey, dict],  # noqa: UP006
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
        columns: Dict[SemanticKey, dict],  # noqa: UP006
        table_map: Dict[str, BaseTable],  # noqa: UP006
    ) -> Dict[BaseTable, List[Tuple[str, str]]]:  # noqa: UP006
        """Map each base table to the (base_column, view_column) pairs feeding it.

        Resolution keys on ``(logical_table, name)``, but the pair's destination is the
        bare name: that is what the semantic view's Table entity calls the column
        (``merge_semantic_view_column`` keys the column list by name), and
        ``_build_column_lineage`` resolves it against that entity. Two same-named
        objects therefore land as two upstreams of the one column OpenMetadata holds,
        instead of one of them being attributed to the other's base table.
        """
        pairs_by_base: Dict[BaseTable, List[Tuple[str, str]]] = {}  # noqa: UP006
        for column_key in columns:
            view_column = column_key[1]
            for base_table, base_column in resolve_base_columns(column_key, columns, table_map):
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
            result = Either(  # pyright: ignore[reportCallIssue]
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=_table_reference(base_entity),
                        toEntity=_table_reference(view_entity),
                        lineageDetails=LineageDetails(  # pyright: ignore[reportCallIssue]
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
        return [
            ColumnLineage(  # pyright: ignore[reportCallIssue]
                fromColumns=[FullyQualifiedEntityName(source) for source in sources],
                toColumn=FullyQualifiedEntityName(to_fqn),
            )
            for to_fqn, sources in grouped.items()
        ]

    def _run(self, query: str) -> List[tuple]:  # noqa: UP006
        """Execute a query on the shared connection and return all rows.

        Reuses one connection for the whole extraction. Opening a fresh
        ``engine.connect()`` per query costs a full auth handshake each time
        (key-pair auth re-signs a JWT), and we issue four catalog queries per
        database, so per-query connections dominated the runtime.
        """
        rows = []
        if self.engine is not None:
            if self._connection is None:
                self._connection = self.engine.connect()
            rows = list(self._connection.execute(text(query)))
        return rows

    def _close(self) -> None:
        """Release the shared connection once the extraction is done."""
        if self._connection is not None:
            try:
                self._connection.close()
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(f"Failed to close semantic view lineage connection: {exc}")
            self._connection = None
