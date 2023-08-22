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
Utils module to define overrided sqlalchamy methods 
"""
# pylint: disable=protected-access,unused-argument


from sqlalchemy import text


def get_mview_names(self, schema=None):
    """Return all materialized view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_mview_names(conn, schema, info_cache=self.info_cache)


def get_mview_names_dialect(self, connection, schema=None, **kw):
    query = text(
        "SELECT name FROM system.tables WHERE engine = 'MaterializedView' "
        "AND database = :database"
    )
    database = schema or connection.engine.url.database
    rows = self._execute(connection, query, database=database)
    return [row.name for row in rows]


def get_mview_definition(self, mview_name, schema=None):
    """Return definition for `mview_name`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_view_definition(
            conn, mview_name, schema, info_cache=self.info_cache
        )
