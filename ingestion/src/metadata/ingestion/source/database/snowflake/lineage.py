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
Snowflake lineage module
"""

import json
import traceback
from datetime import datetime, timedelta
from typing import Any, Iterable, Iterator, List, Optional, Tuple, Union  # noqa: UP035

from cachetools import LRUCache
from sqlalchemy import text

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageEdgeSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.connections.builders import get_connection_options_dict
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake.connection import (
    probe_access_history_available,
)
from metadata.ingestion.source.database.snowflake.models import (
    AccessHistoryRow,
    CopyHistoryRow,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_ACCESS_HISTORY_LINEAGE,
    SNOWFLAKE_COPY_HISTORY_LINEAGE,
    SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES,
    SNOWFLAKE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.snowflake.query_parser import (
    SNOWFLAKE_QUERY_BATCH_SIZE,
    SnowflakeQueryParserSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)
from metadata.utils import fqn
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

USE_ACCESS_HISTORY_OPTION_KEY = "useAccessHistory"

ACCESS_HISTORY_CHUNK_DAYS_OPTION_KEY = "accessHistoryChunkDays"

TABLE_CACHE_MAX_SIZE = 100

QUERY_DEDUP_CACHE_MAX_SIZE = 1000

USER_CACHE_MAX_SIZE = 1000

ACCESS_HISTORY_CHUNK_DAYS = 2

EXTERNAL_STAGE_PREFIXES = ("s3://", "azure://", "gcs://", "https://")

LINEAGE_OBJECT_DOMAINS = {
    "Table",
    "View",
    "Materialized view",
    "Dynamic table",
    "External table",
    "Iceberg table",
}


class SnowflakeLineageSource(
    SnowflakeQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    """
    Snowflake class for Lineage
    """

    sql_stmt = SNOWFLAKE_SQL_STATEMENT

    filters = """
        AND (
            QUERY_TYPE IN ('MERGE', 'UPDATE','CREATE_TABLE_AS_SELECT','COPY','UNLOAD')
            OR (QUERY_TYPE = 'INSERT' and query_text ILIKE '%%insert%%into%%select%%')
            OR (QUERY_TYPE = 'ALTER' and query_text ILIKE '%%alter%%table%%swap%%')
            OR (QUERY_TYPE = 'CREATE_TABLE' and query_text ILIKE '%%clone%%')
            OR (QUERY_TYPE = 'CREATE_VIEW' and query_text ILIKE '%%create%%temporary%%view%%')
        )
    """

    stored_procedure_query = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
        get_engine: bool = True,
    ):
        # Pop the OM-specific flag from connectionOptions BEFORE the parent
        # creates the SQLAlchemy engine — the Snowflake URL builder copies
        # every connectionOptions entry into the URL query string, so the
        # driver would otherwise receive an unknown `useAccessHistory` param.
        self._use_access_history = self._pop_access_history_flag(config)
        self._access_history_chunk_days = self._pop_access_history_chunk_days(config)
        super().__init__(config, metadata, get_engine=get_engine)
        self._table_cache: LRUCache = LRUCache(maxsize=TABLE_CACHE_MAX_SIZE)
        self._seen_query_checksums: LRUCache = LRUCache(
            maxsize=QUERY_DEDUP_CACHE_MAX_SIZE
        )
        self._user_cache: LRUCache = LRUCache(maxsize=USER_CACHE_MAX_SIZE)
        if self._use_access_history and self.engine is not None:
            available = probe_access_history_available(
                self.engine, self.service_connection.accountUsageSchema
            )
            if not available:
                logger.warning(
                    "useAccessHistory was set in connectionOptions but the ACCESS_HISTORY probe failed; "
                    "falling back to legacy QUERY_HISTORY parser path."
                )
                self._use_access_history = False
            else:
                logger.info(
                    "ACCESS_HISTORY-based lineage path enabled via connectionOptions.useAccessHistory."
                )

    @staticmethod
    def _pop_access_history_flag(config: WorkflowSource) -> bool:
        """
        Read and remove the OM-specific `useAccessHistory` key from
        connectionOptions on the workflow config. Called before the parent
        init so the popped key never reaches the Snowflake driver URL.
        """
        service_connection = (
            config.serviceConnection.root.config
        )  # pyright: ignore[reportOptionalMemberAccess]
        options = get_connection_options_dict(service_connection)
        if not options:
            return False
        raw = options.pop(USE_ACCESS_HISTORY_OPTION_KEY, None)
        if raw is None:
            return False
        return str(raw).strip().lower() == "true"

    @staticmethod
    def _pop_access_history_chunk_days(config: WorkflowSource) -> int:
        """
        Read and remove the OM-specific `accessHistoryChunkDays` key from
        connectionOptions, mirroring `_pop_access_history_flag` so the popped
        key never reaches the Snowflake driver URL. Controls the size of the
        date windows the [start, end] lineage span is split into. Falls back to
        ACCESS_HISTORY_CHUNK_DAYS when unset or invalid (non-int / non-positive).
        """
        service_connection = (
            config.serviceConnection.root.config
        )  # pyright: ignore[reportOptionalMemberAccess]
        options = get_connection_options_dict(service_connection)
        if not options:
            return ACCESS_HISTORY_CHUNK_DAYS
        raw = options.pop(ACCESS_HISTORY_CHUNK_DAYS_OPTION_KEY, None)
        if raw is None:
            return ACCESS_HISTORY_CHUNK_DAYS
        try:
            chunk_days = int(str(raw).strip())
        except (ValueError, TypeError):
            logger.warning(
                "Invalid %s=%r in connectionOptions; falling back to %d days.",
                ACCESS_HISTORY_CHUNK_DAYS_OPTION_KEY,
                raw,
                ACCESS_HISTORY_CHUNK_DAYS,
            )
            return ACCESS_HISTORY_CHUNK_DAYS
        if chunk_days <= 0:
            logger.warning(
                "%s must be a positive integer (got %d); falling back to %d days.",
                ACCESS_HISTORY_CHUNK_DAYS_OPTION_KEY,
                chunk_days,
                ACCESS_HISTORY_CHUNK_DAYS,
            )
            return ACCESS_HISTORY_CHUNK_DAYS
        return chunk_days

    def _build_filter_condition_clause(self) -> str:
        """
        Render `sourceConfig.filterCondition` as a trailing `WHERE (...)` on the
        final edge result, so it scopes lineage by the edge's tables rather than
        by QUERY_HISTORY. Unqualified column names resolve against the edge
        columns `UPSTREAM_TABLE` / `DOWNSTREAM_TABLE` (Snowflake `DB.SCHEMA.TABLE`
        FQNs) — e.g. `DOWNSTREAM_TABLE LIKE 'MYDB.%'`,
        `UPSTREAM_TABLE ILIKE 'MYDB.MYSCHEMA.%'`.
        """
        condition = getattr(self.source_config, "filterCondition", None)
        if not condition:
            return ""
        return f"WHERE ({condition})"

    def get_stored_procedure_sql_statement(self) -> str:
        """
        Return the SQL statement to get the stored procedure queries
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = self.stored_procedure_query.format(
            start_date=start,
            account_usage=self.service_connection.accountUsageSchema,
        )

        return query

    def yield_table_query(self) -> Iterator[TableQuery]:
        """
        Given an engine, iterate over the query results to
        yield a TableQuery with query parsing info
        """
        for engine in self.get_engine():
            offset = 0
            total_fetched = 0
            max_results = self.source_config.resultLimit
            while total_fetched < max_results:
                batch_size = min(
                    SNOWFLAKE_QUERY_BATCH_SIZE, max_results - total_fetched
                )
                rows = []
                row_count = 0
                with engine.connect() as conn:
                    rows = conn.execution_options(
                        stream_results=True, max_row_buffer=100
                    ).execute(
                        self.get_sql_statement(
                            start_time=self.start,
                            end_time=self.end,
                            offset=offset,
                            limit=batch_size,
                        )
                    )
                    for row in rows:
                        query_dict = row._asdict()
                        query_dict.update({k.lower(): v for k, v in query_dict.items()})
                        row_count += 1
                        try:
                            yield TableQuery(
                                dialect=self.dialect.value,
                                query=query_dict["query_text"],
                                databaseName=self.get_database_name(query_dict),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(query_dict),
                            )
                        except Exception as exc:
                            logger.debug(traceback.format_exc())
                            logger.warning(
                                "Error processing query_dict %s: %s", query_dict, exc
                            )
                total_fetched += row_count
                if row_count < batch_size:
                    break
                offset += batch_size
                logger.info(
                    "Fetching next page with offset %d (fetched %d/%d) for lineage queries",
                    offset,
                    total_fetched,
                    max_results,
                )

    def yield_query_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:  # noqa: UP007
        """
        Dispatch lineage extraction to either the ACCESS_HISTORY path (gated by
        `useAccessHistory` in connectionOptions) or the legacy QUERY_HISTORY +
        client-side parser path.
        """
        if self._use_access_history:
            logger.info("Processing Query Lineage via ACCESS_HISTORY")
            yield from self._yield_access_history_lineage()  # pyright: ignore[reportReturnType]
            return
        yield from super().yield_query_lineage()

    def _yield_access_history_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:  # noqa: UP007
        """
        Stream one row per directed table edge from the combined ACCESS_HISTORY
        SQL — column-pairs are aggregated into a VARIANT array per edge inside
        Snowflake, so client memory stays O(1) regardless of catalog size. Each
        edge with representative SQL also yields a CreateQueryRequest so the
        query surfaces in OpenMetadata, matching the legacy parser path.
        """
        yield from self._yield_combined_access_history()
        yield from self._yield_copy_history_lineage()

    def _iter_lineage_date_windows(
        self,
    ) -> Iterable[Tuple[datetime, datetime]]:  # noqa: UP006
        """
        Split the configured [start, end] window into
        `accessHistoryChunkDays`-sized chunks (default ACCESS_HISTORY_CHUNK_DAYS).
        A single query over a large window (e.g. queryLogDuration=180) builds a
        FLATTEN-heavy plan that Snowflake cancels on a client/server timeout;
        per-chunk queries keep each scan bounded and let one slow window fail
        without aborting the run.
        """
        window_start = self.start
        while window_start < self.end:
            window_end = min(
                window_start + timedelta(days=self._access_history_chunk_days),
                self.end,
            )
            yield window_start, window_end
            window_start = window_end

    def _yield_combined_access_history(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:  # noqa: UP007
        """
        Stream the combined ACCESS_HISTORY query per date window and emit one
        `AddLineageRequest` per row, plus a `CreateQueryRequest` for each edge's
        representative SQL (deduped by checksum) so the originating query lands
        in OpenMetadata just as the legacy parser path does. Counters accumulate
        across all windows.
        """
        emitted = 0
        emitted_with_sql = 0
        queries_emitted = 0
        skipped = 0
        for window_start, window_end in self._iter_lineage_date_windows():
            for row in self._fetch_access_history_rows(window_start, window_end):
                edge = self._build_access_history_edge(row)
                if edge is None:
                    skipped += 1
                    continue
                emitted += 1
                yield Either(right=edge)  # pyright: ignore[reportCallIssue]
                if row.query_text:
                    emitted_with_sql += 1
                    query_request = self._build_query_request(row)
                    if query_request is not None:
                        queries_emitted += 1
                        yield Either(
                            right=query_request
                        )  # pyright: ignore[reportCallIssue]
        logger.info(
            "ACCESS_HISTORY lineage: emitted %d edges (%d with SQL text), "
            "%d queries created, skipped %d (unresolvable downstream/upstream tables)",
            emitted,
            emitted_with_sql,
            queries_emitted,
            skipped,
        )

    def _build_query_request(
        self, row: AccessHistoryRow
    ) -> Optional[CreateQueryRequest]:  # noqa: UP045
        """
        Build a CreateQueryRequest for an edge's representative SQL so the query
        is registered in OpenMetadata like the legacy parser path does. Deduped
        within the run by SQL checksum via a bounded LRU — one Query entity per
        unique statement, mirroring the sink's checksum dedup. `processedLineage`
        is True because the edge was derived from ACCESS_HISTORY directly, so the
        legacy parser must not re-process it.

        `queryUsedIn` references the edge's downstream and upstream tables so the
        backend creates the MENTIONED_IN relationship that the table "Queries" tab
        reads — without it the Query entity is created but attached to no table and
        never surfaces in the UI. Both tables are already in `_table_cache` from
        building the edge, so resolution here is a cache hit.
        """
        if not row.query_text:
            return None
        checksum = fqn.get_query_checksum(row.query_text)
        if checksum in self._seen_query_checksums:
            return None
        self._seen_query_checksums[checksum] = True
        query_date = (
            Timestamp(
                root=datetime_to_timestamp(row.query_start_time, milliseconds=True)
            )
            if row.query_start_time
            else None
        )
        users, used_by = self._resolve_query_user(row.user_name)
        return CreateQueryRequest(
            query=SqlQuery(row.query_text),
            query_type=row.query_type,
            duration=row.query_duration,
            queryDate=query_date,
            users=users,
            usedBy=used_by,
            queryUsedIn=self._build_query_used_in(row) or None,
            processedLineage=True,
            service=self.config.serviceName,
        )

    def _build_query_used_in(
        self, row: AccessHistoryRow
    ) -> List[EntityReference]:  # noqa: UP006
        """
        Resolve the edge's downstream and upstream tables to EntityReferences for
        the query's `queryUsedIn`, so the query is linked to both tables in OM.
        Resolution hits `_table_cache` (populated while building the edge), so this
        adds no extra API calls.
        """
        references: List[EntityReference] = []  # noqa: UP006
        for snowflake_fqn in (row.downstream_table, row.upstream_table):
            if not snowflake_fqn:
                continue
            entity = self._resolve_snowflake_table(snowflake_fqn)
            if entity is not None:
                references.append(
                    EntityReference(id=entity.id.root, type="table")
                )  # pyright: ignore[reportCallIssue]
        return references

    def _resolve_query_user(
        self, username: Optional[str]  # noqa: UP045
    ) -> Tuple[Optional[List[str]], Optional[List[str]]]:  # noqa: UP006, UP045
        """
        Map the Snowflake `USER_NAME` that ran the query to the CreateQueryRequest
        `(users, usedBy)` pair, mirroring the usage stage's `_get_user_entity`:
        `users` is the matching OpenMetadata user FQN (when one exists) and
        `usedBy` is the raw Snowflake username. Both hits and misses are cached
        in a bounded LRU — the same handful of service accounts run most queries,
        so this stays a hot path.
        """
        if not username:
            return None, None
        if username in self._user_cache:
            return self._user_cache[username]
        try:
            user = self.metadata.get_by_name(entity=User, fqn=username)
        except Exception as exc:
            logger.debug("Failed to resolve user `%s`: %s", username, exc)
            user = None
        resolved = (
            ([user.fullyQualifiedName.root], [username]) if user else (None, [username])
        )
        self._user_cache[username] = resolved
        return resolved

    def _fetch_access_history_rows(
        self, window_start: datetime, window_end: datetime
    ) -> Iterable[AccessHistoryRow]:
        """
        Run the combined ACCESS_HISTORY query for a single [window_start,
        window_end) window and yield parsed rows. Uses `stream_results=True`
        so the snowflake-sqlalchemy cursor streams rather than buffering.
        A failure on one window is logged and swallowed so the remaining
        windows still run; a single malformed row is skipped so the rest of
        the window still yields.
        """
        sql_statement = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
            account_usage=self.service_connection.accountUsageSchema,
            start_time=window_start,
            end_time=window_end,
            filter_condition=self._build_filter_condition_clause(),
        )
        try:
            for engine in self.get_engine():
                if engine is None:
                    continue
                with engine.connect() as conn:
                    logger.debug(
                        "Executing ACCESS_HISTORY lineage query for %s - %s",
                        window_start,
                        window_end,
                    )
                    rows = conn.execution_options(
                        stream_results=True, max_row_buffer=1000
                    ).execute(text(sql_statement))
                    for raw_row in rows:
                        parsed = self._parse_access_history_row(raw_row)
                        if parsed is not None:
                            yield parsed
        except Exception as exc:
            logger.warning(
                "Failed to extract lineage from ACCESS_HISTORY for window %s - %s: %s",
                window_start,
                window_end,
                exc,
            )
            logger.debug(traceback.format_exc())

    def _parse_access_history_row(
        self, raw_row: Any
    ) -> Optional[AccessHistoryRow]:  # noqa: UP045
        """
        Parse one cursor row into an `AccessHistoryRow`. A single malformed row
        is logged and skipped (returns None) so it doesn't abort the rest of
        the window's results.
        """
        try:
            return AccessHistoryRow(**self._row_to_lower_dict(raw_row))
        except Exception as exc:
            logger.warning("Skipping malformed ACCESS_HISTORY row: %s", exc)
            logger.debug(traceback.format_exc())
            return None

    def _build_access_history_edge(
        self, row: AccessHistoryRow
    ) -> Optional[AddLineageRequest]:  # noqa: UP045
        """
        Resolve both sides of a table edge to OM Table entities and build the
        AddLineageRequest, attaching column lineage parsed from the row's
        VARIANT `COLUMN_PAIRS` array (already aggregated server-side).
        """
        if not (row.downstream_table and row.upstream_table):
            return None

        downstream_entity = self._resolve_snowflake_table(row.downstream_table)
        upstream_entity = self._resolve_snowflake_table(row.upstream_table)
        if downstream_entity is None or upstream_entity is None:
            logger.debug(
                "Skipping ACCESS_HISTORY edge: table not found in OpenMetadata "
                "(upstream=`%s` found=%s, downstream=`%s` found=%s)",
                row.upstream_table,
                upstream_entity is not None,
                row.downstream_table,
                downstream_entity is not None,
            )
            return None

        column_pairs = self._parse_column_pairs(row.column_pairs)
        columns_lineage = self._build_columns_lineage(
            downstream_entity, upstream_entity, column_pairs
        )

        lineage_details = LineageDetails(  # pyright: ignore[reportCallIssue]
            source=LineageEdgeSource.QueryLineage,
            sqlQuery=row.query_text or None,
            columnsLineage=columns_lineage or None,
        )

        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=upstream_entity.id.root, type="table"
                ),  # pyright: ignore[reportCallIssue]
                toEntity=EntityReference(
                    id=downstream_entity.id.root, type="table"
                ),  # pyright: ignore[reportCallIssue]
                lineageDetails=lineage_details,
            )
        )

    @staticmethod
    def _parse_column_pairs(raw: object) -> List[Tuple[str, str]]:  # noqa: UP006
        """
        Decode the `COLUMN_PAIRS` VARIANT returned by the combined SQL into
        a list of (downstream_column, upstream_column) tuples. The snowflake
        driver can hand back either a parsed list or a JSON string depending
        on cursor configuration, so handle both.
        """
        if not raw:
            return []
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                return []
        if not isinstance(raw, list):
            return []
        pairs: List[Tuple[str, str]] = []  # noqa: UP006
        for item in raw:
            if not isinstance(item, dict):
                continue
            d_col = item.get("d") or item.get("D")
            u_col = item.get("u") or item.get("U")
            if d_col and u_col:
                pairs.append((d_col, u_col))
        return pairs

    @staticmethod
    def _build_columns_lineage(
        downstream_entity: Table,
        upstream_entity: Table,
        column_pairs: List[Tuple[str, str]],  # noqa: UP006
    ) -> List[ColumnLineage]:  # noqa: UP006
        """
        Convert raw (downstream_col, upstream_col) pairs into ColumnLineage objects
        with fully qualified column names. Drops pairs where either column does
        not exist on its parent table entity.
        """
        result: List[ColumnLineage] = []  # noqa: UP006
        for d_col, u_col in column_pairs:
            d_fqn = get_column_fqn(downstream_entity, d_col)
            u_fqn = get_column_fqn(upstream_entity, u_col)
            if d_fqn and u_fqn:
                result.append(
                    ColumnLineage(fromColumns=[u_fqn], toColumn=d_fqn)
                )  # pyright: ignore[reportCallIssue]
        return result

    def _yield_copy_history_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Read ACCOUNT_USAGE.COPY_HISTORY for stage→table lineage. Resolve the
        downstream Table and the upstream Container (by stage location URL).
        Skip internal Snowflake stages silently (they don't map to OM Containers).
        """
        sql_statement = SNOWFLAKE_COPY_HISTORY_LINEAGE.format(
            account_usage=self.service_connection.accountUsageSchema,
            start_time=self.start,
            end_time=self.end,
        )
        emitted = 0
        skipped_internal = 0
        skipped_unresolved = 0
        try:
            for engine in self.get_engine():
                if engine is None:
                    continue
                with engine.connect() as conn:
                    logger.debug(
                        "Executing COPY_HISTORY lineage query: %s", sql_statement
                    )
                    rows = conn.execute(text(sql_statement))
                    for raw_row in rows:
                        row = CopyHistoryRow(**self._row_to_lower_dict(raw_row))
                        if not self._is_external_stage(row.stage_location or ""):
                            skipped_internal += 1
                            continue
                        edge = self._build_copy_edge(row)
                        if edge is None:
                            skipped_unresolved += 1
                            continue
                        emitted += 1
                        yield Either(right=edge)  # pyright: ignore[reportCallIssue]
        except Exception as exc:
            logger.warning("Failed to extract COPY_HISTORY lineage: %s", exc)
            logger.debug(traceback.format_exc())
        logger.info(
            "COPY_HISTORY lineage: emitted %d edges, skipped %d internal stages, skipped %d unresolved external stages",
            emitted,
            skipped_internal,
            skipped_unresolved,
        )

    def _build_copy_edge(
        self, row: CopyHistoryRow
    ) -> Optional[AddLineageRequest]:  # noqa: UP045
        """
        Resolve the downstream table and upstream container, then build the
        Container → Table lineage request. Returns None if either side is
        unresolvable in OM (e.g., storage service not ingested).
        """
        if not (
            row.downstream_database
            and row.downstream_schema
            and row.downstream_table
            and row.stage_location
        ):
            return None

        downstream_fqn = fqn._build(
            self.config.serviceName,
            row.downstream_database,
            row.downstream_schema,
            row.downstream_table,
        )
        downstream_entity = self._get_table_by_fqn(downstream_fqn)
        if downstream_entity is None:
            return None

        container_entity = self._resolve_container_by_path(row.stage_location)
        if container_entity is None:
            logger.info(
                "COPY edge unresolved: no Container ingested for stage `%s` (downstream table `%s` skipped)",
                row.stage_location,
                downstream_fqn,
            )
            return None

        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=container_entity.id.root, type="container"
                ),  # pyright: ignore[reportCallIssue]
                toEntity=EntityReference(
                    id=downstream_entity.id.root, type="table"
                ),  # pyright: ignore[reportCallIssue]
                lineageDetails=LineageDetails(
                    source=LineageEdgeSource.QueryLineage
                ),  # pyright: ignore[reportCallIssue]
            )
        )

    def _resolve_snowflake_table(
        self, snowflake_fqn: str
    ) -> Optional[Table]:  # noqa: UP045
        """
        Parse a Snowflake-style `DB.SCHEMA.TABLE` FQN into OM-style and resolve
        to a Table entity. Caches both hits and misses for the run.
        """
        parts = self._split_snowflake_fqn(snowflake_fqn)
        if parts is None:
            return None
        db, schema, table = parts
        om_fqn = fqn._build(self.config.serviceName, db, schema, table)
        return self._get_table_by_fqn(om_fqn)

    def _get_table_by_fqn(self, om_fqn: str) -> Optional[Table]:  # noqa: UP045
        if om_fqn in self._table_cache:
            return self._table_cache[om_fqn]
        try:
            entity = self.metadata.get_by_name(entity=Table, fqn=om_fqn)
        except Exception as exc:
            logger.debug("Failed to resolve Table `%s`: %s", om_fqn, exc)
            entity = None
        self._table_cache[om_fqn] = entity
        return entity

    def _resolve_container_by_path(
        self, stage_location: str
    ) -> Optional[Container]:  # noqa: UP045
        try:
            results = (
                self.metadata.es_search_container_by_path(full_path=stage_location)
                or []
            )
            return results[0] if results else None
        except Exception as exc:
            logger.debug(
                "Failed to resolve Container for path `%s`: %s", stage_location, exc
            )
            return None

    @staticmethod
    def _split_snowflake_fqn(
        snowflake_fqn: str,
    ) -> Optional[Tuple[str, str, str]]:  # noqa: UP006, UP045
        """
        Split a Snowflake `DB.SCHEMA.TABLE` FQN into its three parts.
        Handles quoted identifiers (`"My DB"."My.Schema"."Table"`) by
        splitting on unquoted dots and stripping surrounding quotes per part.
        Snowflake escapes embedded `"` inside a quoted identifier as `""`;
        we unescape that to a single `"`.
        Returns None for malformed inputs and logs at DEBUG.
        """
        if not snowflake_fqn:
            return None
        parts: list = []
        current: list = []
        inside_quotes = False
        for ch in snowflake_fqn:
            if ch == '"':
                inside_quotes = not inside_quotes
                current.append(ch)
            elif ch == "." and not inside_quotes:
                parts.append("".join(current))
                current = []
            else:
                current.append(ch)
        parts.append("".join(current))
        if len(parts) != 3:
            logger.debug("Skipping FQN with unexpected part count: %s", snowflake_fqn)
            return None
        normalized = [
            p[1:-1].replace('""', '"') if p.startswith('"') and p.endswith('"') else p
            for p in parts
        ]
        if not all(normalized):
            logger.debug("Skipping FQN with empty part: %s", snowflake_fqn)
            return None
        return normalized[0], normalized[1], normalized[2]

    @staticmethod
    def _is_external_stage(stage_location: str) -> bool:
        """
        External stage URLs start with a cloud storage scheme. Internal Snowflake
        stages (`@~/`, `@%table/`, `@db.schema.stage/`) don't map to OM Containers.
        """
        if not stage_location:
            return False
        return stage_location.lower().startswith(EXTERNAL_STAGE_PREFIXES)

    @staticmethod
    def _row_to_lower_dict(row: Any) -> dict:
        """
        Snowflake returns uppercase column names; normalize to a lower-cased
        dict so the Pydantic row models can resolve fields uniformly. Accepts
        anything row-like: a SQLAlchemy `Row` (has `_asdict`) or a plain dict.
        """
        raw = row._asdict() if hasattr(row, "_asdict") else dict(row)
        return {k.lower(): v for k, v in raw.items()}
