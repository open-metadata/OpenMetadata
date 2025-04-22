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
MySQL SQLAlchemy Helper Methods
"""
import textwrap

from sqlalchemy import sql
from sqlalchemy.engine import reflection

from metadata.ingestion.source.database.doris.queries import (
    DORIS_TABLE_COMMENTS,
    DORIS_VIEW_DEFINITIONS,
)
from metadata.utils.sqlalchemy_utils import get_view_definition_wrapper

query = textwrap.dedent(
    """
    select TABLE_NAME as name, `ENGINE` as engine
    from INFORMATION_SCHEMA.tables 
    """
)


@reflection.cache
def get_view_definition(self, connection, table_name, schema=None):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=DORIS_VIEW_DEFINITIONS,
    )


def get_table_names_and_type(_, connection, schema=None, **kw):
    if schema:
        query_sql = query + f" WHERE TABLE_SCHEMA = '{schema}'"
    database = schema or connection.engine.url.database
    rows = connection.execute(query_sql, database=database, **kw)
    return list(rows)


@reflection.cache
def get_table_comment(_, connection, table_name, schema=None, **kw):
    comment = None
    rows = connection.execute(
        sql.text(DORIS_TABLE_COMMENTS),
        {"table_name": table_name, "schema": schema},
        **kw,
    )
    for table_comment in rows:
        comment = table_comment
        break
    return {"text": comment}
