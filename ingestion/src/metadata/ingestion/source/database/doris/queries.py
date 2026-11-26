"""
SQL Queries used during ingestion
"""

import textwrap

DORIS_GET_SCHEMA_COLUMN_INFO = textwrap.dedent(
    """
SELECT COLUMN_NAME,COLUMN_DEFAULT,IS_NULLABLE,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,
NUMERIC_PRECISION,NUMERIC_SCALE,COLUMN_TYPE,COLUMN_KEY,COLUMN_COMMENT,ORDINAL_POSITION
from information_schema.`columns` t
where TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
    """
)

DORIS_SHOW_FULL_COLUMNS = textwrap.dedent(
    """
SHOW FULL COLUMNS FROM {table_name}
    """
)

# DISTINCT: Doris master returns one row per partition here, released versions one row per table
DORIS_GET_TABLE_KEY_MODELS = textwrap.dedent(
    """
SELECT DISTINCT TABLE_NAME, TABLE_MODEL, TABLE_MODEL_KEY
FROM information_schema.table_options
WHERE TABLE_SCHEMA = :schema
    """
)

# Async materialized views of a schema: SHOW FULL TABLES and information_schema.tables list them as base tables
DORIS_GET_MATERIALIZED_VIEW_NAMES = textwrap.dedent(
    """
SELECT Name FROM mv_infos('database' = :schema)
    """
)

DORIS_SHOW_CREATE_TABLE = textwrap.dedent(
    """
SHOW CREATE TABLE {table_name}
    """
)

# SHOW CREATE TABLE refuses an async materialized view
DORIS_SHOW_CREATE_MATERIALIZED_VIEW = textwrap.dedent(
    """
SHOW CREATE MATERIALIZED VIEW {table_name}
    """
)

# information_schema.partitions has one row per partition, or a single UNPARTITIONED row for a table
# without partition columns. A table whose partitions are yet to be created has no row, nor has a view.
DORIS_GET_PARTITIONS = textwrap.dedent(
    """
SELECT t.TABLE_NAME, t.ENGINE, p.PARTITION_METHOD, p.PARTITION_EXPRESSION
FROM information_schema.tables t
LEFT JOIN (
    SELECT DISTINCT TABLE_NAME, PARTITION_METHOD, PARTITION_EXPRESSION
    FROM information_schema.partitions
    WHERE TABLE_SCHEMA = :schema
) p ON p.TABLE_NAME = t.TABLE_NAME
WHERE t.TABLE_SCHEMA = :schema
    """
)

# The query log. Doris writes `time` in its global time zone, not the session's, so the UTC window is
# converted to it and the start time back to UTC. `catalog` is the session's: `internal` resolves to the
# service's database (ADR:2026-11-13-doris-internal-catalog-names-the-service-database). A statement cut
# at audit_plugin_max_sql_length cannot be parsed. `filters` selects the statements of the workflow.
DORIS_SQL_STATEMENT = textwrap.dedent(
    """
SELECT
  CONVERT_TZ(`time`, @@global.time_zone, '+00:00') AS start_time,
  MILLISECONDS_ADD(CONVERT_TZ(`time`, @@global.time_zone, '+00:00'), query_time) AS end_time,
  query_time AS duration,
  catalog AS database_name,
  NULLIF(db, '') AS schema_name,
  `user` AS user_name,
  FALSE AS aborted,
  stmt AS query_text
FROM __internal_schema.audit_log
WHERE `time` >= CONVERT_TZ('{start_time}', '+00:00', @@global.time_zone)
  AND `time` < CONVERT_TZ('{end_time}', '+00:00', @@global.time_zone)
  AND state IN ('OK', 'EOF')
  AND stmt NOT LIKE '/* {{"app": "OpenMetadata", %%'
  AND stmt NOT LIKE '/* {{"app": "dbt", %%'
  AND stmt NOT LIKE '%%/* truncated. audit_plugin_max_sql_length=%%'
  {filters}
ORDER BY `time` DESC
LIMIT {result_limit}
    """
)

# Reads every column the query log statement reads; releases before 3.1 lack is_internal
DORIS_TEST_GET_QUERIES = textwrap.dedent(
    """
SELECT `time`, query_time, catalog, db, `user`, state, stmt
FROM __internal_schema.audit_log
WHERE is_query = 1 AND is_internal = 0
LIMIT 1
    """
)

DORIS_GET_AUDIT_LOG_ENABLED = textwrap.dedent(
    """
SELECT @@enable_audit_plugin
    """
)
