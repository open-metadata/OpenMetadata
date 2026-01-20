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
StarRocks System Table Profiler

Uses StarRocks system tables for efficient statistics gathering:
- information_schema.tables: row count, data size, create/update time
- _statistics_.column_statistics: column-level statistics (requires ANALYZE)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Type

from sqlalchemy import text

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.profiler.interface.sqlalchemy.stored_statistics_profiler import (
    StoredStatisticsSource,
)
from metadata.profiler.metrics.core import Metric
from metadata.profiler.registry import MetricRegistry
from metadata.utils.dependency_injector.dependency_injector import (
    Inject,
    inject_class_attributes,
)
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = profiler_logger()


class StarRocksColumnStats(BaseModel):
    """Column statistics from _statistics_.column_statistics"""

    column_name: Optional[str] = None
    row_count: Optional[int] = None
    data_size: Optional[int] = None
    distinct_count: Optional[int] = None
    null_count: Optional[int] = None
    min_value: Optional[str] = None
    max_value: Optional[str] = None


class StarRocksTableStats(BaseModel):
    """Table statistics from information_schema.tables"""

    row_count: Optional[int] = None
    data_size: Optional[int] = None
    create_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    columns: Dict[str, StarRocksColumnStats] = {}


# Query to get table statistics from information_schema
STARROCKS_TABLE_STATS_QUERY = """
SELECT
    TABLE_ROWS as row_count,
    DATA_LENGTH as data_size,
    CREATE_TIME as create_time,
    UPDATE_TIME as update_time
FROM information_schema.tables
WHERE TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
"""

# Query to get column statistics from _statistics_.column_statistics
# Note: table_name in column_statistics is stored as 'schema.table' format
# ndv is HyperLogLog type, use HLL_CARDINALITY to get distinct count
STARROCKS_COLUMN_STATS_QUERY = """
SELECT
    column_name,
    row_count,
    data_size,
    HLL_CARDINALITY(ndv) as distinct_count,
    null_count,
    min as min_value,
    max as max_value
FROM _statistics_.column_statistics
WHERE table_name = :full_table_name
"""


@inject_class_attributes
class StarRocksStoredStatisticsSource(StoredStatisticsSource):
    """StarRocks system profile source using stored statistics"""

    metrics: Inject[Type[MetricRegistry]]

    @classmethod
    def get_metric_stats_map(cls) -> Dict[MetricRegistry, str]:
        """Map OpenMetadata metrics to StarRocks statistics column names"""
        return {
            cls.metrics.ROW_COUNT: "row_count",
            cls.metrics.DISTINCT_COUNT: "distinct_count",
            cls.metrics.NULL_COUNT: "null_count",
            cls.metrics.MAX: "max_value",
            cls.metrics.MIN: "min_value",
        }

    @classmethod
    def get_metric_stats_by_name(cls) -> Dict[str, str]:
        return {k.name: v for k, v in cls.get_metric_stats_map().items()}

    def get_statistics_metrics(self) -> Set[MetricRegistry]:
        return set(self.get_metric_stats_map().keys())

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.stats_cache = LRUCache(capacity=LRU_CACHE_SIZE)

    def get_column_statistics(
        self, metric: List[Metric], schema: str, table_name: str, column: str
    ) -> Dict[str, Any]:
        """Get column-level statistics from _statistics_.column_statistics"""
        table_stats = self._get_cached_stats(schema, table_name)

        if column not in table_stats.columns:
            logger.debug(
                f"Column {column} not found in statistics for {schema}.{table_name}. "
                "Run ANALYZE TABLE to collect statistics."
            )
            return {}

        column_stats = table_stats.columns[column]
        result = {}
        for m in metric:
            stat_name = self.get_metric_stats_by_name().get(m.name())
            if stat_name:
                value = getattr(column_stats, stat_name, None)
                if value is not None:
                    result[m.name()] = value

        return result

    def get_table_statistics(
        self, metric: List[Metric], schema: str, table_name: str
    ) -> Dict[str, Any]:
        """Get table-level statistics from information_schema.tables"""
        table_stats = self._get_cached_stats(schema, table_name)
        result = {}
        for m in metric:
            stat_name = self.get_metric_stats_by_name().get(m.name())
            if stat_name and hasattr(table_stats, stat_name):
                value = getattr(table_stats, stat_name, None)
                if value is not None:
                    result[m.name()] = value

        return result

    def _get_cached_stats(self, schema: str, table: str) -> StarRocksTableStats:
        """Get statistics from cache or fetch from database"""
        path = f"{schema}.{table}"
        if path in self.stats_cache:
            return self.stats_cache.get(path)
        stats = self._get_db_stats(schema, table)
        self.stats_cache.put(path, stats)
        return stats

    def _get_db_stats(self, schema: str, table: str) -> StarRocksTableStats:
        """Fetch statistics from StarRocks system tables"""
        table_stats = StarRocksTableStats()

        with self.connection.connect() as conn:
            # Get table-level stats from information_schema.tables
            table_result = conn.execute(
                text(STARROCKS_TABLE_STATS_QUERY),
                {"schema": schema, "table_name": table},
            ).first()

            if table_result:
                table_stats.row_count = table_result.row_count
                table_stats.data_size = table_result.data_size
                table_stats.create_time = table_result.create_time
                table_stats.update_time = table_result.update_time

            # Get column-level stats from _statistics_.column_statistics
            # StarRocks stores table_name as 'schema.table' format
            try:
                full_table_name = f"{schema}.{table}"
                column_results = conn.execute(
                    text(STARROCKS_COLUMN_STATS_QUERY),
                    {"full_table_name": full_table_name},
                )
                for row in column_results:
                    col_stats = StarRocksColumnStats(
                        column_name=row.column_name,
                        row_count=row.row_count,
                        data_size=row.data_size,
                        distinct_count=(
                            int(row.distinct_count) if row.distinct_count else None
                        ),
                        null_count=row.null_count,
                        min_value=row.min_value,
                        max_value=row.max_value,
                    )
                    table_stats.columns[row.column_name] = col_stats
            except Exception as exc:
                logger.debug(
                    f"Could not fetch column statistics for {schema}.{table}: {exc}. "
                    "This is expected if ANALYZE has not been run on the table."
                )

        return table_stats
