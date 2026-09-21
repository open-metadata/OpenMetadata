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
Metric-view lineage extraction for the Unity Catalog lineage workflow.

A metric view names the relations it is computed over in its YAML body:
``source`` (the fact relation) and each ``joins[].source``. Its dimensions and measures
are expressions over those relations' columns. This module turns that into table- and
column-level lineage from each source relation into the metric view.

It lives in the *lineage* workflow, not alongside the ``Metric`` ingestion in the
metadata workflow, because an edge needs both ends resolved: during metadata ingestion a
metric view's source table may not have been walked yet, and the edge would silently
vanish on every first run.
"""

import json
import traceback
from collections.abc import Callable, Iterable

from cachetools import LRUCache

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.semantic_metric_lineage import (
    column_lineage,
    metric_lineage_request,
    view_lineage_request,
)
from metadata.ingestion.source.database.unitycatalog.metric_views import (
    MetricViewDefinition,
    build_metric_name,
    extract_column_refs,
    is_table_reference,
    parse_metric_view,
    resolve_alias,
    split_table_reference,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_DESCRIBE_TABLE_JSON,
    UNITY_CATALOG_GET_METRIC_VIEWS_IN_CATALOG,
    UNITY_CATALOG_GET_VIEW_DEFINITIONS_IN_CATALOG,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# A source relation identified by (catalog, schema, table).
SourceTable = tuple[str, str, str]
# (schema, view, yaml body)
ViewDefinitionRow = tuple[str, str, str]

# Resolved source/metric-view Table entities held while one catalog is processed. A
# catalog's metric views share their source relations, so a cache pays for itself, but
# a Table entity carries its whole column list -- cap it rather than let a catalog with
# many metric views accumulate every relation they touch.
TABLE_CACHE_MAX_SIZE = 100

# One entry per measure rather than per relation, so a catalog of metric views fills
# this faster than the table cache; a Metric is small, but still cap it.
METRIC_CACHE_MAX_SIZE = 500


class UnitycatalogMetricViewLineage:
    """Builds lineage from Unity Catalog metric views to the relations they read.

    Composed by :class:`UnitycatalogLineageSource` rather than mixed into it. The four
    things it cannot do for itself -- run a query on the SQL warehouse, resolve a Table
    by FQN, resolve a Metric by name, and list the service's catalogs -- arrive as
    callables, so the source keeps its I/O and this class stays exercisable on its own.
    Everything between them, the filtering and the parsing and the edge building, lives
    here and is tested here.
    """

    def __init__(
        self,
        service_name: str,
        source_config: DatabaseServiceQueryLineagePipeline,
        status: Status,
        run_query: Callable[[str], list[tuple]],
        resolve_table_by_fqn: Callable[[str], Table | None],
        resolve_metric_by_name: Callable[[str], Metric | None],
        list_databases: Callable[[], Iterable[Database]],
    ):
        self.service_name = service_name
        self.source_config = source_config
        self.status = status
        self.run_query = run_query
        self.resolve_table_by_fqn = resolve_table_by_fqn
        self.resolve_metric_by_name = resolve_metric_by_name
        self.list_databases = list_databases
        self._table_cache: LRUCache = LRUCache(maxsize=TABLE_CACHE_MAX_SIZE)
        self._metric_cache: LRUCache = LRUCache(maxsize=METRIC_CACHE_MAX_SIZE)

    # ------------------------------------------------------------------ entry point

    def iter_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Yield every resolvable ``source relation -> metric view`` edge.

        Gated on the same ``processViewLineage`` flag as every other view-derived edge
        -- a metric view is a view -- so a run that turns view lineage off does not pay
        for the per-catalog queries below.
        """
        if not self.source_config.processViewLineage:
            return
        logger.info("Processing Unity Catalog Metric View Lineage")
        for database in self._databases():
            self._table_cache.clear()
            try:
                rows = self._view_definitions(database)
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning("Could not list view definitions for catalog [%s]: %s", database, exc)
                continue
            for schema, view, definition_text in rows:
                yield from self._iter_view_lineage(database, schema, view, definition_text)

    def _iter_view_lineage(
        self, database: str, schema: str, view: str, definition_text: str
    ) -> Iterable[Either[AddLineageRequest]]:
        try:
            definition = parse_metric_view(definition_text)
        except Exception as exc:  # pylint: disable=broad-except
            self._warn(schema, view, f"the view definition could not be read: {exc}")
            return
        if definition is None:
            return
        if self._filtered_out(database, schema, view):
            return
        try:
            yield from self._build_edges(database, schema, view, definition)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            self._warn(schema, view, f"lineage could not be built: {exc}")

    def _databases(self) -> list[str]:
        """The catalogs in scope, taken from what the metadata workflow ingested.

        Listing from OpenMetadata rather than from ``SHOW CATALOGS`` keeps the pass to
        catalogs that actually have entities to attach lineage to, and applies the run's
        own database filter on top.

        Total by construction: this pass runs *after* the source's own lineage, so a
        failure here must cost the metric views and nothing that already succeeded.
        """
        databases = []
        try:
            listing = list(self.list_databases())
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning("Could not list catalogs for metric view lineage: %s", exc)
            return []
        for database in listing:
            name = model_str(database.name)
            if filter_by_database(self.source_config.databaseFilterPattern, name):
                self.status.filter(model_str(database.fullyQualifiedName), "Catalog Filtered Out")
                continue
            databases.append(name)
        return databases

    # -------------------------------------------------------------------- discovery

    def _view_definitions(self, database: str) -> list[ViewDefinitionRow]:
        """Every metric-view YAML body in one catalog.

        Two passes, because Unity Catalog does not keep a metric view in one place.
        The ``information_schema.views`` scan comes first and costs a single query per
        catalog: on a runtime that publishes a metric view's YAML as its
        ``view_definition`` it finds every one of them, and ``parse_metric_view``
        separates them from the SQL views it also returns.

        That scan alone is not enough. On current Databricks SQL a metric view is
        absent from ``information_schema.views`` altogether -- it is listed only in
        ``information_schema.tables`` with ``TABLE_TYPE = 'METRIC_VIEW'``, and its YAML
        body lives in ``DESCRIBE TABLE EXTENDED ... AS JSON``. Without the second pass
        the whole feature yields nothing on such a runtime, silently. The extra
        ``DESCRIBE`` is per metric view the first pass missed, so the cost scales with
        the number of metric views rather than the size of the catalog.
        """
        query = UNITY_CATALOG_GET_VIEW_DEFINITIONS_IN_CATALOG.format(database_name=_escape(database))
        rows = [(row[0], row[1], row[2]) for row in self.run_query(query)]
        rows.extend(self._described_metric_views(database, {(schema, view) for schema, view, _ in rows}))
        return rows

    def _described_metric_views(self, database: str, already_found: set[tuple[str, str]]) -> list[ViewDefinitionRow]:
        """The catalog's metric views that the ``information_schema.views`` scan missed.

        Filtered before the ``DESCRIBE`` rather than after: every row here is already
        known to be a metric view, so a view the run excludes can be dropped without
        paying for a round-trip to read a definition nothing will use.
        """
        query = UNITY_CATALOG_GET_METRIC_VIEWS_IN_CATALOG.format(database_name=_escape(database))
        try:
            candidates = self.run_query(query)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning("Could not list metric views for catalog [%s]: %s", database, exc)
            return []
        rows = []
        for row in candidates:
            schema, view = row[0], row[1]
            if (schema, view) in already_found or self._filtered_out(database, schema, view):
                continue
            definition_text = self._describe_view_text(database, schema, view)
            if definition_text:
                rows.append((schema, view, definition_text))
        return rows

    def _describe_view_text(self, database: str, schema: str, view: str) -> str | None:
        """One metric view's YAML body, read from ``DESCRIBE ... AS JSON``."""
        query = UNITY_CATALOG_DESCRIBE_TABLE_JSON.format(
            database_name=_escape(database), schema_name=_escape(schema), table_name=_escape(view)
        )
        try:
            rows = self.run_query(query)
            payload = json.loads(rows[0][0]) if rows and rows[0] else {}
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            self._warn(schema, view, f"the view definition could not be read: {exc}")
            return None
        return payload.get("view_text") or payload.get("view_original_text")

    def _filtered_out(self, database: str, schema: str, view: str) -> bool:
        """Honour the run's schema/table filters for the metric view itself."""
        if filter_by_schema(self.source_config.schemaFilterPattern, schema):
            self.status.filter(f"{database}.{schema}", "Schema Filtered Out")
            return True
        if filter_by_table(self.source_config.tableFilterPattern, view):
            self.status.filter(f"{database}.{schema}.{view}", "Table Filtered Out")
            return True
        return False

    # ----------------------------------------------------------------------- edges

    def _build_edges(
        self, database: str, schema: str, view: str, definition: MetricViewDefinition
    ) -> Iterable[Either[AddLineageRequest]]:
        """Lineage from every relation the metric view reads into the view itself.

        Table-level lineage is emitted for each resolvable source relation even when no
        expression resolves to one of its columns, so a view whose expressions we
        cannot decompose still shows where its data comes from.
        """
        view_entity = self._resolve(fqn._build(self.service_name, database, schema, view))
        if view_entity is None:
            self._warn(schema, view, "the metric view is not in OpenMetadata; lineage skipped")
            return

        primary = self._resolve_sources(database, schema, view, definition.source, "source")
        joins = {
            join.name: self._resolve_sources(database, schema, view, join.source, f"join [{join.name}]")
            for join in definition.joins
            if join.name
        }

        pairs_by_source = self._column_pairs(definition, primary, joins)
        for entity in [*primary, *(table for tables in joins.values() for table in tables)]:
            pairs_by_source.setdefault(model_str(entity.fullyQualifiedName), (entity, []))

        for source_entity, pairs in pairs_by_source.values():
            yield view_lineage_request(source_entity, view_entity, column_lineage(source_entity, view_entity, pairs))

        yield from self._build_metric_edges(database, schema, view, view_entity, definition)

    def _build_metric_edges(
        self, database: str, schema: str, view: str, view_entity: Table, definition: MetricViewDefinition
    ) -> Iterable[Either[AddLineageRequest]]:
        """One ``metric view -> Metric`` edge per measure the metadata pass wrote.

        Without these the graph stops at the view: a Metric would hang off the catalog
        with an ``assets`` back-reference but no lineage, so "what feeds Total Revenue"
        has no answer even though every edge behind it exists. Chaining them onto the
        view rather than onto the source relations keeps the view as the single hop
        the column-level lineage already explains.

        A measure whose Metric does not resolve is skipped in silence: the metadata
        workflow may simply not have run yet, and that is not a lineage fault.
        """
        for measure in definition.measures:
            if not measure.name:
                continue
            metric = self._resolve_metric(build_metric_name(self.service_name, database, schema, view, measure.name))
            if metric is not None:
                yield metric_lineage_request(view_entity, metric)

    def _resolve_metric(self, metric_name: str) -> Metric | None:
        if metric_name not in self._metric_cache:
            self._metric_cache[metric_name] = self.resolve_metric_by_name(metric_name)
        return self._metric_cache[metric_name]

    def _column_pairs(
        self,
        definition: MetricViewDefinition,
        primary: list[Table],
        joins: dict[str, list[Table]],
    ) -> dict[str, tuple[Table, list[tuple[str, str]]]]:
        """``{source FQN: (source entity, [(source column, view column), ...])}``.

        A reference is only kept when the resolved source actually has a column by that
        name, which is what separates real column references from the function names,
        literals and measure references that share their syntax. The pair keeps the
        *names*; the shared builder resolves both ends to column FQNs.
        """
        pairs_by_source: dict[str, tuple[Table, list[tuple[str, str]]]] = {}
        for column in [*definition.all_dimensions, *definition.measures]:
            if not column.name:
                continue
            for alias, referenced in extract_column_refs(column.expr):
                join_name = resolve_alias(alias, joins.keys())
                candidates = joins.get(join_name, []) if join_name else primary
                for candidate in candidates:
                    if get_column_fqn(candidate, referenced):
                        _, pairs = pairs_by_source.setdefault(model_str(candidate.fullyQualifiedName), (candidate, []))
                        pairs.append((referenced, column.name))
        return pairs_by_source

    # ------------------------------------------------------------------- resolution

    def _resolve_sources(self, database: str, schema: str, view: str, source: str | None, label: str) -> list[Table]:
        """The Table entities a metric view's ``source`` reads.

        An unresolvable relation warns and drops out: it is usually a table filtered out
        of the run, or one the metadata workflow never ingested. Every other relation of
        the same view still produces its edge.
        """
        entities = []
        for reference in self.source_table_refs(source, database, schema):
            entity = self._resolve(fqn._build(self.service_name, *reference))
            if entity is None:
                self._warn(schema, view, f"{label} relation [{'.'.join(reference)}] is not in OpenMetadata")
            else:
                entities.append(entity)
        return entities

    def _resolve(self, table_fqn: str) -> Table | None:
        if table_fqn not in self._table_cache:
            self._table_cache[table_fqn] = self.resolve_table_by_fqn(table_fqn)
        return self._table_cache[table_fqn]

    @staticmethod
    def source_table_refs(source: str | None, database: str, schema: str) -> list[SourceTable]:
        """``(catalog, schema, table)`` for every relation a ``source:`` value reads.

        A metric view's source is either a bare relation reference or a query; only the
        latter needs the SQL parser. Partly-qualified references inherit the metric
        view's own catalog and schema, matching how Databricks resolves them.
        """
        if not source or not source.strip():
            return []
        if is_table_reference(source):
            return _qualify(split_table_reference(source), database, schema)
        references = []
        parsed_tables = LineageParser(source, dialect=Dialect.DATABRICKS).source_tables
        for parsed in parsed_tables:  # pyright: ignore[reportGeneralTypeIssues]
            parsed_schema = getattr(getattr(parsed, "schema", None), "raw_name", "") or ""
            # sqllineage names an unqualified relation's schema "<default>"; that is a
            # placeholder, not a qualifier, so drop it and let the metric view's own
            # scope apply.
            if parsed_schema.startswith("<"):
                parsed_schema = ""
            segments = split_table_reference(f"{parsed_schema}.{parsed.raw_name}")
            references.extend(_qualify(segments, database, schema))
        return references

    def _warn(self, schema: str, view: str, reason: str) -> None:
        """Report a metric-view lineage problem as a run warning, never a failure."""
        message = f"Metric view lineage [{schema}.{view}]: {reason}"
        logger.warning(message)
        self.status.warning(f"{schema}.{view}", message)


def _escape(identifier: str) -> str:
    """Make an identifier safe to interpolate between backticks."""
    return identifier.replace("`", "``")


def _qualify(segments: list[str], database: str, schema: str) -> list[SourceTable]:
    """Complete a 1-, 2- or 3-part relation reference with the metric view's scope."""
    if not segments:
        return []
    if len(segments) == 1:
        return [(database, schema, segments[0])]
    if len(segments) == 2:
        return [(database, segments[0], segments[1])]
    return [(segments[-3], segments[-2], segments[-1])]
