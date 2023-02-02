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

# Not able to use SYS_QUERY_HISTORY here. Few users not getting any results
REDSHIFT_SQL_STATEMENT = textwrap.dedent(
    """
  WITH
  queries AS (
    SELECT *
      FROM pg_catalog.stl_query
     WHERE userid > 1
          {filters}
          -- Filter out all automated & cursor queries
          AND querytxt NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
          AND querytxt NOT LIKE '/* {{"app": "dbt", %%}} */%%'
          AND aborted = 0
          AND starttime >= '{start_time}'
          AND starttime < '{end_time}'
          LIMIT {result_limit}
  ),
  deduped_querytext AS (
    -- Sometimes rows are duplicated, causing LISTAGG to fail in the full_queries CTE.
    SELECT DISTINCT qt.*
    FROM pg_catalog.stl_querytext AS qt
        INNER JOIN queries AS q
            ON qt.query = q.query
  ),
  full_queries AS (
    SELECT
          query,
          LISTAGG(CASE WHEN LEN(RTRIM(text)) = 0 THEN text ELSE RTRIM(text) END, '')
            WITHIN GROUP (ORDER BY sequence) AS query_text
      FROM deduped_querytext
      WHERE sequence < 327	-- each chunk contains up to 200, RS has a maximum str length of 65535.
    GROUP BY query
  ),
  raw_scans AS (
    -- We have one row per table per slice so we need to get rid of the dupes
    SELECT distinct query, tbl
      FROM pg_catalog.stl_scan
  ),
  scans AS (
  	SELECT DISTINCT
  		query,
  		sti.database AS database_name,
      sti.schema AS schema_name
  	  FROM raw_scans AS s
          INNER JOIN pg_catalog.svv_table_info AS sti
            ON (s.tbl)::oid = sti.table_id
  )
  SELECT DISTINCT
        q.userid,
        s.query AS query_id,
        RTRIM(u.usename) AS user_name,
        fq.query_text,
        s.database_name,
        s.schema_name,
        q.starttime AS start_time,
        q.endtime AS end_time,
        datediff(second,q.starttime,q.endtime) AS duration,
        q.aborted AS aborted
    FROM scans AS s
        INNER JOIN queries AS q
          ON s.query = q.query
        INNER JOIN full_queries AS fq
          ON s.query = fq.query
        INNER JOIN pg_catalog.pg_user AS u
          ON q.userid = u.usesysid
    WHERE
        {db_filters}
    ORDER BY q.endtime DESC
"""
)


REDSHIFT_GET_ALL_RELATION_INFO = textwrap.dedent(
    """
    SELECT
      c.relname as name,
      c.relkind
    FROM pg_catalog.pg_class c
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = :schema
    UNION
    SELECT
        tablename as name,
        'e' as relkind
    FROM svv_external_tables
    WHERE schemaname = :schema;
    """
)


REDSHIFT_GET_SCHEMA_COLUMN_INFO = textwrap.dedent(
    """
            SELECT
              n.nspname as "schema",
              c.relname as "table_name",
              att.attname as "name",
              format_encoding(att.attencodingtype::integer) as "encode",
              format_type(att.atttypid, att.atttypmod) as "type",
              att.attisdistkey as "distkey",
              att.attsortkeyord as "sortkey",
              att.attnotnull as "notnull",
              pg_catalog.col_description(att.attrelid, att.attnum)
                as "comment",
              adsrc,
              attnum,
              pg_catalog.format_type(att.atttypid, att.atttypmod),
              pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS DEFAULT,
              n.oid as "schema_oid",
              c.oid as "table_oid"
            FROM pg_catalog.pg_class c
            LEFT JOIN pg_catalog.pg_namespace n
              ON n.oid = c.relnamespace
            JOIN pg_catalog.pg_attribute att
              ON att.attrelid = c.oid
            LEFT JOIN pg_catalog.pg_attrdef ad
              ON (att.attrelid, att.attnum) = (ad.adrelid, ad.adnum)
            WHERE n.nspname !~ '^pg_'
              AND att.attnum > 0
              AND NOT att.attisdropped
              {schema_clause}
            UNION
            SELECT
              view_schema as "schema",
              view_name as "table_name",
              col_name as "name",
              null as "encode",
              col_type as "type",
              null as "distkey",
              0 as "sortkey",
              null as "notnull",
              null as "comment",
              null as "adsrc",
              null as "attnum",
              col_type as "format_type",
              null as "default",
              null as "schema_oid",
              null as "table_oid"
            FROM pg_get_late_binding_view_cols() cols(
              view_schema name,
              view_name name,
              col_name name,
              col_type varchar,
              col_num int)
            WHERE 1 {schema_clause}
            UNION
            SELECT schemaname AS "schema",
               tablename AS "table_name",
               columnname AS "name",
               null AS "encode",
               -- Spectrum represents data types differently.
               -- Standardize, so we can infer types.
               CASE
                 WHEN external_type = 'int' THEN 'integer'
                 ELSE
                   replace(
                    replace(external_type, 'decimal', 'numeric'),
                    'varchar', 'character varying')
                 END
                    AS "type",
               null AS "distkey",
               0 AS "sortkey",
               null AS "notnull",
               null AS "comment",
               null AS "adsrc",
               null AS "attnum",
               CASE
                 WHEN external_type = 'int' THEN 'integer'
                 ELSE
                   replace(
                    replace(external_type, 'decimal', 'numeric'),
                    'varchar', 'character varying')
                 END
                    AS "format_type",
               null AS "default",
               null AS "schema_oid",
               null AS "table_oid"
            FROM svv_external_columns
            ORDER BY "schema", "table_name", "attnum";
            """
)


REDSHIFT_PARTITION_DETAILS = """
  select "schema", "table", diststyle
  from SVV_TABLE_INFO
  where diststyle not like 'AUTO%%'
"""


REDSHIFT_TABLE_COMMENTS = """
    SELECT n.nspname as schema,
            c.relname as table_name,
            pgd.description as table_comment
    FROM pg_catalog.pg_class c
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objsubid = 0 AND pgd.objoid = c.oid
    WHERE c.relkind in ('r', 'v', 'm', 'f', 'p')
      AND pgd.description IS NOT NULL
      AND n.nspname <> 'pg_catalog'
    ORDER BY "schema", "table_name";
"""
