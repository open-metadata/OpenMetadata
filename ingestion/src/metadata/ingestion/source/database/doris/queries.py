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
