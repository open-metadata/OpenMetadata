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

SNOWFLAKE_GET_CLUSTER_KEY = """
  select CLUSTERING_KEY,
          TABLE_SCHEMA,
          TABLE_NAME
  from   information_schema.tables 
  where  TABLE_TYPE = 'BASE TABLE'
  and CLUSTERING_KEY is not null
"""


HIVE_GET_COMMENTS = textwrap.dedent(
    """
    describe formatted {schema_name}.{table_name}
"""
)
