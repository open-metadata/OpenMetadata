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
Hive Metastore Postgres Dialect Mixin
"""
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy.engine import reflection

from metadata.ingestion.source.database.hive.metastore_dialects.mixin import (
    HiveMetaStoreDialectMixin,
)
from metadata.utils.sqlalchemy_utils import (
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)


# pylint: disable=abstract-method
class HivePostgresMetaStoreDialect(HiveMetaStoreDialectMixin, PGDialect_psycopg2):
    """
    Postgres metastore dialect class
    """

    name = "hive"
    driver = "postgres"
    supports_statement_cache = False

    def get_schema_names(self, connection, **kw):
        # Equivalent to SHOW DATABASES
        return [row[0] for row in connection.execute('select "NAME" from "DBS";')]

    # pylint: disable=arguments-differ
    def get_view_names(self, connection, schema=None, **kw):
        # Hive does not provide functionality to query tableType
        # This allows reflection to not crash at the cost of being inaccurate
        query = self._get_table_names_base_query(schema=schema)
        query += """ WHERE "TBL_TYPE" = 'VIRTUAL_VIEW'"""
        return [row[0] for row in connection.execute(query)]

    def _get_table_columns(self, connection, table_name, schema):
        query = f"""
            SELECT 
                col."COLUMN_NAME", 
                col."TYPE_NAME",
                col."COMMENT"
            from 
                "COLUMNS_V2" col 
                join "CDS" cds ON col."CD_ID" = cds."CD_ID" 
                join "SDS" sds ON sds."CD_ID" = cds."CD_ID" 
                join "TBLS" tbsl on sds."SD_ID" = tbsl."SD_ID" 
                and tbsl."TBL_NAME" = '{table_name}'
        """
        if schema:
            query += f""" join "DBS" db on tbsl."DB_ID" = db."DB_ID"
            and db."NAME" = '{schema}'"""

        return connection.execute(query).fetchall()

    def _get_table_names_base_query(self, schema=None):
        query = 'SELECT "TBL_NAME" from "TBLS" tbl'
        if schema:
            query += f""" JOIN "DBS" db on tbl."DB_ID" = db."DB_ID"
            and db."NAME" = '{schema}'"""
        return query

    def get_table_names(self, connection, schema=None, **kw):
        query = self._get_table_names_base_query(schema=schema)
        query += """ WHERE "TBL_TYPE" != 'VIRTUAL_VIEW'"""
        return [row[0] for row in connection.execute(query)]

    @reflection.cache
    def get_view_definition(self, connection, view_name, schema=None, **kw):
        query = """
            SELECT 
                dbs."NAME" "schema", 
                tbls."TBL_NAME" view_name, 
                tbls."VIEW_ORIGINAL_TEXT" view_def
            from 
                "TBLS" tbls 
                JOIN "DBS" dbs on tbls."DB_ID" = dbs."DB_ID" 
            where 
                tbls."VIEW_ORIGINAL_TEXT" is not null;
        """
        return get_view_definition_wrapper(
            self,
            connection,
            table_name=view_name,
            schema=schema,
            query=query,
        )

    @reflection.cache
    def get_table_comment(self, connection, table_name, schema=None, **kw):
        query = """
            SELECT 
                "DBS"."NAME" AS "schema", 
                "TBLS"."TBL_NAME" AS table_name, 
                "TABLE_PARAMS"."PARAM_VALUE" AS table_comment 
            FROM 
                "DBS" 
            JOIN 
                "TBLS" ON "DBS"."DB_ID" = "TBLS"."DB_ID" 
                LEFT JOIN "TABLE_PARAMS" ON "TBLS"."TBL_ID" = "TABLE_PARAMS"."TBL_ID" 
                and "TABLE_PARAMS"."PARAM_KEY" = 'comment'
        """
        return get_table_comment_wrapper(
            self,
            connection,
            table_name=table_name,
            schema=schema,
            query=query,
        )

    # pylint: disable=arguments-renamed
    def get_dialect_cls(self):
        return HivePostgresMetaStoreDialect
