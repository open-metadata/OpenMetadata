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
    register_custom_type,
)

logger = logging.getLogger(__name__)


class PostgresConnectionConfig(SQLConnectionConfig):
    scheme = "postgres+psycopg2"

    def get_connection_url(self):
        return super().get_connection_url()


class Postgres(DatabaseCommon):
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
        if self.schema:
            return f'"{self.schema}"."{table_name}"'
        return f'"{table_name}"'

    def qualify_column_name(self, column_name: str):
        return f'"{column_name}"'

    def sql_expr_regexp_like(self, expr: str, pattern: str):
        return f"{expr} ~* '{self.qualify_regex(pattern)}'"

    def sql_expr_cast_text_to_number(self, quoted_column_name, validity_format):
        if validity_format == "number_whole":
            return f"CAST({quoted_column_name} AS {self.data_type_decimal})"
        not_number_pattern = self.qualify_regex(r"[^-\d\.\,]")
        comma_pattern = self.qualify_regex(r"\,")
        return (
            f"CAST(REGEXP_REPLACE(REGEXP_REPLACE({quoted_column_name}, '{not_number_pattern}', '', 'g'), "
            f"'{comma_pattern}', '.', 'g') AS {self.data_type_decimal})"
        )

    def get_type_name(self, column_description):
        return Postgres.type_names_by_type_code.get(str(column_description[1]))
