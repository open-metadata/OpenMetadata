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
#  pylint: disable=unused-argument
"""
System Metric
"""

import itertools
import threading
from abc import ABC
from collections import OrderedDict, defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Generic, Protocol, TypeVar

from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.profiler.metrics.core import SystemMetric
from metadata.profiler.orm.registry import PythonDialects
from metadata.utils.helpers import deep_size_of_dict
from metadata.utils.importer import DynamicImportException, import_side_effects
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache
from metadata.utils.profiler_utils import QueryResult

logger = profiler_logger()

MAX_SIZE_IN_BYTES = 2 * 1024**3  # 2GB
DEFAULT_SYSTEM_METRICS_BATCH_SIZE = 50


def recursive_dic():
    """recursive default dict"""
    return defaultdict(recursive_dic)


SYSTEM_QUERY_RESULT_CACHE = recursive_dic()

T = TypeVar("T")


class CacheProvider(ABC, Generic[T]):
    """Cache provider class to provide cache for system metrics"""

    def __init__(self):
        self.cache = LRUCache[list[T]](LRU_CACHE_SIZE)

    def __init_subclass__(cls, **kwargs):
        """Ensure that subclasses properly initialize the cache"""
        super().__init_subclass__(**kwargs)

        # Store the original __init__ method
        original_init = cls.__init__

        def new_init(self, *args, **kwargs):
            # Always call CacheProvider.__init__ first
            CacheProvider.__init__(self)
            # Then call the original __init__ if it exists and is not CacheProvider's
            if original_init is not CacheProvider.__init__:
                original_init(self, *args, **kwargs)

        cls.__init__ = new_init

    def get_or_update_cache(
        self,
        cache_path: str,
        get_queries_fn: Callable[..., list[T]],
        *args,
        **kwargs,
    ) -> list[T]:
        if cache_path in self.cache:
            cached_result = self.cache.get(cache_path)
            return cached_result if cached_result is not None else []
        result = get_queries_fn(*args, **kwargs)
        self.cache.put(cache_path, result)
        return result


@dataclass(frozen=True)
class TableBatch:
    """Tables queued together for profiling, identified so per-batch results can be cached."""

    batch_id: int
    table_fqns: tuple[str, ...]


class TableBatchWindow:
    """Tables the fetcher has queued for profiling, grouped in batches.

    Tables are profiled one at a time, each with its own `SystemMetricsComputer`, so a
    computer only knows its own table. Engines whose DML history lives in a shared log
    (e.g. Snowflake QUERY_HISTORY) would otherwise scan that log once per table. The
    fetcher registers each batch here before handing its tables over, letting the first
    computer of a batch read the history of the whole batch in one scan.

    Only the most recent batches are retained: the fetcher registers a batch only after
    the previous one has been handed over, so memory stays bounded by the batch size
    instead of growing with the number of tables in the service.
    """

    def __init__(self, max_batches: int = 2):
        self._lock = threading.Lock()
        self._ids = itertools.count()
        self._max_batches = max_batches
        self._batches: OrderedDict[int, TableBatch] = OrderedDict()
        self._batch_by_fqn: dict[str, int] = {}

    def register(self, table_fqns: Sequence[str]) -> TableBatch:
        with self._lock:
            batch = TableBatch(batch_id=next(self._ids), table_fqns=tuple(dict.fromkeys(table_fqns)))
            self._batches[batch.batch_id] = batch
            for table_fqn in batch.table_fqns:
                self._batch_by_fqn[table_fqn] = batch.batch_id
            while len(self._batches) > self._max_batches:
                _, evicted = self._batches.popitem(last=False)
                for table_fqn in evicted.table_fqns:
                    if self._batch_by_fqn.get(table_fqn) == evicted.batch_id:
                        del self._batch_by_fqn[table_fqn]
            return batch

    def discard(self, batch: TableBatch) -> None:
        """Stop advertising a batch once its tables have left the fetcher."""
        with self._lock:
            self._batches.pop(batch.batch_id, None)
            for table_fqn in batch.table_fqns:
                if self._batch_by_fqn.get(table_fqn) == batch.batch_id:
                    del self._batch_by_fqn[table_fqn]

    def batch_for(self, table_fqn: str) -> TableBatch | None:
        with self._lock:
            batch_id = self._batch_by_fqn.get(table_fqn)
            return self._batches.get(batch_id) if batch_id is not None else None

    def clear(self) -> None:
        with self._lock:
            self._batches.clear()
            self._batch_by_fqn.clear()


TABLE_BATCH_WINDOW = TableBatchWindow()


