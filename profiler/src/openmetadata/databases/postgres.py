#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import logging

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
    register_custom_type,
)

logger = logging.getLogger(__name__)


class PostgresConnectionConfig(SQLConnectionConfig):
    scheme = "postgres+psycopg2"

    def get_connection_url(self):
        return super().get_connection_url()


class PostgresSQLExpressions(SQLExpressions):
    regex_like_pattern_expr: str = "{} ~* '{}'"


class Postgres(DatabaseCommon):
    config: PostgresConnectionConfig = None
    sql_exprs: PostgresSQLExpressions = PostgresSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = PostgresConnectionConfig.parse_obj(config_dict)
        return cls(config)

    def table_metadata_query(self, table_name: str) -> str:
        sql = (
            f"SELECT column_name, data_type, is_nullable \n"
            f"FROM information_schema.columns \n"
            f"WHERE lower(table_name) = '{table_name}'"
        )
        if self.config.database:
            sql += f" \n  AND table_catalog = '{self.config.database}'"
        if self.config.db_schema:
            sql += f" \n  AND table_schema = '{self.config.db_schema}'"
        return sql

    def qualify_table_name(self, table_name: str) -> str:
        if self.config.db_schema:
            return f'"{self.config.db_schema}"."{table_name}"'
        return f'"{table_name}"'

    def qualify_column_name(self, column_name: str):
        return f'"{column_name}"'
