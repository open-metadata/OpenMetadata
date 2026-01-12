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
StarRocks Profiler Interface

Extends ProfilerWithStatistics to leverage StarRocks system tables:
- information_schema.tables for table-level stats (row count, size, timestamps)
- _statistics_.table_statistic_v1 for column-level stats (requires ANALYZE)

When useStatistics=True in profiler config, metrics will be fetched from
system tables instead of running expensive queries against the actual data.
"""

from metadata.ingestion.source.database.starrocks.profiler.system_tables_profiler import (
    StarRocksStoredStatisticsSource,
)
from metadata.profiler.interface.sqlalchemy.stored_statistics_profiler import (
    ProfilerWithStatistics,
)
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class StarRocksProfilerInterface(ProfilerWithStatistics, StarRocksStoredStatisticsSource):
    """
    StarRocks profiler interface with support for stored statistics.

    This interface can use StarRocks system tables for efficient profiling:
    - Row count and data size from information_schema.tables
    - Column statistics (distinct count, null count, min, max) from
      _statistics_.table_statistic_v1 (requires running ANALYZE TABLE)

    To enable statistics-based profiling, set useStatistics=True in the
    profiler configuration.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
