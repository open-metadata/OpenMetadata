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
Hive Metastore Dialect Mixin
"""

from sqlalchemy import text
from sqlalchemy.engine import Connection, reflection

from metadata.ingestion.source.database.hive.utils import get_columns
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)


# pylint: disable=unused-argument
class HiveMetaStoreDialectMixin:
    """
    Mixin class
    """

    # Every backend quotes metastore identifiers differently, so each dialect brings its own copy.
    table_providers_query: str

    def get_table_providers(self, connection: Connection, schema: str) -> dict[str, str | None]:
        """Map table name to its `spark.sql.sources.provider` for one schema.

        Spark, Databricks and Trino all register a Delta table in the Hive metastore by writing
        that provider into TABLE_PARAMS, so one query per schema types every Delta table in it.
        The value is optional because TABLE_PARAMS.PARAM_VALUE is nullable in the metastore DDL.
        """
        rows = connection.execute(text(self.table_providers_query), {"schema_name": schema})
        return {row[0]: row[1] for row in rows}

    def get_columns(self, connection, table_name, schema=None, **kw):
        return get_columns(self, connection, table_name, schema, **kw)

    def get_foreign_keys(self, connection, table_name, schema=None, **kw):
        # Hive has no support for foreign keys.
        return []

    def get_unique_constraints(self, connection, table_name, schema=None, **kw):
        # Hive has no support for unique keys.
        return []

    def get_pk_constraint(self, connection, table_name, schema=None, **kw):
        # Hive has no support for primary keys.
        return []

    @reflection.cache
    def get_all_view_definitions(self, connection, query):
        get_all_view_definitions(self, connection, query)

    @reflection.cache
    def get_all_table_comments(self, connection, query):
        get_all_table_comments(self, connection, query)
