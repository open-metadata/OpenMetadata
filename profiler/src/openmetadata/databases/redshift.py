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

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
    register_custom_type,
)
from openmetadata.profiler.profiler_metadata import SupportedDataType

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


class RedshiftSQLExpressions(SQLExpressions):
    avg_expr = "AVG({})"
    sum_expr = "SUM({})"
    regex_like_pattern_expr: str = "{} ~* '{}'"


class Redshift(DatabaseCommon):
    config: RedshiftConnectionConfig = None
    sql_exprs: RedshiftSQLExpressions = RedshiftSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = RedshiftConnectionConfig.parse_obj(config_dict)
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
