#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from typing import Optional

from openmetadata.common.database import SupportedDataType
from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    register_custom_type,
)

register_custom_type(
    [
        "CHAR",
        "CHARACTER",
        "BPCHAR",
        "VARCHAR",
        "CHARACTER VARYING",
        "NVARCHAR",
        "TEXT",
    ],
    SupportedDataType.TEXT,
)

register_custom_type(
    [
        "SMALLINT",
        "INT2",
        "INTEGER",
        "INT",
        "INT4",
        "BIGINT",
        "INT8",
        "DECIMAL",
        "NUMERIC",
        "REAL",
        "FLOAT4",
        "DOUBLE PRECISION",
        "FLOAT8",
        "FLOAT",
    ],
    SupportedDataType.NUMERIC,
)

register_custom_type(
    [
        "DATE",
        "TIMESTAMP",
        "TIMESTAMP WITHOUT TIME ZONE",
        "TIMESTAMPTZ",
        "TIMESTAMP WITH TIME ZONE",
        "TIME",
        "TIME WITHOUT TIME ZONE",
        "TIMETZ",
        "TIME WITH TIME ZONE",
    ],
    SupportedDataType.TIME,
)


class RedshiftConnectionConfig(SQLConnectionConfig):
    scheme = "redshift+psycopg2"
    where_clause: Optional[str] = None
    duration: int = 1
    service_type = "Redshift"

    def get_connection_url(self):
        return super().get_connection_url()


class Redshift(DatabaseCommon):
    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = RedshiftConnectionConfig.parse_obj(config_dict)
        return cls(config)

    def qualify_regex(self, regex):
        return self.escape_metacharacters(regex)

    def sql_expr_avg(self, expr: str):
        return f"AVG({expr})"

    def sql_expr_sum(self, expr: str):
        return f"SUM({expr})"

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

    def sql_expr_cast_text_to_number(self, quoted_column_name, validity_format):
        if validity_format == "number_whole":
            return f"CAST({quoted_column_name} AS {self.data_type_decimal})"
        not_number_pattern = self.qualify_regex(r"[^-\d\.\,]")
        comma_pattern = self.qualify_regex(r"\,")
        return (
            f"CAST(REGEXP_REPLACE(REGEXP_REPLACE({quoted_column_name}, '{not_number_pattern}', ''), "
            f"'{comma_pattern}', '.') AS {self.data_type_decimal})"
        )
