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
Hex-specific query templates for fetching queries from various data warehouses
"""

import textwrap
from enum import Enum
from typing import Dict


class WarehouseType(Enum):
    """Supported warehouse types for Hex lineage"""

    SNOWFLAKE = "snowflake"
    BIGQUERY = "bigquery"
    DATABRICKS = "databricks"
    REDSHIFT = "redshift"
    MYSQL = "mysql"
    ATHENA = "athena"
    TRINO = "trino"
    PRESTO = "presto"
    CLICKHOUSE = "clickhouse"


# Snowflake query to fetch Hex-originated queries
HEX_SNOWFLAKE_QUERY = textwrap.dedent(
    """
    SELECT query_text,query_id, user_name, start_time
    FROM {account_usage}.QUERY_HISTORY
    WHERE query_text ILIKE '%hex%'
    ORDER BY start_time DESC
    LIMIT {limit};
    """
)

# BigQuery query to fetch Hex-originated queries
HEX_BIGQUERY_QUERY = textwrap.dedent(
    """
    SELECT 
        query as query_text,
        user_email as user_name,
        project_id as database_name,
        CAST(NULL AS STRING) as schema_name,
        start_time,
        end_time,
        total_slot_ms as duration
    FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    WHERE 
        query LIKE '%hex%'
        AND creation_time >= TIMESTAMP('{start_time}')
        AND creation_time <= TIMESTAMP('{end_time}')
    ORDER BY creation_time DESC
    LIMIT {limit}
    """
)

# Databricks query to fetch Hex-originated queries
HEX_DATABRICKS_QUERY = textwrap.dedent(
    """
    SELECT
      statement_text as query_text
    FROM system.query.history
    WHERE 
      LOWER(statement_text) LIKE '%hex%'
      AND start_time >= '{start_time}'
      AND start_time <= '{end_time}'
    ORDER BY start_time DESC
    LIMIT {limit}
    """
)

# Redshift query to fetch Hex-originated queries
HEX_REDSHIFT_QUERY = textwrap.dedent(
    """
    SELECT
      q.querytxt as query_text,
      u.usename as user_name,
      trim(q.database) as database_name,
      q.starttime as start_time,
      q.endtime as end_time,
      DATEDIFF(milliseconds, q.starttime, q.endtime) as duration_ms,
      q.query as query_id
    FROM stl_query q
    LEFT JOIN pg_user u ON q.userid = u.usesysid
    WHERE 
      LOWER(q.querytxt) LIKE '%hex%'
      AND q.starttime >= '{start_time}'
      AND q.starttime <= '{end_time}'
      AND q.querytxt NOT LIKE 'COMMIT%'
      AND q.querytxt NOT LIKE 'BEGIN%'
      AND q.querytxt NOT LIKE 'ROLLBACK%'
      AND q.querytxt NOT LIKE 'SET %'
      AND q.querytxt NOT LIKE 'SHOW %'
      AND q.querytxt NOT LIKE '%pg_catalog%'
      AND q.querytxt NOT LIKE '%information_schema%'
      AND q.querytxt NOT LIKE '%stl_query%'
    ORDER BY q.starttime DESC
    LIMIT {limit}
    """
)


# MySQL query to fetch Hex-originated queries
# Note: This requires either:
# 1. performance_schema with statement history enabled
# 2. general_log table enabled (SET GLOBAL general_log = 'ON'; SET GLOBAL log_output = 'TABLE';)
# 3. Custom query logging solution
HEX_MYSQL_QUERY = textwrap.dedent(
    """
    SELECT 
       CONVERT(argument USING utf8) as query_text,
       user_host as user_name,
       event_time as start_time
FROM mysql.general_log
WHERE argument LIKE '%hex%'
LIMIT {limit};
"""
)


# Athena query to fetch Hex-originated queries
HEX_ATHENA_QUERY = textwrap.dedent(
    """
    SELECT
      query_string as query_text,
      principal as user_name,
      catalog as database_name,
      schema as schema_name,
      event_time as start_time,
      event_time as end_time,
      query_execution_time_in_millis as duration
    FROM aws_athena_query_history
    WHERE query_string LIKE '%Hex query metadata%'
      AND (
        query_string LIKE '%"context": "SCHEDULED_RUN"%' 
        OR query_string LIKE '%"context": "APP_VIEW"%'
      )
      AND event_time BETWEEN '{start_time}' AND '{end_time}'
    LIMIT {limit}
    """
)

# Trino/Presto query to fetch Hex-originated queries
HEX_TRINO_QUERY = textwrap.dedent(
    """
    SELECT
      query as query_text,
      user as user_name,
      catalog as database_name,
      schema as schema_name,
      created as start_time,
      end as end_time,
      query_wall_time_ms as duration
    FROM system.runtime.queries
    WHERE query LIKE '%Hex query metadata%'
      AND (
        query LIKE '%"context": "SCHEDULED_RUN"%' 
        OR query LIKE '%"context": "APP_VIEW"%'
      )
      AND created BETWEEN timestamp '{start_time}' AND timestamp '{end_time}'
    LIMIT {limit}
    """
)

# ClickHouse query to fetch Hex-originated queries
HEX_CLICKHOUSE_QUERY = textwrap.dedent(
    """
    SELECT
      query as query_text,
      user as user_name,
      current_database as database_name,
      '' as schema_name,
      event_time as start_time,
      event_time as end_time,
      query_duration_ms as duration
    FROM system.query_log
    WHERE query LIKE '%Hex query metadata%'
      AND event_time BETWEEN '{start_time}' AND '{end_time}'
      AND type = 'QueryFinish'
    LIMIT {limit}
    """
)


# Mapping of warehouse types to their query templates
HEX_WAREHOUSE_QUERIES: Dict[WarehouseType, str] = {
    WarehouseType.SNOWFLAKE: HEX_SNOWFLAKE_QUERY,
    WarehouseType.BIGQUERY: HEX_BIGQUERY_QUERY,
    WarehouseType.DATABRICKS: HEX_DATABRICKS_QUERY,
    WarehouseType.REDSHIFT: HEX_REDSHIFT_QUERY,
    WarehouseType.MYSQL: HEX_MYSQL_QUERY,
    WarehouseType.ATHENA: HEX_ATHENA_QUERY,
    # WarehouseType.TRINO: HEX_TRINO_QUERY,
    # WarehouseType.PRESTO: HEX_TRINO_QUERY,  # Same as Trino
    WarehouseType.CLICKHOUSE: HEX_CLICKHOUSE_QUERY,
}


def get_hex_query_template(warehouse_type: str) -> str:
    """
    Get the Hex query template for a specific warehouse type

    Args:
        warehouse_type: Type of the warehouse (e.g., "snowflake", "bigquery")

    Returns:
        Query template string for the warehouse

    Raises:
        ValueError: If warehouse type is not supported
    """
    try:
        warehouse = WarehouseType(warehouse_type.lower())
        return HEX_WAREHOUSE_QUERIES.get(warehouse)
    except ValueError:
        raise ValueError(f"Unsupported warehouse type: {warehouse_type}")
