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
MySQL SQLAlchemy Helper Methods
"""
# pylint: disable=protected-access,too-many-branches,too-many-statements,too-many-locals
import textwrap

from metadata.ingestion.source.database.doris.queries import DORIS_VIEW_DEFINITIONS, DORIS_TABLE_COMMENTS
from sqlalchemy import sql
from sqlalchemy.engine import reflection
from metadata.utils.sqlalchemy_utils import get_view_definition_wrapper

query = textwrap.dedent(
    """
    select TABLE_NAME as name, `ENGINE` as engine
    from INFORMATION_SCHEMA.tables 
    """
)


@reflection.cache
def get_view_definition(
        self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=DORIS_VIEW_DEFINITIONS,
    )


def get_table_names_and_type(self, connection, schema=None, **kw):
    if schema:
        query_sql = query + f" WHERE TABLE_SCHEMA = '{schema}'"
    database = schema or connection.engine.url.database
    rows = connection.execute(query_sql, database=database)
    return [row for row in rows]


@reflection.cache
def get_table_comment(self, connection, table_name, schema=None, **kw):
    comment = None
    rows = connection.execute(sql.text(DORIS_TABLE_COMMENTS), {"table_name": table_name, "schema": schema})
    for TABLE_COMMENT in rows:
        comment = TABLE_COMMENT
        break
    return {"text": comment}
