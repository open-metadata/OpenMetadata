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

from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_GET_SCHEMA_NAME


def get_filter_pattern_tuple(filter_pattern_name):
    filter_pattern = (
        str(tuple(filter_pattern_name))
        if len(filter_pattern_name) > 1
        else str(tuple(filter_pattern_name)).replace(",)", ")")
    )
    return filter_pattern


def get_schema_names_reflection(self, **kw):
    """Return all schema names."""

    if hasattr(self.dialect, "get_schema_names"):
        with self._operation_context() as conn:  # pylint: disable=protected-access
            return self.dialect.get_schema_names(conn, info_cache=self.info_cache, **kw)
    return []


def get_schema_names(self, connection, **kw):
    """Return all schema names."""
    if kw["filter_pattern"]:
        format_pattern = (
            f'WHERE schema_name LIKE ANY {get_filter_pattern_tuple(kw["filter_pattern"].includes)}'
            if kw["filter_pattern"].includes
            else f'WHERE schema_name NOT LIKE ANY {get_filter_pattern_tuple(kw["filter_pattern"].excludes)}'
        )
    query = BIGQUERY_GET_SCHEMA_NAME
    cursor = connection.execute(
        query.format(project_id=kw["project_id"], schema_filter=format_pattern)
        if kw.get("pushDownFilter") and kw["filter_pattern"]
        else query.format(project_id=kw["project_id"], schema_filter="")
    )
    result = [self.normalize_name(row[0]) for row in cursor]
    return result
