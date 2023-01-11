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
