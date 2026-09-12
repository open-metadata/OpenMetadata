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
Databricks Unity Catalog Lineage Source Module
"""

import json
import traceback
from collections import defaultdict
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

from cachetools import LRUCache
from sqlalchemy import text

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import ContainerDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import SqlQuery
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import (
    close_on_failure,
    create_connection,
    run_test_connection,
    test_connection_common,
)
from metadata.ingestion.source.database.unitycatalog.path_utils import (
    container_path_candidates,
    normalize_storage_path,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_EXTERNAL_TABLES,
    UNITY_CATALOG_QUERY_HISTORY_PROBE,
    unity_catalog_native_lineage_query,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
        DatabaseServiceQueryLineagePipeline,
    )
    from metadata.ingestion.source.database.unitycatalog.connection import (
        UnityCatalogConnection as UnityCatalogConnectionHandler,
    )


logger = ingestion_logger()

TABLE_CACHE_MAX_SIZE = 500
LINEAGE_ROW_BUFFER_SIZE = 1000


class UnitycatalogLineageSource(Source):
    """
    Lineage Unity Catalog Source
    """

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config = cast("DatabaseServiceQueryLineagePipeline", self.config.sourceConfig.config)
        self._connection = create_connection(self.service_connection)
        connection = cast("UnityCatalogConnectionHandler", self._connection)
        self.connection_obj = connection.client
        self.engine = connection.sql.client
        self.external_location_map: dict[str, str] = {}
        self.path_to_table_map: dict[str, set[str]] = defaultdict(set)
        self._table_cache: LRUCache = LRUCache(maxsize=TABLE_CACHE_MAX_SIZE)
        # A table can be both a lineage target and an external table; the run summary
        # should still name it once.
        self._filter_reported: set[str] = set()
        with close_on_failure(self._connection):
            self.test_connection()

    def close(self):
        if self._connection is not None:
            self._connection.close()

    def prepare(self):
        """
        By default, there's nothing to prepare
        """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: UnityCatalogConnection = config.serviceConnection.root.config
        if not isinstance(connection, UnityCatalogConnection):
            raise InvalidSourceException(f"Expected UnityCatalogConnection, but got {connection}")
        return cls(config, metadata)

    def _resolve_lineage_side(self, full_name: str | None, path: str | None) -> tuple[set[str], str | None]:
        """
        Turn one side of a system-table lineage row into the tables it stands for.

        A row that reads or writes a location by path (`delta.`abfss://...``) carries
        no table name at all, only `source_path`/`target_path`. Such a path is the
        storage of a registered external table whenever one is declared over it, which
        makes it resolvable to a real table; otherwise it is handed back for the
        container lookup to try.

        Returns the table names for this side and, when it could not be resolved,
        the normalized path.
        """
        if full_name:
            return {full_name}, None

        normalized_path = normalize_storage_path(path)
        if not normalized_path:
            return set(), None

        tables = self.path_to_table_map.get(normalized_path)
        if tables:
            return set(tables), None

        return set(), normalized_path

    def _probe_query_history(self) -> bool:
        """
        Whether `system.query.history` can be joined for the statement that wrote an edge.

        The join needs `statement_id` on the lineage rows and SELECT on the history
        table, and neither is guaranteed: the column is only populated for statements
        run on a SQL warehouse, and reading statement text is separately granted. A
        query that names them both would fail as a whole, taking the lineage with it,
        so it is analysed once here with nothing to scan.
        """
        try:
            with self.engine.connect() as conn:
                conn.execute(text(UNITY_CATALOG_QUERY_HISTORY_PROBE))
        except Exception as exc:
            logger.info(
                "system.query.history is not readable, native lineage will be ingested "
                "without its SQL. Grant SELECT on system.query.history to attach it: %s",
                exc,
            )
            return False
        return True

    @staticmethod
    def _parse_column_pairs(raw_column_pairs: str | None) -> list[tuple[str, str]]:
        """
        Read the column mappings an edge carries on its own row.

        Aggregating them into JSON inside the warehouse is what lets one query answer
        for both system tables. Sorted because `collect_set` has no order of its own
        and an edge that is re-ingested unchanged should serialize identically.
        """
        if not raw_column_pairs:
            return []
        try:
            pairs = json.loads(raw_column_pairs)
        except (TypeError, ValueError) as exc:
            logger.debug("Skipping unreadable column pairs %r: %s", raw_column_pairs, exc)
            return []
        return sorted(
            (pair["source"], pair["target"])
            for pair in pairs
            if isinstance(pair, dict) and pair.get("source") and pair.get("target")
        )

    def _stream_native_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Emit native lineage one target at a time, as its rows arrive.

        The rows are ordered by target, so a target's edges are complete as soon as the
        next target appears and nothing needs to be held past the target in hand.

        They are grouped at all because Databricks reports one edge twice when it names
        a side by table on one row and by path on another, and `addLineage` replaces an
        edge's details instead of merging them: a second request for a pair already sent
        would drop the column mappings of the first.
        """
        query_log_duration = self.source_config.queryLogDuration or 1
        include_query_history = self._probe_query_history()
        logger.info(
            "Reading native lineage from system tables (lookback: %s days, SQL text: %s)",
            query_log_duration,
            "yes" if include_query_history else "no",
        )

        target: tuple[str | None, str | None] | None = None
        upstream_columns: dict[str, dict[tuple[str, str], None]] = {}
        upstream_sql: dict[str, str] = {}
        upstream_paths: set[str] = set()
        targets = 0
        emitted = 0

        try:
            with self.engine.connect() as conn:
                rows = conn.execution_options(stream_results=True, max_row_buffer=LINEAGE_ROW_BUFFER_SIZE).execute(
                    text(unity_catalog_native_lineage_query(query_log_duration, include_query_history))
                )

                for row in rows:
                    row_target = (row.target_table_full_name, row.target_path)
                    if target is not None and row_target != target:
                        targets += 1
                        for either in self._process_target_lineage(
                            target, upstream_columns, upstream_sql, upstream_paths
                        ):
                            emitted += 1
                            yield either
                        upstream_columns, upstream_sql, upstream_paths = {}, {}, set()
                    target = row_target

                    source_tables, source_path = self._resolve_lineage_side(row.source_table_full_name, row.source_path)
                    column_pairs = self._parse_column_pairs(row.column_pairs)
                    for source_table in source_tables:
                        pairs = upstream_columns.setdefault(source_table, {})
                        for column_pair in column_pairs:
                            pairs.setdefault(column_pair, None)
                        if row.statement_text:
                            upstream_sql[source_table] = row.statement_text

                    if source_path:
                        upstream_paths.add(source_path)

                if target is not None:
                    targets += 1
                    for either in self._process_target_lineage(target, upstream_columns, upstream_sql, upstream_paths):
                        emitted += 1
                        yield either

            logger.info("Native lineage: emitted %s edges over %s targets", emitted, targets)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to read native lineage: %s", exc)

    def _process_target_lineage(
        self,
        target: tuple[str | None, str | None],
        upstream_columns: dict[str, dict[tuple[str, str], None]],
        upstream_sql: dict[str, str],
        upstream_paths: set[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Emit the edges collected for one target.

        A target addressed by location stands for every table declared over it, so the
        rows of one target can belong to more than one table.
        """
        target_tables, _ = self._resolve_lineage_side(*target)

        for target_table in sorted(target_tables):
            if self._is_filtered(target_table):
                continue

            table = self._get_table_entity(target_table)
            if not table:
                logger.debug("Unable to find downstream entity: %s", target_table)
                continue

            yield from self._process_table_lineage(table, target_table, upstream_columns, upstream_sql)

            yield from self._process_path_lineage(table, target_table, upstream_paths)

    def _cache_external_locations(self):
        """
        Bulk-fetch all external table storage locations from system.information_schema.tables.
        """
        logger.info("Caching external table locations from system tables")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(text(UNITY_CATALOG_EXTERNAL_TABLES))
                for row in rows:
                    table_fqn = f"{row.table_catalog}.{row.table_schema}.{row.table_name}"
                    self.external_location_map[table_fqn] = row.storage_path
                    # The inverse direction resolves the paths that lineage rows carry
                    # instead of a table name. Several external tables may be declared
                    # over one location, and each is a legitimate reading of it.
                    normalized_path = normalize_storage_path(row.storage_path)
                    if normalized_path:
                        self.path_to_table_map[normalized_path].add(table_fqn)
            logger.info(
                "Cached %s external table locations over %s distinct paths",
                len(self.external_location_map),
                len(self.path_to_table_map),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to cache external table locations: {exc}")

    def _get_table_entity(self, databricks_table_fqn: str) -> Table | None:
        """
        Resolve a `catalog.schema.table` name to the table ingested for it.

        A hot upstream is named by many edges and an upstream that was never ingested
        is named just as often, so both answers are cached; a lookup that failed is
        not, since one unreachable call would otherwise blind the rest of the run.

        The name is built rather than searched for: Unity Catalog normalises its
        identifiers, so the three parts the system tables report are the three parts
        the table was ingested under, and `fqn.build` would spend an Elasticsearch
        search per table to arrive at the same string.
        """
        if databricks_table_fqn in self._table_cache:
            return self._table_cache[databricks_table_fqn]

        parts = databricks_table_fqn.split(".")
        if len(parts) != 3:
            logger.debug("Skipping malformed table name: %s", databricks_table_fqn)
            return None
        catalog_name, schema_name, table_name = parts

        entity_fqn = fqn._build(self.config.serviceName, catalog_name, schema_name, table_name)

        try:
            entity = self.metadata.get_by_name(entity=Table, fqn=entity_fqn)
        except Exception as exc:
            logger.debug("Failed to resolve table %s: %s", databricks_table_fqn, exc)
            logger.debug(traceback.format_exc())
            return None

        self._table_cache[databricks_table_fqn] = entity
        return entity

    def _get_data_model_column_fqn(self, data_model_entity: ContainerDataModel, column: str) -> str | None:
        if not data_model_entity:
            logger.debug(f"No data model entity provided for column: {column}")
            return None
        for entity_column in data_model_entity.columns:
            if entity_column.displayName.lower() == column.lower():
                return entity_column.fullyQualifiedName.root
        logger.debug(f"Column '{column}' not found in data model with {len(data_model_entity.columns)} columns")
        return None

    def _get_container_column_lineage(
        self, data_model_entity: ContainerDataModel, table_entity: Table
    ) -> LineageDetails | None:
        try:
            column_lineage = []
            for column in table_entity.columns:
                from_column = self._get_data_model_column_fqn(
                    data_model_entity=data_model_entity, column=column.name.root
                )
                to_column = column.fullyQualifiedName.root
                if from_column and to_column:
                    column_lineage.append(ColumnLineage(fromColumns=[from_column], toColumn=to_column))
            if column_lineage:
                return LineageDetails(
                    columnsLineage=column_lineage,
                    source=LineageSource.ExternalTableLineage,
                )
            return None  # noqa: TRY300
        except Exception as exc:
            logger.debug(f"Error computing container column lineage for {table_entity.fullyQualifiedName.root}: {exc}")
            logger.debug(traceback.format_exc())
            return None

    def _get_column_lineage_details(
        self,
        from_table: Table,
        to_table: Table,
        column_pairs: dict[tuple[str, str], None],
    ) -> LineageDetails | None:
        try:
            if not column_pairs:
                return None

            col_lineage = []
            for source_col, target_col in column_pairs:
                from_col_fqn = get_column_fqn(from_table, source_col)
                to_col_fqn = get_column_fqn(to_table, target_col)
                if from_col_fqn and to_col_fqn and from_col_fqn != to_col_fqn:
                    col_lineage.append(ColumnLineage(fromColumns=[from_col_fqn], toColumn=to_col_fqn))

            if col_lineage:
                return LineageDetails(columnsLineage=col_lineage, source=LineageSource.QueryLineage)
            return None  # noqa: TRY300
        except Exception as exc:
            logger.debug(f"Error computing column lineage: {exc}")
            logger.debug(traceback.format_exc())
            return None

    def _process_external_location_lineage(self, databricks_table_fqn: str) -> Iterable[Either[AddLineageRequest]]:
        """
        Look up external table storage location from cache and create
        container lineage if a matching container is found.
        """
        storage_location = self.external_location_map.get(databricks_table_fqn)
        if not storage_location:
            return

        try:
            storage_location = storage_location.rstrip("/")
            location_entity = self.metadata.es_search_container_by_path(full_path=storage_location, fields="dataModel")

            if location_entity and location_entity[0]:
                # The container is resolved before the table: an external table whose
                # storage was never ingested cannot carry this edge, and every external
                # table in the metastore reaches here.
                table = self._get_table_entity(databricks_table_fqn)
                if not table:
                    logger.debug("Unable to find external table: %s", databricks_table_fqn)
                    return

                lineage_details = None
                if location_entity[0].dataModel:
                    lineage_details = self._get_container_column_lineage(location_entity[0].dataModel, table)

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=location_entity[0].id,
                                type="container",
                            ),
                            toEntity=EntityReference(
                                id=table.id,
                                type="table",
                            ),
                            lineageDetails=lineage_details,
                        )
                    ),
                )
        except Exception as exc:
            logger.debug(f"Error processing external location lineage for {databricks_table_fqn}: {exc}")
            logger.debug(traceback.format_exc())

    def _process_path_lineage(
        self, table: Table, databricks_table_fqn: str, upstream_paths: set[str]
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Emit lineage for upstream locations that no registered table is declared over.

        These reach the table only as a path, so the container ingested from the object
        store is the one entity that can stand in for them.
        """
        for storage_path in sorted(upstream_paths):
            try:
                location_entity = None
                for candidate in container_path_candidates(storage_path):
                    location_entity = self.metadata.es_search_container_by_path(full_path=candidate, fields="dataModel")
                    if location_entity and location_entity[0]:
                        break

                if not (location_entity and location_entity[0]):
                    logger.debug(
                        "No container ingested for upstream path %s of %s; declare an external table "
                        "over it or ingest its storage service to get this lineage",
                        storage_path,
                        databricks_table_fqn,
                    )
                    continue

                lineage_details = None
                if location_entity[0].dataModel:
                    lineage_details = self._get_container_column_lineage(location_entity[0].dataModel, table)

                yield Either(  # pyright: ignore[reportCallIssue]
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=location_entity[0].id,
                                type="container",
                            ),
                            toEntity=EntityReference(id=table.id, type="table"),
                            lineageDetails=lineage_details or LineageDetails(source=LineageSource.ExternalTableLineage),
                        )
                    ),
                )
            except Exception as exc:
                logger.debug(
                    "Error processing path lineage %s -> %s: %s",
                    storage_path,
                    databricks_table_fqn,
                    exc,
                )
                logger.debug(traceback.format_exc())

    def _process_table_lineage(
        self,
        table: Table,
        databricks_table_fqn: str,
        upstream_columns: dict[str, dict[tuple[str, str], None]],
        upstream_sql: dict[str, str],
    ) -> Iterable[Either[AddLineageRequest]]:
        for source_table_full_name in sorted(upstream_columns):
            # A table never derives from itself. The system tables record access rather
            # than derivation, so a streaming or CDC write legitimately names its target
            # as its own source. Kept as lineage it renders as a loop on the node and
            # says nothing.
            if source_table_full_name == databricks_table_fqn:
                continue
            try:
                from_entity = self._get_table_entity(source_table_full_name)
                if not from_entity:
                    logger.debug(f"Unable to find upstream entity: {source_table_full_name} -> {databricks_table_fqn}")
                    continue

                lineage_details = self._get_column_lineage_details(
                    from_table=from_entity,
                    to_table=table,
                    column_pairs=upstream_columns[source_table_full_name],
                ) or LineageDetails(source=LineageSource.QueryLineage)

                if sql_query := upstream_sql.get(source_table_full_name):
                    lineage_details.sqlQuery = SqlQuery(root=sql_query)

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            toEntity=EntityReference(id=table.id, type="table"),
                            fromEntity=EntityReference(id=from_entity.id, type="table"),
                            lineageDetails=lineage_details,
                        )
                    ),
                )
            except Exception as exc:
                logger.debug(f"Error processing lineage {source_table_full_name} -> {databricks_table_fqn}: {exc}")
                logger.debug(traceback.format_exc())

    def _is_filtered(self, databricks_table_fqn: str) -> bool:
        """Apply the pipeline's filter patterns to a `catalog.schema.table` name."""
        parts = databricks_table_fqn.split(".")
        if len(parts) != 3:
            logger.debug("Skipping malformed table name: %s", databricks_table_fqn)
            return True
        catalog_name, schema_name, table_name = parts
        entity_fqn = f"{self.config.serviceName}.{databricks_table_fqn}"

        if filter_by_database(self.source_config.databaseFilterPattern, catalog_name):
            self._report_filtered(entity_fqn, "Catalog Filtered Out")
            return True
        if filter_by_schema(self.source_config.schemaFilterPattern, schema_name):
            self._report_filtered(entity_fqn, "Schema Filtered Out")
            return True
        if filter_by_table(self.source_config.tableFilterPattern, table_name):
            self._report_filtered(entity_fqn, "Table Filtered Out")
            return True
        return False

    def _report_filtered(self, entity_fqn: str, reason: str) -> None:
        if entity_fqn not in self._filter_reported:
            self._filter_reported.add(entity_fqn)
            self.status.filter(entity_fqn, reason)

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest]]:
        """
        Fetch lineage from system tables for both table-to-table
        and external location lineage.

        The system tables name every table an edge can end at, so those are the only
        ones looked up. Listing every table of every schema of every catalog instead
        costs a paginated request per hundred tables in the service, nearly all of
        them for tables no edge mentions.
        """
        # External locations first: resolving a path-based lineage row to the table
        # declared over that path needs the location map already populated.
        self._cache_external_locations()

        yield from self._stream_native_lineage()

        for databricks_table_fqn in sorted(self.external_location_map):
            if self._is_filtered(databricks_table_fqn):
                continue

            yield from self._process_external_location_lineage(databricks_table_fqn)

    def test_connection(self) -> None:
        if self._connection is not None:
            run_test_connection(self.metadata, self._connection)
        else:
            test_connection_common(self.metadata, self.connection_obj, self.service_connection)
