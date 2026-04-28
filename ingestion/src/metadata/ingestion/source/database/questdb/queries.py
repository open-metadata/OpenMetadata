#  Copyright 2025 OpenMetadata
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
SQL queries used during QuestDB ingestion
"""
import textwrap

QUESTDB_GET_COLUMNS = "SELECT * FROM table_columns('{table_name}')"

QUESTDB_GET_TABLES = textwrap.dedent(
    """
    SELECT table_name, partitionBy, designatedTimestamp, table_type
    FROM tables()
    """
)

QUESTDB_GET_VIEW_DEFINITION = textwrap.dedent(
    """
    SELECT view_sql
    FROM views()
    WHERE view_name = :name
    """
)

QUESTDB_GET_MATERIALIZED_VIEWS = textwrap.dedent(
    """
    SELECT view_name, base_table_name, view_sql
    FROM materialized_views()
    """
)

QUESTDB_TEST_GET_TABLES = textwrap.dedent(
    """
    SELECT table_name FROM tables() LIMIT 1
    """
)

QUESTDB_TEST_GET_VIEWS = textwrap.dedent(
    """
    SELECT view_name FROM views() LIMIT 1
    """
)
