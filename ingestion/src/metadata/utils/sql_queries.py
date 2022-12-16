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
  full_queries AS (
    SELECT
          query,
          LISTAGG(CASE WHEN LEN(RTRIM(text)) = 0 THEN text ELSE RTRIM(text) END, '')
            WITHIN GROUP (ORDER BY sequence) AS query_text
      FROM pg_catalog.stl_querytext
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
        q.aborted AS aborted
    FROM scans AS s
        INNER JOIN queries AS q
          ON s.query = q.query
        INNER JOIN full_queries AS fq
          ON s.query = fq.query
        INNER JOIN pg_catalog.pg_user AS u
          ON q.userid = u.usesysid
    ORDER BY q.endtime DESC
"""
)


REDSHIFT_GET_ALL_RELATION_INFO = textwrap.dedent(
    """
        SELECT
          c.relkind,
          n.oid as "schema_oid",
          n.nspname as "schema",
          c.oid as "rel_oid",
          c.relname,
          CASE c.reldiststyle
            WHEN 0 THEN 'EVEN' WHEN 1 THEN 'KEY' WHEN 8 THEN 'ALL' END
            AS "diststyle",
          c.relowner AS "owner_id",
          u.usename AS "owner_name",
          TRIM(TRAILING ';' FROM pg_catalog.pg_get_viewdef(c.oid, true))
            AS "view_definition",
          pg_catalog.array_to_string(c.relacl, '\n') AS "privileges"
        FROM pg_catalog.pg_class c
             LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_catalog.pg_user u ON u.usesysid = c.relowner
        WHERE c.relkind IN ('r', 'v', 'm', 'S', 'f')
          AND n.nspname !~ '^pg_'
        ORDER BY c.relkind, n.oid, n.nspname;
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

SNOWFLAKE_SQL_STATEMENT = textwrap.dedent(
    """
        SELECT
          query_type,
          query_text,
          user_name,
          database_name,
          schema_name,
          start_time,
          end_time
        from snowflake.account_usage.query_history
        WHERE query_text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
        AND query_text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
        AND start_time between to_timestamp_ltz('{start_time}') and to_timestamp_ltz('{end_time}')
        {filters}
        LIMIT {result_limit}
        """
)

SNOWFLAKE_SESSION_TAG_QUERY = 'ALTER SESSION SET QUERY_TAG="{query_tag}"'

NEO4J_AMUNDSEN_TABLE_QUERY = textwrap.dedent(
    """
        MATCH (db:Database)<-[:CLUSTER_OF]-(cluster:Cluster)
        <-[:SCHEMA_OF]-(schema:Schema)<-[:TABLE_OF]-(table:Table)
        OPTIONAL MATCH (table)-[:DESCRIPTION]->(table_description:Description)
        OPTIONAL MATCH (schema)-[:DESCRIPTION]->(schema_description:Description)
        OPTIONAL MATCH (table)-[:DESCRIPTION]->(prog_descs:Programmatic_Description)
        WITH db, cluster, schema, schema_description, table, table_description,
        COLLECT(prog_descs.description) as programmatic_descriptions
        OPTIONAL MATCH (table)-[:TAGGED_BY]->(tags:Tag) WHERE tags.tag_type='default'
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions,
        COLLECT(DISTINCT tags.key) as tags
        OPTIONAL MATCH (table)-[:HAS_BADGE]->(badges:Badge)
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions, tags,
        COLLECT(DISTINCT badges.key) as badges
        OPTIONAL MATCH (table)-[read:READ_BY]->(user:User)
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions, tags, badges,
        SUM(read.read_count) AS total_usage,
        COUNT(DISTINCT user.email) as unique_usage
        OPTIONAL MATCH (table)-[:COLUMN]->(col:Column)
        OPTIONAL MATCH (col)-[:DESCRIPTION]->(col_description:Description)
        WITH db, cluster, schema, schema_description, table, table_description, tags, badges, total_usage, unique_usage,
        programmatic_descriptions,
        COLLECT(col.name) AS column_names, COLLECT(col_description.description) AS column_descriptions,
        COLLECT(col.col_type) AS column_types
        OPTIONAL MATCH (table)-[:LAST_UPDATED_AT]->(time_stamp:Timestamp)
        RETURN db.name as database, cluster.name AS cluster, schema.name AS schema,
        schema_description.description AS schema_description,
        table.name AS name, table.key AS key, table_description.description AS description,
        time_stamp.last_updated_timestamp AS last_updated_timestamp,
        column_names,
        column_descriptions,
        column_types,
        total_usage,
        unique_usage,
        tags,
        badges,
        programmatic_descriptions
        ORDER BY table.name;
        """
)

NEO4J_AMUNDSEN_USER_QUERY = textwrap.dedent(
    """
        MATCH (user:User)
        OPTIONAL MATCH (user)-[read:READ]->(a)
        OPTIONAL MATCH (user)-[own:OWNER_OF]->(b)
        OPTIONAL MATCH (user)-[follow:FOLLOWED_BY]->(c)
        OPTIONAL MATCH (user)-[manage_by:MANAGE_BY]->(manager)
        with user, a, b, c, read, own, follow, manager
        where user.full_name is not null
        return user.email as email, user.first_name as first_name, user.last_name as last_name,
        user.full_name as full_name, user.github_username as github_username, user.team_name as team_name,
        user.employee_type as employee_type, manager.email as manager_email,
        user.slack_id as slack_id, user.is_active as is_active, user.role_name as role_name,
        REDUCE(sum_r = 0, r in COLLECT(DISTINCT read)| sum_r + r.read_count) AS total_read,
        COLLECT(DISTINCT b) as entities_owned,
        count(distinct b) as total_own,
        count(distinct c) AS total_follow
        order by user.email
        """
)

NEO4J_AMUNDSEN_DASHBOARD_QUERY = textwrap.dedent(
    """
         MATCH (dashboard:Dashboard)
         MATCH (dashboard)-[:DASHBOARD_OF]->(dbg:Dashboardgroup)
         MATCH (dbg)-[:DASHBOARD_GROUP_OF]->(cluster:Cluster)
         OPTIONAL MATCH (dashboard)-[:DESCRIPTION]->(db_descr:Description)
         OPTIONAL MATCH (dbg)-[:DESCRIPTION]->(dbg_descr:Description)
         OPTIONAL MATCH (dashboard)-[:EXECUTED]->(last_exec:Execution)
         WHERE split(last_exec.key, '/')[5] = '_last_successful_execution'
         OPTIONAL MATCH (dashboard)-[read:READ_BY]->(user:User)
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, SUM(read.read_count) AS total_usage
         OPTIONAL MATCH (dashboard)-[:HAS_QUERY]->(query:Query)-[:HAS_CHART]->(chart:Chart)
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, COLLECT(DISTINCT query.name) as query_names,
         COLLECT(chart.name) as chart_names,
         COLLECT(chart.id) as chart_ids,
         COLLECT(chart.url) as chart_urls,
         COLLECT(chart.type) as chart_types,
         total_usage
         OPTIONAL MATCH (dashboard)-[:TAGGED_BY]->(tags:Tag) WHERE tags.tag_type='default'
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, query_names, chart_names, chart_ids, chart_urls,
         chart_types, total_usage,
         COLLECT(DISTINCT tags.key) as tags
         OPTIONAL MATCH (dashboard)-[:HAS_BADGE]->(badges:Badge)
         WITH  dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, query_names, chart_names, chart_ids, chart_urls,
         chart_types, total_usage, tags,
         COLLECT(DISTINCT badges.key) as badges
         RETURN dbg.name as group_name, dashboard.name as name, cluster.name as cluster,
         coalesce(db_descr.description, '') as description,
         coalesce(dbg.description, '') as group_description, dbg.dashboard_group_url as group_url,
         dashboard.dashboard_id as dashboard_id,
         dashboard.dashboard_url as url, dashboard.key as uri,
         split(dashboard.key, '_')[0] as product, toInteger(last_exec.timestamp) as last_successful_run_timestamp,
         query_names, chart_names, chart_ids, chart_urls, chart_types, total_usage, tags, badges
         order by dbg.name
        """
)

VERTICA_GET_COLUMNS = textwrap.dedent(
    """
        SELECT column_name, data_type, column_default, is_nullable, comment
        FROM v_catalog.columns col left join v_catalog.comments com on col.table_id=com.object_id
        and com.object_type='COLUMN' and col.column_name=com.child_object
        WHERE lower(table_name) = '{table}'
        AND {schema_condition}
        UNION ALL
        SELECT column_name, data_type, '' as column_default, true as is_nullable, ''  as comment
        FROM v_catalog.view_columns
        WHERE lower(table_name) = '{table}'
        AND {schema_condition}
    """
)

VERTICA_GET_PRIMARY_KEYS = textwrap.dedent(
    """
        SELECT column_name
        FROM v_catalog.primary_keys
        WHERE lower(table_name) = '{table}'
        AND constraint_type = 'p'
        AND {schema_condition}
    """
)

VERTICA_VIEW_DEFINITION = textwrap.dedent(
    """
      SELECT VIEW_DEFINITION
      FROM V_CATALOG.VIEWS
      WHERE table_name='{view_name}'
      AND {schema_condition}
    """
)

MSSQL_SQL_STATEMENT = textwrap.dedent(
    """
      SELECT TOP {result_limit}
        db.NAME database_name,
        t.text query_text,
        s.last_execution_time start_time,
        DATEADD(s, s.total_elapsed_time/1000, s.last_execution_time) end_time,
        NULL schema_name,
        NULL query_type,
        NULL user_name,
        NULL aborted
      FROM sys.dm_exec_cached_plans AS p
      INNER JOIN sys.dm_exec_query_stats AS s
        ON p.plan_handle = s.plan_handle
      CROSS APPLY sys.Dm_exec_sql_text(p.plan_handle) AS t
      INNER JOIN sys.databases db
        ON db.database_id = t.dbid
      WHERE s.last_execution_time between '{start_time}' and '{end_time}'
          AND t.text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
          AND t.text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
          AND p.objtype != 'Prepared'
          {filters}
      ORDER BY s.last_execution_time DESC
"""
)

CLICKHOUSE_SQL_STATEMENT = textwrap.dedent(
    """
        Select
          query_start_time start_time,
          DATEADD(query_duration_ms, query_start_time) end_time,
          'default' database_name,
          user user_name,
          FALSE aborted,
          query_id query_id,
          query query_text,
          databases schema_name,
          tables tables
        From system.query_log
        Where start_time between '{start_time}' and '{end_time}'
        and CAST(type,'Int8') <> 3
        and CAST(type,'Int8') <> 4
        and query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
        and query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
        {filters}
        and (`type`='QueryFinish' or `type`='QueryStart')
        LIMIT {result_limit}
"""
)


SNOWFLAKE_FETCH_ALL_TAGS = textwrap.dedent(
    """
    select TAG_NAME, TAG_VALUE, OBJECT_DATABASE, OBJECT_SCHEMA, OBJECT_NAME, COLUMN_NAME
    from snowflake.account_usage.tag_references
    where OBJECT_DATABASE = '{database_name}'
      and OBJECT_SCHEMA = '{schema_name}'
"""
)


SNOWFLAKE_GET_TABLE_NAMES = """
select TABLE_NAME from information_schema.tables where TABLE_SCHEMA = '{}' and TABLE_TYPE = 'BASE TABLE'
"""

SNOWFLAKE_GET_VIEW_NAMES = """
select TABLE_NAME from information_schema.tables where TABLE_SCHEMA = '{}' and TABLE_TYPE = 'VIEW'
"""

SNOWFLAKE_GET_COMMENTS = textwrap.dedent(
    """
    select COMMENT
    from information_schema.TABLES
    WHERE TABLE_SCHEMA = '{schema_name}'
      AND TABLE_NAME = '{table_name}'
"""
)

BIGQUERY_STATEMENT = textwrap.dedent(
    """
 SELECT
   project_id as database_name,
   user_email as user_name,
   statement_type as query_type,
   start_time,
   end_time,
   query as query_text,
   null as schema_name
FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time BETWEEN "{start_time}" AND "{end_time}"
  {filters}
  AND job_type = "QUERY"
  AND state = "DONE"
  AND IFNULL(statement_type, "NO") not in ("NO", "DROP_TABLE", "CREATE_TABLE")
  AND query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
  AND query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
  LIMIT {result_limit}
"""
)

POSTGRES_SQL_STATEMENT = textwrap.dedent(
    """
      SELECT
        u.usename,
        d.datname database_name,
        s.query query_text,
        s.total_exec_time
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

POSTGRES_GET_TABLE_NAMES = """
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = :schema AND c.relkind in ('r', 'p') AND relispartition = false
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

SNOWFLAKE_GET_CLUSTER_KEY = """
  select CLUSTERING_KEY,
          TABLE_SCHEMA,
          TABLE_NAME
  from   information_schema.tables 
  where  TABLE_TYPE = 'BASE TABLE'
  and CLUSTERING_KEY is not null
"""


REDSHIFT_PARTITION_DETAILS = """
  select "schema", "table", diststyle
  from SVV_TABLE_INFO
  where diststyle not like 'AUTO%%'
"""


HIVE_GET_COMMENTS = textwrap.dedent(
    """
    describe formatted {schema_name}.{table_name}
"""
)
