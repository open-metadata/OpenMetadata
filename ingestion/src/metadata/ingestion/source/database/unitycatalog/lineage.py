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
from datetime import datetime, timedelta
from typing import Any, Iterable, List, Optional, Tuple  # noqa: UP035

from cachetools import LRUCache
from sqlalchemy import text

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import ContainerDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
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
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_connection,
    get_sqlalchemy_connection,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_EXTERNAL_TABLES,
    UNITY_CATALOG_LINEAGE,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import get_start_and_end, retry_with_docker_host
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TABLE_RESOLUTION_CACHE_SIZE = 1000

DEFAULT_LINEAGE_CHUNK_DAYS = 7


class UnitycatalogLineageSource(Source):
    """
    Lineage Unity Catalog Source.

    Lineage edges are streamed one day-window at a time from
    `system.access.table_lineage` / `column_lineage` (the Databricks analogue
    of Snowflake's ACCESS_HISTORY). Column pairs are aggregated server-side per
    edge, and each endpoint is resolved to an OpenMetadata table through a
    bounded LRU cache, so client memory stays O(window) regardless of how large
    the metastore lineage graph is.
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
        self.source_config = self.config.sourceConfig.config
        self.connection_obj = get_connection(self.service_connection)
        self.engine = get_sqlalchemy_connection(self.service_connection)
        self._table_cache: LRUCache = LRUCache(maxsize=TABLE_RESOLUTION_CACHE_SIZE)
        self._chunk_days = self._resolve_chunk_days()
        self.test_connection()

    def _resolve_chunk_days(self) -> int:
        """
        Days of lineage scanned per system-table query, read from the
        `lineageQueryChunkSize` connection field. Clamp to >= 1 so the
        date-window iterator always makes forward progress.
        """
        configured = getattr(self.service_connection, "lineageQueryChunkSize", None)
        if configured is None:
            return DEFAULT_LINEAGE_CHUNK_DAYS
        return max(1, int(configured))

    def close(self):
        """
        By default, there is nothing to close
        """

    def prepare(self):
        """
        By default, there's nothing to prepare
        """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: UnityCatalogConnection = config.serviceConnection.root.config
        if not isinstance(connection, UnityCatalogConnection):
            raise InvalidSourceException(f"Expected UnityCatalogConnection, but got {connection}")
        return cls(config, metadata)

    def _iter_date_windows(self) -> Iterable[Tuple[datetime, datetime]]:  # noqa: UP006
        """
        Split the configured `queryLogDuration` lookback into
        `lineageQueryChunkSize` day windows. Streaming one window at a time keeps
        each system-table scan and its result set bounded instead of pulling the
        whole lookback at once.
        """
        start, end = get_start_and_end(self.source_config.queryLogDuration or 1)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        window_start = start
        while window_start < end:
            window_end = min(window_start + timedelta(days=self._chunk_days), end)
            yield window_start, window_end
            window_start = window_end

    def _resolve_table(self, databricks_table_fqn: str) -> Optional[Table]:  # noqa: UP045
        """
        Resolve a `catalog.schema.table` Unity Catalog name to an OpenMetadata
        Table entity. Both hits and misses are cached in a bounded LRU so a busy
        upstream table referenced by many edges is fetched once, and repeated
        unresolvable lookups stay cheap.
        """
        cache_key = databricks_table_fqn.lower()
        if cache_key in self._table_cache:
            return self._table_cache[cache_key]
        entity = self._fetch_table_entity(cache_key)
        self._table_cache[cache_key] = entity
        return entity

    def _fetch_table_entity(self, databricks_table_fqn: str) -> Optional[Table]:  # noqa: UP045
        entity = None
        parts = databricks_table_fqn.split(".")
        if len(parts) != 3:
            logger.debug(f"Skipping malformed table name: {databricks_table_fqn}")
        else:
            catalog_name, schema_name, table_name = parts
            table_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=self.config.serviceName,
                database_name=catalog_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)  # pyright: ignore[reportArgumentType]
        return entity

    def _is_filtered_table(self, databricks_table_fqn: str) -> bool:
        is_filtered = False
        parts = databricks_table_fqn.split(".")
        if len(parts) == 3:
            catalog_name, schema_name, table_name = parts
            is_filtered = (
                filter_by_database(
                    self.source_config.databaseFilterPattern,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
                    catalog_name,
                )
                or filter_by_schema(
                    self.source_config.schemaFilterPattern,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
                    schema_name,
                )
                or filter_by_table(
                    self.source_config.tableFilterPattern,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
                    table_name,
                )
            )
        return is_filtered

    @staticmethod
    def _parse_column_pairs(raw: object) -> List[Tuple[str, str]]:  # noqa: UP006
        """
        Decode the server-aggregated `column_pairs` JSON into a list of
        (source_column, target_column) tuples. The driver can hand back either a
        JSON string or an already-parsed list, so handle both.
        """
        pairs: List[Tuple[str, str]] = []  # noqa: UP006
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                raw = None
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    source_col = item.get("u") or item.get("U")
                    target_col = item.get("d") or item.get("D")
                    if source_col and target_col:
                        pairs.append((source_col, target_col))
        return pairs

    def _build_column_lineage(
        self, from_table: Table, to_table: Table, raw_column_pairs: object
    ) -> List[ColumnLineage]:  # noqa: UP006
        col_lineage = []
        for source_col, target_col in self._parse_column_pairs(raw_column_pairs):
            from_col_fqn = get_column_fqn(from_table, source_col)
            to_col_fqn = get_column_fqn(to_table, target_col)
            if from_col_fqn and to_col_fqn and from_col_fqn != to_col_fqn:
                col_lineage.append(ColumnLineage(fromColumns=[from_col_fqn], toColumn=to_col_fqn))  # pyright: ignore[reportCallIssue]
        return col_lineage

    def _build_table_edge(self, row: Any) -> Optional[AddLineageRequest]:  # noqa: UP045
        """
        Resolve both endpoints of a streamed lineage row to OpenMetadata tables
        and build the lineage request with column lineage attached. Returns None
        when either side is filtered out or not present in OpenMetadata.
        """
        edge = None
        source_fqn = row.source_table_full_name
        target_fqn = row.target_table_full_name
        if not (self._is_filtered_table(source_fqn) or self._is_filtered_table(target_fqn)):
            from_entity = self._resolve_table(source_fqn)
            to_entity = self._resolve_table(target_fqn)
            if from_entity and to_entity:
                column_lineage = self._build_column_lineage(from_entity, to_entity, row.column_pairs)
                edge = AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=from_entity.id, type="table"),  # pyright: ignore[reportCallIssue]
                        toEntity=EntityReference(id=to_entity.id, type="table"),  # pyright: ignore[reportCallIssue]
                        lineageDetails=LineageDetails(  # pyright: ignore[reportCallIssue]
                            columnsLineage=column_lineage or None,
                            source=LineageSource.QueryLineage,
                        ),
                    )
                )
            else:
                logger.debug(
                    f"Skipping edge, table not found in OpenMetadata: "
                    f"{source_fqn} (found={from_entity is not None}) -> "
                    f"{target_fqn} (found={to_entity is not None})"
                )
        return edge

    def _fetch_lineage_rows(self, window_start: datetime, window_end: datetime) -> Iterable:
        """
        Run the combined lineage query for one [start, end) window, streaming
        rows so the driver does not buffer the whole result set. A failure on one
        window is logged and swallowed so the remaining windows still run.
        """
        sql_statement = UNITY_CATALOG_LINEAGE.format(
            start_time=window_start,
            end_time=window_end,
        )
        try:
            with self.engine.connect() as conn:
                rows = conn.execution_options(stream_results=True, max_row_buffer=1000).execute(text(sql_statement))
                yield from rows
        except Exception as exc:
            logger.warning(f"Failed to fetch lineage for window {window_start} - {window_end}: {exc}")
            logger.debug(traceback.format_exc())

    def _yield_table_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Stream table/column lineage one day-window at a time, emitting one
        request per resolved edge. Per-row failures surface as Either(left)
        instead of being swallowed.
        """
        emitted = 0
        skipped = 0
        failed = 0
        for window_start, window_end in self._iter_date_windows():
            for row in self._fetch_lineage_rows(window_start, window_end):
                try:
                    edge = self._build_table_edge(row)
                except Exception as exc:
                    failed += 1
                    yield Either(  # pyright: ignore[reportCallIssue]
                        left=StackTraceError(
                            name=row.target_table_full_name,
                            error=(
                                f"Error processing lineage {row.source_table_full_name} -> "
                                f"{row.target_table_full_name}: {exc}"
                            ),
                            stackTrace=traceback.format_exc(),
                        )
                    )
                    continue
                if edge is None:
                    skipped += 1
                    continue
                emitted += 1
                yield Either(right=edge)  # pyright: ignore[reportCallIssue]
        logger.info(
            f"Table lineage: emitted {emitted} edges, "
            f"skipped {skipped} (filtered or unresolved tables), failed {failed} (row errors)"
        )

    def _get_data_model_column_fqn(self, data_model_entity: ContainerDataModel, column: str) -> Optional[str]:  # noqa: UP045
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
    ) -> Optional[LineageDetails]:  # noqa: UP045
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
            logger.warning(
                f"Error computing container column lineage for {table_entity.fullyQualifiedName.root}: {exc}"  # pyright: ignore[reportOptionalMemberAccess]
            )
            logger.debug(traceback.format_exc())
            return None

    def _process_external_location_lineage(
        self,
        table: Table,
        storage_path: Optional[str],  # noqa: UP045
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Create container lineage for an external table from its storage path,
        if a matching container has been ingested.
        """
        if not storage_path:
            return

        try:
            storage_location = storage_path.rstrip("/")
            location_entity = self.metadata.es_search_container_by_path(full_path=storage_location, fields="dataModel")

            if location_entity and location_entity[0]:
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
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=table.fullyQualifiedName.root,  # pyright: ignore[reportOptionalMemberAccess]
                    error=f"Error processing external location lineage for {storage_path}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_external_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Stream external tables and create container lineage for each, resolving
        the table through the shared bounded LRU. External-table storage paths
        are a current snapshot, not an event stream, so this is a single scan
        rather than a windowed one. Catalogs excluded by the database filter are
        dropped per row via `_is_filtered_table`.
        """
        try:
            with self.engine.connect() as conn:
                rows = conn.execution_options(stream_results=True, max_row_buffer=1000).execute(
                    text(UNITY_CATALOG_EXTERNAL_TABLES)
                )
                for row in rows:
                    databricks_table_fqn = f"{row.table_catalog}.{row.table_schema}.{row.table_name}".lower()
                    if self._is_filtered_table(databricks_table_fqn):
                        continue
                    table_entity = self._resolve_table(databricks_table_fqn)
                    if table_entity:
                        yield from self._process_external_location_lineage(table_entity, row.storage_path)
        except Exception as exc:
            logger.warning(f"Failed to fetch external table locations: {exc}")
            logger.debug(traceback.format_exc())

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest]]:
        """
        Stream table/column and external-location lineage across the whole
        metastore. The system-table scans are no longer scoped per catalog;
        catalogs excluded by `databaseFilterPattern` are dropped per edge during
        resolution, and resolved edges share a single bounded table-resolution
        cache across the whole run.
        """
        yield from self._yield_table_lineage()
        yield from self._yield_external_lineage()

    def test_connection(self) -> None:
        test_connection_common(self.metadata, self.connection_obj, self.service_connection)
