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

UNITY_CATALOG_GET_CATALOGS_TAGS = """
SELECT * FROM `{database}`.information_schema.catalog_tags;
"""

UNITY_CATALOG_GET_ALL_SCHEMA_TAGS = """
SELECT * FROM `{database}`.information_schema.schema_tags;
"""

UNITY_CATALOG_GET_ALL_TABLE_TAGS = """
SELECT * FROM `{database}`.information_schema.table_tags WHERE schema_name = '{schema}';
"""

UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS = """
SELECT * FROM `{database}`.information_schema.column_tags WHERE schema_name = '{schema}';
"""

UNITY_CATALOG_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
      statement_type AS query_type,
      statement_text AS query_text,
      executed_by AS user_name,
      start_time AS start_time,
      null AS database_name,
      null AS schema_name,
      end_time AS end_time,
      total_duration_ms/1000 AS duration
    from system.query.history
    WHERE statement_text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND statement_text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND start_time between to_timestamp('{start_time}') and to_timestamp('{end_time}')
    {filters}
    LIMIT {result_limit}
    """
)

UNITY_CATALOG_GET_TABLE_DDL = "SHOW CREATE TABLE `{database}`.`{schema}`.`{table}`"

UNITY_CATALOG_QUERY_HISTORY_PROBE = textwrap.dedent(
    """
    SELECT lineage.statement_id, history.statement_text
    FROM system.access.table_lineage lineage
    JOIN system.query.history history
        ON lineage.statement_id = history.statement_id
        AND lineage.workspace_id = history.workspace_id
    WHERE 1=0
    """
)

UNITY_CATALOG_NATIVE_LINEAGE = textwrap.dedent(
    """
    WITH table_edges AS (
        SELECT
            source_table_full_name,
            source_path,
            target_table_full_name,
            target_path{statement_columns}
        FROM system.access.table_lineage
        WHERE event_date >= current_date() - INTERVAL {query_log_duration} DAYS
            AND event_time >= current_date() - INTERVAL {query_log_duration} DAYS
            AND (source_table_full_name IS NOT NULL OR source_path IS NOT NULL)
            AND (target_table_full_name IS NOT NULL OR target_path IS NOT NULL)
        GROUP BY source_table_full_name, source_path, target_table_full_name, target_path
    ),
    column_edges AS (
        SELECT
            source_table_full_name,
            source_path,
            target_table_full_name,
            target_path,
            to_json(collect_set(struct(source_column_name AS source, target_column_name AS target)))
                AS column_pairs
        FROM system.access.column_lineage
        WHERE event_date >= current_date() - INTERVAL {query_log_duration} DAYS
            AND event_time >= current_date() - INTERVAL {query_log_duration} DAYS
            AND (source_table_full_name IS NOT NULL OR source_path IS NOT NULL)
            AND (target_table_full_name IS NOT NULL OR target_path IS NOT NULL)
            AND source_column_name IS NOT NULL
            AND target_column_name IS NOT NULL
        GROUP BY source_table_full_name, source_path, target_table_full_name, target_path
    )
    SELECT
        table_edges.source_table_full_name,
        table_edges.source_path,
        table_edges.target_table_full_name,
        table_edges.target_path,
        column_edges.column_pairs,
        {statement_text} AS statement_text
    FROM table_edges
    LEFT JOIN column_edges
        ON table_edges.source_table_full_name <=> column_edges.source_table_full_name
        AND table_edges.source_path <=> column_edges.source_path
        AND table_edges.target_table_full_name <=> column_edges.target_table_full_name
        AND table_edges.target_path <=> column_edges.target_path{history_join}
    ORDER BY table_edges.target_table_full_name, table_edges.target_path
    """
)

# The pair a lineage row belongs to is `event_time`'s latest statement, kept as one
# struct so both halves of the query.history key come from the same row.
UNITY_CATALOG_LATEST_STATEMENT_COLUMNS = (
    ",\n        max_by("
    "struct(statement_id AS statement_id, workspace_id AS workspace_id), event_time"
    ") AS latest_statement"
)

UNITY_CATALOG_QUERY_HISTORY_JOIN = textwrap.dedent(
    """
    LEFT JOIN system.query.history history
        ON history.statement_id = table_edges.latest_statement.statement_id
        AND history.workspace_id = table_edges.latest_statement.workspace_id
        AND history.start_time >= current_date() - INTERVAL {history_lookback} DAYS
        AND history.statement_text IS NOT NULL
        AND TRIM(history.statement_text) <> ''
        AND UPPER(TRIM(history.statement_text)) <> '<REDACTED>'
    """
).rstrip()


def unity_catalog_native_lineage_query(query_log_duration: int, include_query_history: bool) -> str:
    """
    Table edges, their column mappings and the statement that wrote them, in one query.

    Column mappings are aggregated into a JSON array per edge so the second result set
    they used to arrive in is no longer needed, and the statement is joined here rather
    than looked up per batch of edges, which re-scanned the lineage window each time.

    Ordered by target so the rows of one target arrive together and the reader can emit
    them and move on, instead of holding every edge of the catalog to group them.

    `include_query_history` is False when `system.query.history` cannot be read: the
    statement columns and the join are then left out entirely so a missing grant costs
    the SQL text rather than all of the lineage.
    """
    if not include_query_history:
        return UNITY_CATALOG_NATIVE_LINEAGE.format(
            query_log_duration=query_log_duration,
            statement_columns="",
            statement_text="CAST(NULL AS STRING)",
            history_join="",
        )
    return UNITY_CATALOG_NATIVE_LINEAGE.format(
        query_log_duration=query_log_duration,
        statement_columns=UNITY_CATALOG_LATEST_STATEMENT_COLUMNS,
        statement_text="history.statement_text",
        # A statement that ran just before midnight of the oldest lineage day is still
        # the one that wrote the edge, so history reaches back one day further.
        history_join=UNITY_CATALOG_QUERY_HISTORY_JOIN.format(history_lookback=query_log_duration + 1),
    )


UNITY_CATALOG_EXTERNAL_TABLES = textwrap.dedent(
    """
    SELECT
        table_catalog,
        table_schema,
        table_name,
        storage_path
    FROM system.information_schema.tables
    WHERE table_type = 'EXTERNAL'
        AND storage_path IS NOT NULL
    """
)

UNITY_CATALOG_GET_CHANGED_TABLES = textwrap.dedent(
    """
    SELECT
        table_schema,
        table_name
    FROM `{catalog}`.information_schema.tables
    WHERE last_altered >= timestamp_millis({start_timestamp})
    """
)

UNITY_CATALOG_GET_DELETED_TABLES = textwrap.dedent(
    """
    SELECT DISTINCT request_params.full_name_arg AS table_full_name
    FROM system.access.audit
    WHERE service_name = 'unityCatalog'
        AND action_name = 'deleteTable'
        AND event_date >= date(timestamp_millis({start_timestamp}))
        AND event_time >= timestamp_millis({start_timestamp})
        AND substring_index(request_params.full_name_arg, '.', 1) = '{catalog}'
    """
)

UNITY_CATALOG_TEST_TABLE_LINEAGE = textwrap.dedent(
    """
    SELECT COUNT(*) as count
    FROM system.access.table_lineage
    WHERE 1=0
    """
)

UNITY_CATALOG_TEST_COLUMN_LINEAGE = textwrap.dedent(
    """
    SELECT COUNT(*) as count
    FROM system.access.column_lineage
    WHERE 1=0
    """
)

UNITY_CATALOG_TABLE_CONSTRAINTS = textwrap.dedent(
    """
    SELECT DISTINCT table_catalog, table_schema, table_name
    FROM system.information_schema.table_constraints
    WHERE 1=1
    """
)

UNITY_CATALOG_GET_ALL_SCHEMAS = """
SELECT catalog_name, schema_name FROM system.information_schema.schemata
"""
