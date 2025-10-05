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
TimescaleDB system view queries
"""

TIMESCALE_GET_HYPERTABLE_INFO = """
SELECT
    ht.hypertable_schema,
    ht.hypertable_name,
    ht.compression_enabled,
    dim.column_name,
    EXTRACT(EPOCH FROM dim.time_interval) * 1000000 as interval_length,
    dim.integer_interval,
    dim.integer_now_func,
    ht.num_dimensions
FROM timescaledb_information.hypertables ht
LEFT JOIN timescaledb_information.dimensions dim
    ON ht.hypertable_schema = dim.hypertable_schema
    AND ht.hypertable_name = dim.hypertable_name
    AND dim.dimension_number = 1
WHERE ht.hypertable_schema = %(schema_name)s
  AND ht.hypertable_name = %(table_name)s
"""

TIMESCALE_GET_COMPRESSION_SETTINGS = """
SELECT
    array_agg(DISTINCT attname ORDER BY attname) FILTER (WHERE segmentby_column_index IS NOT NULL) as segment_by_columns,
    array_agg(DISTINCT attname ORDER BY attname) FILTER (WHERE orderby_column_index IS NOT NULL) as order_by_columns
FROM timescaledb_information.compression_settings
WHERE hypertable_schema = %(schema_name)s
  AND hypertable_name = %(table_name)s
GROUP BY hypertable_schema, hypertable_name
"""

TIMESCALE_GET_CONTINUOUS_AGGREGATES = """
SELECT
    view_schema,
    view_name,
    view_definition,
    compression_enabled,
    materialized_only,
    materialization_hypertable_schema,
    materialization_hypertable_name
FROM timescaledb_information.continuous_aggregates
WHERE view_schema = %(schema_name)s
"""

TIMESCALE_GET_CHUNK_INFO = """
SELECT
    chunk_schema,
    chunk_name,
    range_start,
    range_end,
    is_compressed,
    chunk_tablespace
FROM timescaledb_information.chunks
WHERE hypertable_schema = %(schema_name)s
  AND hypertable_name = %(table_name)s
ORDER BY range_start DESC
LIMIT 5
"""

TIMESCALE_CHECK_EXTENSION = """
SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'timescaledb'
) as timescaledb_installed
"""

TIMESCALE_GET_CONTINUOUS_AGGREGATE_DEFINITIONS = """
SELECT
    ca.view_schema,
    ca.view_name,
    ca.view_definition,
    ca.materialization_hypertable_schema,
    ca.materialization_hypertable_name,
    ht.hypertable_schema as source_hypertable_schema,
    ht.hypertable_name as source_hypertable_name
FROM timescaledb_information.continuous_aggregates ca
LEFT JOIN timescaledb_information.hypertables ht
    ON ca.materialization_hypertable_schema = ht.hypertable_schema
    AND ca.materialization_hypertable_name = ht.hypertable_name
WHERE ca.view_schema NOT IN ('_timescaledb_catalog', '_timescaledb_config', '_timescaledb_cache', '_timescaledb_internal')
ORDER BY ca.view_schema, ca.view_name
"""
