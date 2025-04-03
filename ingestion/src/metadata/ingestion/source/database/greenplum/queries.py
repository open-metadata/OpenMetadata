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

import textwrap

# https://www.postgresql.org/docs/current/catalog-pg-class.html
# r = ordinary table, v = view, m = materialized view, c = composite type, f = foreign table, p = partitioned table,
GREENPLUM_GET_TABLE_NAMES = """
    select c.relname, c.relkind
    from pg_catalog.pg_class c
        left outer join pg_catalog.pg_partition_rule pr on c.oid = pr.parchildrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'f')
        and pr.oid is null
        and n.nspname = :schema
"""

GREENPLUM_PARTITION_DETAILS = textwrap.dedent(
    """
    select
        ns.nspname as schema,
        par.relname as table_name,
        partition_strategy,
        col.column_name
    from
        (select
             parrelid,
             parnatts,
             case parkind
                  when 'l' then 'list'
                  when 'h' then 'hash'
                  when 'r' then 'range' end as partition_strategy,
             unnest(paratts) column_index
         from
             pg_catalog.pg_partition) pt
    join
        pg_class par
    on
        par.oid = pt.parrelid
    left join
        pg_catalog.pg_namespace ns on par.relnamespace = ns.oid
    left join
        information_schema.columns col
    on
        col.table_schema = ns.nspname
        and col.table_name = par.relname
        and ordinal_position = pt.column_index
    where par.relname='{table_name}' and  ns.nspname='{schema_name}'
    """
)

GREENPLUM_TABLE_COMMENTS = """
    SELECT n.nspname as schema,
            c.relname as table_name,
            pgd.description as table_comment
    FROM pg_catalog.pg_class c
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objsubid = 0 AND pgd.objoid = c.oid
    WHERE c.relkind in ('r', 'v', 'm', 'f', 'p')
      AND pgd.description IS NOT NULL
      AND n.nspname <> 'pg_catalog'
    ORDER BY "schema", "table_name"
"""

# Postgres\Greenplum views definitions only contains the select query
# hence we are appending "create view <schema>.<table> as " to select query
# to generate the column level lineage
GREENPLUM_VIEW_DEFINITIONS = """
SELECT 
	n.nspname "schema",
	c.relname view_name,
	'create view ' || n.nspname || '.' || c.relname || ' as ' || pg_get_viewdef(c.oid,true) view_def
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE c.relkind IN ('v', 'm')
AND n.nspname not in ('pg_catalog','information_schema')
"""

GREENPLUM_GET_DATABASE = """
select datname from pg_catalog.pg_database
"""

GREENPLUM_GET_DB_NAMES = """
select datname from pg_catalog.pg_database
"""

GREENPLUM_COL_IDENTITY = """\
  (SELECT json_build_object(
      'always', a.attidentity = 'a',
      'start', s.seqstart,
      'increment', s.seqincrement,
      'minvalue', s.seqmin,
      'maxvalue', s.seqmax,
      'cache', s.seqcache,
      'cycle', s.seqcycle)
  FROM pg_catalog.pg_sequence s
  JOIN pg_catalog.pg_class c on s.seqrelid = c."oid"
  WHERE c.relkind = 'S'
  AND a.attidentity != ''
  AND s.seqrelid = pg_catalog.pg_get_serial_sequence(
      a.attrelid::regclass::text, a.attname
  )::regclass::oid
  ) as identity_options\
"""

GREENPLUM_SQL_COLUMNS = """
        SELECT a.attname,
            pg_catalog.format_type(a.atttypid, a.atttypmod),
            (
            SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
            FROM pg_catalog.pg_attrdef d
            WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
            AND a.atthasdef
            ) AS DEFAULT,
            a.attnotnull,
            a.attrelid as table_oid,
            pgd.description as comment,
            {generated},
            {identity}
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_description pgd ON (
            pgd.objoid = a.attrelid AND pgd.objsubid = a.attnum)
        WHERE a.attrelid = :table_oid
        AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
    """

GREENPLUM_GET_SERVER_VERSION = """
show server_version
"""
