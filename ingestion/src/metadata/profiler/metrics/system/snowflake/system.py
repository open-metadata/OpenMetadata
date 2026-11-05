"""Snowflake system metrics source"""

import functools
import hashlib
import re
import sys
import threading
import traceback
from collections import OrderedDict, defaultdict
from collections.abc import Callable, Iterable
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime
from typing import Generic, NamedTuple, TypeVar

import sqlalchemy.orm
from pydantic import TypeAdapter
from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import (
    DmlOperationType,
    SystemProfile,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeDynamicTableRefreshEntry,
    SnowflakeQueryLogEntry,
    SnowflakeQueryResult,
)
from metadata.ingestion.source.database.snowflake.settings import snowflake_settings
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    TABLE_BATCH_WINDOW,
    SystemMetricsComputer,
    TableBatch,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils import fqn
from metadata.utils.collections import CaseInsensitiveString
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache
from metadata.utils.profiler_utils import get_identifiers_from_string
from metadata.utils.time_utils import datetime_to_timestamp

PUBLIC_SCHEMA = "PUBLIC"
SHOW_TABLES_MATCH_LIMIT = 100
logger = profiler_logger()
RESULT_SCAN = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """
QUERY_PATTERN = r"(?:(INSERT\s*INTO\s*|INSERT\s*OVERWRITE\s*INTO\s*|UPDATE\s*|MERGE\s*INTO\s*|DELETE\s*FROM\s*))([\w._\"\'(),]+)(?=\s|;|$)"  # pylint: disable=line-too-long
IDENTIFIER_PATTERN = r"(IDENTIFIER\(\')([\w._\"]+)(\'\))"


def sha256_hash(text: str) -> str:
    """Return the SHA256 hash of the text"""

    return hashlib.sha256(text.encode()).hexdigest()


_cache = LRUCache(LRU_CACHE_SIZE)


def _normalize_dml_sql(query: str) -> str:
    """Normalize a SQL query before DML pattern matching.

    Four-pass process:
    1. Replace /* ... */ block comments with a single space so they act as a
       token separator but do not expose their body to the regex.
    2. Strip -- single-line comments (remove to end of line, leave the newline).
    3. Strip leading/trailing whitespace so re.match() can find the DML keyword
       at position 0.
    4. Collapse whitespace after a dot so qualified names split by a block
       comment are rejoined.

    This prevents comment bodies (e.g. commented-out SQL snippets) from being
    mistaken for actual DML operations.

    Note: the comment-stripping regexes operate on the raw text and will
    corrupt string literals that happen to contain \"--\" or \"/*\" sequences
    (e.g. ``INSERT INTO t SELECT 'a--b'``). This is acceptable for DML-target
    extraction because the corruption would only affect parts of the query
    after the table identifier, which the caller does not use.  Do not reuse
    this function for any purpose that requires preserving string literal
    contents.
    """
    query = re.sub(r"/\*.*?\*/", " ", query, flags=re.DOTALL)
    query = re.sub(r"--[^\n]*", "", query)
    query = query.strip()
    # Clean up whitespace inserted by block-comment removal inside qualified names,
    # e.g. "my_schema./*c*/my_table" → "my_schema. my_table" → "my_schema.my_table"
    return re.sub(r"\.\s+", ".", query)


def _parse_query(query: str | None) -> str | None:
    """Parse snowflake queries to extract the identifiers.

    The query is first normalized (block comments, single-line comments, and
    leading whitespace removed) so that re.match() can reliably find the DML
    keyword at position 0 without being confused by commented-out SQL in the
    query body.

    Returns ``None`` if *query* is ``None`` or empty, or if the query is not a
    recognized DML statement.
    """
    if not query:
        return None
    return _parse_cached(_normalize_dml_sql(query))


@_cache.wrap(key_func=sha256_hash)
def _parse_cached(normalized: str) -> str | None:
    match = re.match(QUERY_PATTERN, normalized, re.IGNORECASE)
    try:
        # This will match results like `DATABASE.SCHEMA.TABLE1` or IDENTIFIER('TABLE1')
        # If we have `IDENTIFIER` type of queries coming from Stored Procedures, we'll need to further clean it up.
        identifier = match.group(2)

        match_internal_identifier = re.match(IDENTIFIER_PATTERN, identifier, re.IGNORECASE)
        internal_identifier = match_internal_identifier.group(2) if match_internal_identifier else None
        if internal_identifier:
            return internal_identifier

        # Anchored at the end so a quoted identifier containing parens ("my(table)")
        # survives; the closing paren is optional as QUERY_PATTERN may stop mid-list.
        return re.sub(r"\([^()]*\)?$", "", identifier)
    except (IndexError, AttributeError):
        logger.debug("Could not find identifier in query. Skipping row.")
        return None


def _snowflake_identifier(name: str) -> str:
    """Quote a Snowflake identifier: an embedded double quote is doubled."""
    return '"' + name.replace('"', '""') + '"'


def _snowflake_literal(value: str) -> str:
    """Quote a Snowflake string literal: a backslash is an escape, so it is
    doubled before the single quote is."""
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


class SnowflakeTableResovler:
    """A class the resolves snowflake tables by mimicking snowflake's default resolution logic:
    https://docs.snowflake.com/en/sql-reference/name-resolution

    This default specification searches in the following order:
    - The explicitly provided schema
    - The current schema
    - The public schema

    This can be altered by changing the SEARCH_PATH session parameter. If the users change
    this paramter, this resolver will might return wrong values.

    There is no way to extract the SEARCH_PATH from the query after it has been executed. Hence, we can
    only rely on the default behavior and maybe allow the users to configure the search path
    at the connection level (TODO).
    """

    def __init__(self, session: sqlalchemy.orm.Session):
        self._cache = LRUCache[bool](LRU_CACHE_SIZE)
        self.session = session

    def show_tables(self, db, schema, table):
        # SHOW ... LIKE treats _ and % as wildcards and has no ESCAPE clause, so the
        # match is narrowed server-side and the name column is compared here instead.
        # The names are parsed out of the query history, so they are untrusted.
        rows = self.session.execute(
            text(
                f"SHOW TABLES LIKE {_snowflake_literal(table)} "
                f"IN SCHEMA {_snowflake_identifier(db)}.{_snowflake_identifier(schema)} "
                f"LIMIT {SHOW_TABLES_MATCH_LIMIT}"
            )
        ).fetchall()
        target = CaseInsensitiveString(table)
        return next((row for row in rows if target == row[1]), None)

    def table_exists(self, db, schema, table):
        """Return True if the table exists in Snowflake. Uses cache to store the results.

        Args:
            db (str): Database name
            schema (str): Schema name
            table (str): Table name

        Returns:
            bool: True if the table exists in Snowflake
        """
        key = f"{db}.{schema}.{table}"
        if key in self._cache:
            return self._cache.get(key)
        exists = self.show_tables(db, schema, table) is not None
        self._cache.put(key, exists)
        return exists

    def resolve_implicit_fqn(
        self,
        context_database: str,
        context_schema: str | None,
        table_name: str,
    ) -> tuple[str, str, str]:
        """Resolve the fully qualified name of the table from snowflake based on the following logic:
        1. If the schema is provided:
            a. search for the table in the schema
            b. if not found, go to (2)
        2. Search for the table in the public schema.

        Args:
            context_database (str): Database name
            context_schema (Optional[str]): Schema name. If not provided, we'll search in the public schema.
            table_name (str): Table name
        Returns:
            tuple: Tuple of database, schema and table names
        Raises:
            RuntimeError: If the table is not found in the metadata or if there are duplicate results
            (there shouldn't be)

        """
        search_paths = []
        if context_schema and self.table_exists(context_database, context_schema, table_name):
            search_paths += ".".join([context_database, context_schema, table_name])
            return context_database, context_schema, table_name
        if context_schema != PUBLIC_SCHEMA and self.table_exists(context_database, PUBLIC_SCHEMA, table_name):
            search_paths += ".".join([context_database, PUBLIC_SCHEMA, table_name])
            return context_database, PUBLIC_SCHEMA, table_name
        raise RuntimeError(
            "Could not find the table {search_paths}.".format(  # pylint: disable=consider-using-f-string
                search_paths=" OR ".join(map(lambda x: f"[{x}]", search_paths))  # noqa: C417
            )
        )

    def resolve_snowflake_fqn(
        self,
        context_database: str,
        context_schema: str | None,
        identifier: str,
    ) -> tuple[str | None, str | None, str | None]:
        """Get query identifiers from the query text. If the schema is not provided in the query, we'll look for
        the table under "PUBLIC" in Snowflake.
        Database can be retrieved from the query or the query context.
        If the schema doesnt exist in the query but does in the context, we need to check with Snowflake if table
        exists in (1) the context schema or ib (2) the public schema in order to imitate the behavior of the query
        engine. There are edge cases where the table was deleted (and hence not found in the metadata). In such cases,
        the function will raise an error. It is advised to set the profier window such that there will be minimal
        drift between the query execution and the profiler run.

        Args:
            context_database (str): Database name from the query context
            context_schema (Optional[str]): Schema name from the query context
            identifier (str): Identifier string extracted from a query (can be
             'db.schema.table', 'schema.table' or just 'table')
        Returns:
            Tuple[Optional[str], Optional[str], Optional[str]]: Tuple of database, schema and table names
        Raises:
            RuntimeError: If the table name is not found in the query or if fqn resolution fails
        """
        (
            database_identifier,
            schema_identifier,
            table_name,
        ) = get_identifiers_from_string(identifier)
        if not table_name:
            raise RuntimeError("Could not extract the table name.")
        if not context_database and not database_identifier:
            logger.debug(f"Could not resolve database name. {identifier=}, {context_database=}")
            raise RuntimeError("Could not resolve database name.")
        if schema_identifier is not None:
            return (
                database_identifier or context_database,
                schema_identifier,
                table_name,
            )
        logger.debug(
            "Missing schema info from the query. We'll look for it in Snowflake for [%s] or [%s]",
            (
                ".".join(
                    [
                        database_identifier or context_database,
                        context_schema,
                        table_name,
                    ]
                )
                if context_schema
                else None
            ),
            ".".join([database_identifier or context_database, PUBLIC_SCHEMA, table_name]),
        )
        # If the schema is not explicitly provided in the query, we'll need to resolve it from OpenMetadata
        # by cascading the search from the context to the public schema.
        result = self.resolve_implicit_fqn(
            context_database=context_database,
            context_schema=context_schema,
            table_name=table_name,
        )
        logger.debug("Resolved table [%s]", ".".join(result))
        return result


def get_snowflake_system_queries(
    query_log_entry: SnowflakeQueryLogEntry,
    resolver: SnowflakeTableResovler,
) -> SnowflakeQueryResult | None:
    """
    Run a regex lookup on the query to identify which operation ran against the table.

    If the query does not have the complete set of `database.schema.table` when it runs,
    we'll use ES to pick up the table, if we find it.

    Args:
        query_log_entry (dict): row from the snowflake system queries table
        resolver (SnowflakeTableResolver): resolver to get the table identifiers
    Returns:
        QueryResult: namedtuple with the query result
    """

    try:
        logger.debug(f"Parsing snowflake query [{query_log_entry.query_id}]")
        identifier = _parse_query(query_log_entry.query_text)
        if not identifier:
            raise RuntimeError("Could not identify the table from the query.")  # noqa: TRY301

        database_name, schema_name, table_name = resolver.resolve_snowflake_fqn(
            identifier=identifier,
            context_database=query_log_entry.database_name,
            context_schema=query_log_entry.schema_name,
        )

        if not all([database_name, schema_name, table_name]):
            raise RuntimeError(f"Could not extract the identifiers from the query [{query_log_entry.query_id}].")  # noqa: TRY301

        return SnowflakeQueryResult(
            query_id=query_log_entry.query_id,
            database_name=database_name.lower(),
            schema_name=schema_name.lower(),
            table_name=table_name.lower(),
            query_text=query_log_entry.query_text,
            query_type=query_log_entry.query_type,
            start_time=query_log_entry.start_time,
            rows_inserted=query_log_entry.rows_inserted,
            rows_updated=query_log_entry.rows_updated,
            rows_deleted=query_log_entry.rows_deleted,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"""Error while processing query with id [{query_log_entry.query_id}]: {exc}\n
            To investigate the query run:
            SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY WHERE query_id = '{query_log_entry.query_id}'
            """
        )
    return None


TableKey = tuple[str, str, str]


class DmlRecord(NamedTuple):
    """Compact history retained after resolving a DML target and dropping QUERY_TEXT."""

    database_name: str
    schema_name: str
    table_name: str
    query_type: str
    start_time: datetime
    rows_inserted: int | None
    rows_updated: int | None
    rows_deleted: int | None


T = TypeVar("T", bound=DmlRecord | SnowflakeDynamicTableRefreshEntry)
MemoryReservation = Callable[[int], None]
HistoryBuilder = Callable[[frozenset[TableKey], MemoryReservation | None], tuple[dict[TableKey, list[T]], int]]


class HistoryBudgetExceededError(Exception):
    """The shared history cache cannot retain another record within its budget."""


@dataclass
class HistoryAllocation:
    discard: Callable[[], None]
    size_bytes: int = 0


class HistoryMemoryBudget:
    """Account for both retained history views and the batch currently being built.

    Builders run under the same lock so their reservations cannot race. Only older
    batches may be evicted; preserving the current batch's other view avoids repeated
    batch scans when the two views cannot fit together.
    """

    def __init__(self, max_bytes: int):
        self.max_bytes = max_bytes
        self.used_bytes = 0
        self.lock = threading.RLock()
        self._allocations: OrderedDict[tuple[str, int], HistoryAllocation] = OrderedDict()

    def begin(self, key: tuple[str, int], discard: Callable[[], None]) -> None:
        self._allocations[key] = HistoryAllocation(discard=discard)

    def touch(self, key: tuple[str, int]) -> None:
        if key in self._allocations:
            self._allocations.move_to_end(key)

    def reserve(self, key: tuple[str, int], size_bytes: int) -> None:
        while self.used_bytes + size_bytes > self.max_bytes:
            oldest = next((candidate for candidate in self._allocations if candidate[1] < key[1]), None)
            if oldest is None:
                raise HistoryBudgetExceededError
            self.discard(oldest)
        self._allocations[key].size_bytes += size_bytes
        self.used_bytes += size_bytes

    def discard(self, key: tuple[str, int]) -> None:
        allocation = self._allocations.pop(key, None)
        if allocation is not None:
            self.used_bytes -= allocation.size_bytes
            allocation.discard()


HISTORY_MEMORY_BUDGET = HistoryMemoryBudget(snowflake_settings.system_metrics_cache_max_bytes)
HISTORY_INDEX_OVERHEAD_BYTES = 1024


def _append_history(
    index: dict[TableKey, list[T]], key: TableKey, record: T, reserve: MemoryReservation | None
) -> None:
    if reserve is not None:
        record_bytes = sys.getsizeof(record)
        if isinstance(record, DmlRecord):
            record_bytes += sum(sys.getsizeof(value) for value in record)
        else:
            record_bytes += sys.getsizeof(record.__dict__)
            record_bytes += sum(sys.getsizeof(value) for value in record.__dict__.values())
            record_bytes += sys.getsizeof(record.__pydantic_fields_set__)
            record_bytes += sum(sys.getsizeof(field) for field in record.__pydantic_fields_set__)
        # Charge a separate list slot container for each row, and a separate dict for
        # each bucket. This overcounts spare capacity and shared values deliberately.
        record_bytes += sys.getsizeof([None])
        if key not in index:
            record_bytes += sys.getsizeof(key) + sum(sys.getsizeof(part) for part in key)
            record_bytes += sys.getsizeof({key: None}) + sys.getsizeof([])
        reserve(record_bytes)
    index.setdefault(key, []).append(record)


def _table_key(database: str, schema: str, table: str) -> TableKey:
    return database.lower(), schema.lower(), table.lower()


@functools.lru_cache(maxsize=4)
def _batch_table_keys(batch: TableBatch) -> frozenset[TableKey]:
    """Every table of the batch asks for its keys; splitting an FQN runs the ANTLR
    parser, so it is done once per batch."""
    keys = set()
    for table_fqn in batch.table_fqns:
        parts = fqn.split(table_fqn)
        if len(parts) == 4:
            keys.add(_table_key(*(fqn.unquote_name(part) for part in parts[1:])))
    return frozenset(keys)


def _target_table_name(identifier: str) -> str | None:
    try:
        return get_identifiers_from_string(identifier)[2]
    except ValueError:
        return None


class BatchHistoryIndex(Generic[T]):
    """History for recent batches within the shared byte budget.

    An oversized batch is remembered as ``None`` so later tables use individual scans
    without repeatedly attempting the same oversized batch scan.
    """

    def __init__(self, name: str, max_batches: int = 2):
        self.name = name
        self._max_batches = max_batches
        self._budget = HISTORY_MEMORY_BUDGET
        self._indexes: OrderedDict[int, dict[TableKey, list[T]] | None] = OrderedDict()
        self._batches_built = 0

    def get(self, batch: TableBatch, build: HistoryBuilder[T]) -> dict[TableKey, list[T]] | None:
        with self._budget.lock:
            cache_key = (self.name, batch.batch_id)
            if batch.batch_id in self._indexes:
                self._indexes.move_to_end(batch.batch_id)
                self._budget.touch(cache_key)
                return self._indexes[batch.batch_id]
            while len(self._indexes) >= self._max_batches:
                evicted, _ = self._indexes.popitem(last=False)
                self._budget.discard((self.name, evicted))

            def discard(batch_id: int = batch.batch_id) -> None:
                self._indexes.pop(batch_id, None)

            self._budget.begin(cache_key, discard)
            cached = False
            index = None
            try:
                self._budget.reserve(cache_key, HISTORY_INDEX_OVERHEAD_BYTES)
                index, rows_read = build(_batch_table_keys(batch), lambda size: self._budget.reserve(cache_key, size))
                cached = True
                self._batches_built += 1
                logger.info(
                    "Scanned Snowflake %s for system metrics batch #%d (%d tables): %d rows fetched, %d tables indexed",
                    self.name,
                    self._batches_built,
                    len(batch.table_fqns),
                    rows_read,
                    len(index),
                )
            except HistoryBudgetExceededError:
                logger.warning(
                    "Snowflake %s batch of %d tables exceeded the shared system metrics cache budget "
                    "(%d bytes); falling back to per-table scans",
                    self.name,
                    len(batch.table_fqns),
                    self._budget.max_bytes,
                )
            finally:
                if not cached:
                    self._budget.discard(cache_key)
            self._indexes[batch.batch_id] = index
            return index

    def clear(self) -> None:
        with self._budget.lock:
            for batch_id in list(self._indexes):
                self._budget.discard((self.name, batch_id))
            self._indexes.clear()
            self._batches_built = 0


QUERY_HISTORY_INDEX = BatchHistoryIndex[DmlRecord]("QUERY_HISTORY")
DYNAMIC_TABLE_REFRESH_INDEX = BatchHistoryIndex[SnowflakeDynamicTableRefreshEntry]("DYNAMIC_TABLE_REFRESH_HISTORY")


def index_query_history(
    entries: Iterable[SnowflakeQueryLogEntry],
    resolver: SnowflakeTableResovler,
    targets: frozenset[TableKey],
    reserve: MemoryReservation | None = None,
) -> tuple[dict[TableKey, list[DmlRecord]], int]:
    """Resolve the table each DML modified and keep the ones that target `targets`.

    `entries` is consumed lazily and matching rows reserve cache space before being
    retained. An oversized batch aborts so its caller can retry one table at a time.
    Each row is attributed to the single table it resolves to, so a query matched by
    several ILIKE patterns -- in this batch
    or in another one -- is counted once.

    Returns the index and the number of rows read.
    """
    target_names = {table for _, _, table in targets}
    index: dict[TableKey, list[DmlRecord]] = defaultdict(list)
    rows_read = 0
    for entry in entries:
        rows_read += 1
        identifier = _parse_query(entry.query_text)
        if not identifier:
            continue
        # ILIKE matches the name anywhere in the text (`orders` in `customer_orders`):
        # skip such rows before resolving, which can cost a SHOW TABLES round trip.
        target_name = _target_table_name(identifier)
        if target_name is not None and target_name.lower() not in target_names:
            continue
        result = get_snowflake_system_queries(query_log_entry=entry, resolver=resolver)
        if result is None:
            continue
        key = _table_key(result.database_name, result.schema_name, result.table_name)
        if key not in targets:
            continue
        _append_history(
            index,
            key,
            DmlRecord(
                database_name=key[0],
                schema_name=key[1],
                table_name=key[2],
                query_type=result.query_type,
                start_time=result.start_time,
                rows_inserted=result.rows_inserted,
                rows_updated=result.rows_updated,
                rows_deleted=result.rows_deleted,
            ),
            reserve,
        )
    return dict(index), rows_read


def index_dynamic_table_refreshes(
    entries: Iterable[SnowflakeDynamicTableRefreshEntry],
    targets: frozenset[TableKey],
    reserve: MemoryReservation | None = None,
) -> tuple[dict[TableKey, list[SnowflakeDynamicTableRefreshEntry]], int]:
    """Group the refreshes of `targets` by dynamic table. Returns the index and the
    number of rows read."""
    index: dict[TableKey, list[SnowflakeDynamicTableRefreshEntry]] = defaultdict(list)
    rows_read = 0
    for entry in entries:
        rows_read += 1
        key = _table_key(entry.database_name or "", entry.schema_name or "", entry.table_name)
        if key in targets:
            _append_history(index, key, entry, reserve)
    return dict(index), rows_read


@register_system_metrics(PythonDialects.Snowflake)
class SnowflakeSystemMetricsComputer(SystemMetricsComputer):
    """Snowflake system metrics source"""

    def __init__(
        self,
        session: Session,
        runner: QueryRunner,
        service_connection_config: SnowflakeConnection,
        table_entity: Table,
    ):
        self.session = session
        self.runner = runner
        self.table = runner.table_name
        self.database = runner.session.get_bind().url.database
        self.schema = runner.schema_name
        self.resolver = SnowflakeTableResovler(
            session=session,
        )
        self.service_connection_config = service_connection_config
        self.table_entity = table_entity
        # get_inserts/updates/deletes each read the history of the same table
        self._history: dict[tuple[str, str], list] = {}

    @property
    def is_dynamic_table(self) -> bool:
        """Check if the table is a dynamic table"""
        return self.table_entity.tableType == TableType.Dynamic

    def get_inserts(self) -> list[SystemProfile]:
        if self.is_dynamic_table:
            return self._get_dynamic_table_system_profile("rows_inserted", DmlOperationType.INSERT)
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.INSERT,
                        DatabaseDMLOperations.MERGE,
                    ],
                )
            ),
            "rows_inserted",
            DmlOperationType.INSERT,
        )

    def get_updates(self) -> list[SystemProfile]:
        if self.is_dynamic_table:
            return self._get_dynamic_table_system_profile("rows_updated", DmlOperationType.UPDATE)
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.UPDATE,
                        DatabaseDMLOperations.MERGE,
                    ],
                )
            ),
            "rows_updated",
            DmlOperationType.UPDATE,
        )

    def get_deletes(self) -> list[SystemProfile]:
        if self.is_dynamic_table:
            return self._get_dynamic_table_system_profile("rows_deleted", DmlOperationType.DELETE)
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.DELETE,
                    ],
                )
            ),
            "rows_deleted",
            DmlOperationType.DELETE,
        )

    def _table_batch(self) -> TableBatch | None:
        table_fqn = getattr(self.table_entity.fullyQualifiedName, "root", None)
        return TABLE_BATCH_WINDOW.batch_for(table_fqn) if isinstance(table_fqn, str) else None

    def _history_for(
        self,
        table: str,
        history_index: BatchHistoryIndex[T],
        build: HistoryBuilder[T],
    ) -> list[T]:
        """History of `table`, read from its batch's index. A table the fetcher did not
        queue (e.g. profiled on its own) is scanned alone, as before batching."""
        memo_key = (history_index.name, table)
        if memo_key not in self._history:
            key = _table_key(self.database or "", self.schema or "", table)
            batch = self._table_batch()
            index = history_index.get(batch, build) if batch is not None and key in _batch_table_keys(batch) else None
            if index is None:
                index, _ = build(frozenset({key}), None)
            self._history[memo_key] = index.get(key, [])
        return self._history[memo_key]

    def _build_query_history_index(
        self, targets: frozenset[TableKey], reserve: MemoryReservation | None = None
    ) -> tuple[dict[TableKey, list[DmlRecord]], int]:
        with closing(
            SnowflakeQueryLogEntry.stream_for_tables(
                session=self.session,
                table_names=[table for _, _, table in targets],
                service_connection_config=self.service_connection_config,
            )
        ) as entries:
            return index_query_history(entries, resolver=self.resolver, targets=targets, reserve=reserve)

    def _build_dynamic_table_refresh_index(
        self, targets: frozenset[TableKey], reserve: MemoryReservation | None = None
    ) -> tuple[dict[TableKey, list[SnowflakeDynamicTableRefreshEntry]], int]:
        with closing(
            SnowflakeDynamicTableRefreshEntry.stream_for_tables(
                session=self.session,
                table_names=[table for _, _, table in targets],
                service_connection_config=self.service_connection_config,
            )
        ) as entries:
            return index_dynamic_table_refreshes(entries, targets=targets, reserve=reserve)

    def _get_dynamic_table_refresh_entries(
        self,
    ) -> list[SnowflakeDynamicTableRefreshEntry]:
        """Get dynamic table refresh history entries of this table"""
        return self._history_for(self.table, DYNAMIC_TABLE_REFRESH_INDEX, self._build_dynamic_table_refresh_index)

    def _get_dynamic_table_system_profile(
        self,
        rows_affected_field: str,
        operation: DmlOperationType,
    ) -> list[SystemProfile]:
        """Get system profile from dynamic table refresh history"""
        refresh_entries = self._get_dynamic_table_refresh_entries()
        return TypeAdapter(list[SystemProfile]).validate_python(
            [
                {
                    "timestamp": datetime_to_timestamp(entry.start_time, milliseconds=True),
                    "operation": operation,
                    "rowsAffected": getattr(entry, rows_affected_field) or 0,
                }
                for entry in refresh_entries
                if (getattr(entry, rows_affected_field) or 0) > 0
                and CaseInsensitiveString(self.table) == entry.table_name
            ]
        )

    @staticmethod
    def get_system_profile(
        db: str,
        schema: str,
        table: str,
        query_results: list[SnowflakeQueryResult] | list[DmlRecord],
        rows_affected_field: str,
        operation: DmlOperationType,
    ) -> list[SystemProfile]:
        if not SnowflakeQueryResult.model_fields.get(rows_affected_field):
            raise ValueError(
                f"rows_affected_field [{rows_affected_field}] is not a valid field in SnowflakeQueryResult."
            )
        return TypeAdapter(list[SystemProfile]).validate_python(
            [
                {
                    "timestamp": datetime_to_timestamp(q.start_time, milliseconds=True),
                    "operation": operation,
                    "rowsAffected": getattr(q, rows_affected_field),
                }
                for q in query_results
                if (getattr(q, rows_affected_field) or 0) > 0
                # snowflake SQL identifiers are case insensitive. All identifiers are stored in upper case.
                and (
                    CaseInsensitiveString(db),
                    CaseInsensitiveString(schema),
                    CaseInsensitiveString(table),
                )
                == (
                    q.database_name,
                    q.schema_name,
                    q.table_name,
                )
            ]
        )

    def get_queries_by_operation(self, table: str, operations: list[DatabaseDMLOperations]):
        ops = [op.value for op in operations]
        yield from (query for query in self.get_queries(table) if query.query_type in ops)

    def get_queries(self, table: str) -> list[DmlRecord]:
        return self._history_for(table, QUERY_HISTORY_INDEX, self._build_query_history_index)
