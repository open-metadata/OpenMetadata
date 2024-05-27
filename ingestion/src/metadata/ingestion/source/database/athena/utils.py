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
Module to define overriden dialect methods
"""

from metadata.ingestion.source.database.athena.queries import (
    ATHENA_SHOW_CREATE_TABLE_QUERY,
)


def get_table_ddl(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    Gets the Athena DB Table DDL
    """

    schema = schema or self.default_schema_name
    table_name = f"{schema}.{table_name}" if schema else table_name
    cursor = connection.execute(
        ATHENA_SHOW_CREATE_TABLE_QUERY.format(schema_name=schema, table_name=table_name)
    )
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None
