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
SQL Queries used during ingestion
"""

from sqlalchemy import text

COCKROACH_GET_TABLE_NAMES = """
    SELECT 
    c.relname AS table_name,
    c.relkind AS relkind
    FROM 
        pg_class c
    JOIN 
        pg_namespace n ON n.oid = c.relnamespace
    WHERE 
        n.nspname = :schema 
        AND c.relkind IN ('r', 'p', 'f')
    ORDER BY 
        c.relname
"""

COCKROACH_GET_VIEW_NAMES = """
    SELECT 
    c.relname AS table_name,
    c.relkind AS relkind
    FROM 
        pg_class c
    JOIN 
        pg_namespace n ON n.oid = c.relnamespace
    WHERE 
        n.nspname = :schema 
        AND c.relkind IN ('v')
    ORDER BY 
        c.relname
"""


COCKROACH_SCHEMA_COMMENTS = """
    SELECT
    current_database() AS database_name,
    n.nspname AS schema_name,
    d.description AS comment
FROM 
    pg_namespace n
LEFT JOIN 
    pg_description d 
ON 
    n.oid = d.objoid
WHERE 
    d.objsubid = 0;
"""


COCKROACH_GET_DATABASE = text(
    """
    select datname FROM pg_catalog.pg_database
"""
)

COCKROACH_GET_DB_NAMES = """
    select datname from pg_catalog.pg_database
"""

COCKROACH_GET_PARTITION_DETAILS = """
    SELECT
    partitions.name AS partition_name,
    column_names,
    CASE 
        WHEN list_value IS NOT NULL THEN 'list'
        ELSE 'range'
    END AS partition_type,
    tables.name AS table_name,
    database_name
FROM
    crdb_internal.partitions
JOIN
    crdb_internal.tables ON partitions.table_id = tables.table_id
WHERE
    tables.name = %(table_name)s;
"""
