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

DATABRICKS_VIEW_DEFINITIONS = textwrap.dedent(
    """
    select
        TABLE_NAME as view_name,
        TABLE_SCHEMA as schema,
        VIEW_DEFINITION as view_def
    from INFORMATION_SCHEMA.VIEWS WHERE VIEW_DEFINITION IS NOT NULL
    """
)


DATABRICKS_GET_TABLE_COMMENTS = "DESCRIBE TABLE EXTENDED {schema_name}.{table_name}"

DATABRICKS_GET_CATALOGS = "SHOW CATALOGS"

DATABRICKS_GET_CATALOGS_TAGS = textwrap.dedent(
    """SELECT * FROM {database_name}.information_schema.catalog_tags;"""
)

DATABRICKS_GET_SCHEMA_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM {database_name}.information_schema.schema_tags"""
)

DATABRICKS_GET_TABLE_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM {database_name}.information_schema.table_tags 
    """
)

DATABRICKS_GET_COLUMN_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM {database_name}.information_schema.column_tags 
    """
)
