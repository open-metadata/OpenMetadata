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

from metadata.ingestion.source.database.starrocks.queries import (
    STARROCKS_TABLE_COMMENTS,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
query = textwrap.dedent(
    """
    select TABLE_NAME as name,
           case when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'VIEW' then 'MVIEW'
                when `ENGINE` = 'MEMORY' and TABLE_TYPE = 'SYSTEM VIEW' then 'VIEW'
                when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'TABLE' then 'TABLE'
                when `ENGINE` = '' and TABLE_TYPE = 'VIEW' then 'VIEW'
                else `ENGINE`
           end as engine
    from INFORMATION_SCHEMA.tables 
    """
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
        sql.text(STARROCKS_TABLE_COMMENTS),
        {"table_name": table_name, "schema": schema},
        **kw,
    )
    for table_comment in rows:
        comment = table_comment
        break
    return {"text": comment}
