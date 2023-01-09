#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
SQL Queries used during ingestion
"""

import textwrap

POSTGRES_SQL_STATEMENT = textwrap.dedent(
    """
      SELECT
        u.usename,
        d.datname database_name,
        s.query query_text,
        s.total_exec_time/1000 duration
      FROM
        pg_stat_statements s
        JOIN pg_catalog.pg_database d ON s.dbid = d.oid
        JOIN pg_catalog.pg_user u ON s.userid = u.usesysid
      WHERE
        s.query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%' AND
        s.query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
        {filters}
      LIMIT {result_limit}
    """
)

# https://www.postgresql.org/docs/current/catalog-pg-class.html
# r = ordinary table, v = view, m = materialized view, c = composite type, f = foreign table, p = partitioned table,
POSTGRES_GET_TABLE_NAMES = """
    SELECT c.relname, c.relkind FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = :schema AND c.relkind in ('r', 'p', 'f') AND relispartition = false
"""

POSTGRES_PARTITION_DETAILS = textwrap.dedent(
    """
    select
        par.relnamespace::regnamespace::text as schema,
        par.relname as table_name,
        partition_strategy,
        col.column_name
    from
        (select
             partrelid,
             partnatts,
             case partstrat
                  when 'l' then 'list'
                  when 'h' then 'hash'
                  when 'r' then 'range' end as partition_strategy,
             unnest(partattrs) column_index
         from
             pg_partitioned_table) pt
    join
        pg_class par
    on
        par.oid = pt.partrelid
    left join
        information_schema.columns col
    on
        col.table_schema = par.relnamespace::regnamespace::text
        and col.table_name = par.relname
        and ordinal_position = pt.column_index
     where par.relname='{table_name}' and  par.relnamespace::regnamespace::text='{schema_name}'
    """
)