class SystemMetricsComputer(Protocol):
    """System metrics computer class to fetch system metrics for a given table."""

    def _get_query_results(
        self,
        session: Session,
        query,
        operation,
    ) -> list[QueryResult]:
        """get query results either from cache or from the database

        Args:
            session (Session): session
            query (_type_): query
            operation (_type_): operation

        Returns:
            List[QueryResult]:
        """
        cursor = session.execute(text(query))
        results = [
            QueryResult(
                database_name=row.database,
                schema_name=row.schema,
                table_name=row.table,
                query_text=None,
                query_type=operation,
                start_time=row.starttime,
                rows=row.rows,
            )
            for row in cursor
            if (row.rows is not None) and (row.rows > 0)
        ]

        return results  # noqa: RET504

    def get_system_metrics(self) -> list[SystemProfile]:
        """Return system metrics for a given table. Actual passed object can be a variety of types based
        on the underlying infrastructure. For example, in the case of SQLalchemy, it can be a Table object
        and in the case of Mongo, it can be a collection object."""
        return self.get_inserts() + self.get_deletes() + self.get_updates()

    def get_inserts(self) -> list[SystemProfile]:
        """Get insert queries"""
        return []

    def get_deletes(self) -> list[SystemProfile]:
        """Get delete queries"""
        return []

    def get_updates(self) -> list[SystemProfile]:
        """Get update queries"""
        return []


class SystemMetricsRegistry:
    _registry: dict[str, type["SystemMetricsComputer"] | None] = {}  # noqa: RUF012

    @classmethod
    def register(cls, dialect: PythonDialects, implementation: type):
        cls._registry[dialect.name.lower()] = implementation

    @classmethod
    def get(cls, dialect: PythonDialects) -> type["SystemMetricsComputer"] | None:
        if dialect.name.lower() not in cls._registry:
            cls._discover_implementation(dialect)
        return cls._registry.get(dialect.name.lower())

    @classmethod
    def _discover_implementation(cls, dialect: PythonDialects):
        """Auto-discover the implementation in the profiler metrics.

        The module is imported for its side effect: ``@register_system_metrics`` puts the
        class in the registry. Reading a ``system`` attribute off the dialect package
        instead never resolves, because these are namespace packages whose submodule is
        not an attribute until something imports it.

        A dialect with no implementation is cached as ``None``. The profiler builds one
        interface per table, so leaving the miss uncached retries the failing import and
        re-logs it for every table profiled.
        """
        dialect_name = dialect.name.lower()
        try:
            import_side_effects(f"metadata.profiler.metrics.system.{dialect_name}.system")
        except DynamicImportException:
            logger.debug("No implementation found for %s", dialect_name)
        cls._registry.setdefault(dialect_name, None)


def register_system_metrics(
    dialect: PythonDialects,
) -> Callable[[type["SystemMetricsComputer"]], type["SystemMetricsComputer"]]:
    """Decorator to register a system metric implementation

    Args:
        dialect (PythonDialects): database type

    Returns:
        Callable: decorator function
    """

    def decorator(cls: type["SystemMetricsComputer"]):
        SystemMetricsRegistry.register(dialect, cls)
        return cls

    return decorator


class System(SystemMetric):
    """System metric class to fetch:
        1. freshness
        2. affected rows

    This is supported only for BigQuery, Snowflake, and Redshift
    """

    schema_metric_type = MetricType.system

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Marks the metric as table or column metric.

        By default, assume that a metric is a column
        metric. Table metrics should override this.
        """
        return False

    @classmethod
    def is_system_metrics(cls) -> bool:
        """True if returns system metrics"""
        return True

    @classmethod
    def name(cls):
        return MetricType.system.value

    def _manage_cache(self, max_size_in_bytes: int = MAX_SIZE_IN_BYTES) -> None:
        """manage cache and clears it if it exceeds the max size

        Args:
            max_size_in_bytes (int, optional): max size of cache in bytes. Defaults to 2147483648.
        Returns:
            None
        """
        if deep_size_of_dict(SYSTEM_QUERY_RESULT_CACHE) > max_size_in_bytes:
            logger.debug("Clearing system cache")
            SYSTEM_QUERY_RESULT_CACHE.clear()

    def _validate_attrs(self, attr_list: list[str]) -> None:
        """Validate the necessary attributes given via add_props"""
        for attr in attr_list:
            if not hasattr(self, attr):
                raise AttributeError(f"System requires a table to be set: add_props({attr}=...)(Metrics.system.value)")

    def sql(self, session: Session, **kwargs):
        raise NotImplementedError(
            "SQL method is not implemented for System metric. Use SystemMetricsComputer.get_system_metrics instead"
        )
