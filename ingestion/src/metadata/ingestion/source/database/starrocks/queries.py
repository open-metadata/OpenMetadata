"""
SQL Queries used during ingestion
"""

import textwrap

STARROCKS_GET_SCHEMA_COLUMN_INFO = textwrap.dedent(
    """
SELECT COLUMN_NAME,COLUMN_DEFAULT,IS_NULLABLE,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,
NUMERIC_PRECISION,NUMERIC_SCALE,COLUMN_TYPE,COLUMN_KEY,COLUMN_COMMENT,ORDINAL_POSITION
from information_schema.`columns` t
where TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
    """
)

STARROCKS_SHOW_FULL_COLUMNS = textwrap.dedent(
    """
SHOW FULL COLUMNS FROM {}.{}
    """
)

STARROCKS_GET_TABLE_NAMES = textwrap.dedent(
    """
    select TABLE_NAME as name,
    case when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'VIEW' then 'MVIEW'
         when `ENGINE` = 'MEMORY' and TABLE_TYPE = 'SYSTEM VIEW' then 'VIEW'
         when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'TABLE' then 'TABLE'
         when `ENGINE` = '' and TABLE_TYPE = 'VIEW' then 'VIEW'
         else `ENGINE`
    end as engine
    from INFORMATION_SCHEMA.tables 
    where TABLE_SCHEMA = :schema
    """
)

STARROCKS_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT TABLE_COMMENT
FROM information_schema.tables
WHERE TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
"""
)

STARROCKS_PARTITION_DETAILS = textwrap.dedent(
    """
SHOW PARTITIONS FROM {}.{}
    """
)
