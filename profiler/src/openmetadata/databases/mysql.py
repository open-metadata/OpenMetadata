from typing import Optional

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
    register_custom_type,
)
from openmetadata.profiler.profiler_metadata import SupportedDataType

register_custom_type(
    ["CHAR", "VARCHAR", "BINARY", "VARBINARY", "BLOB", "TEXT", "ENUM", "SET"],
    SupportedDataType.TEXT,
)

register_custom_type(
    [
        "INTEGER",
        "INT",
        "SMALLINT",
        "TINYINT",
        "MEDIUMINT",
        "BIGINT",
        "DECIMAL",
        "NUMERIC",
        "FLOAT",
        "DOUBLE",
        "REAL",
        "DOUBLE PRECISION",
        "DEC",
        "FIXED",
    ],
    SupportedDataType.NUMERIC,
)

register_custom_type(
    ["TIMESTAMP", "DATE", "DATETIME", "YEAR", "TIME"],
    SupportedDataType.TIME,
)


class MySQLConnectionConfig(SQLConnectionConfig):
    host_port = "localhost:3306"
    scheme = "mysql+pymysql"
    service_type = "MySQL"

    def get_connection_url(self):
        return super().get_connection_url()


class MySQLExpressions(SQLExpressions):
    count_conditional_expr = "COUNT(CASE WHEN {} THEN 1 END) AS _"
    regex_like_pattern_expr = "{} regexp '{}'"


class MySQL(DatabaseCommon):
    config: MySQLConnectionConfig = None
    sql_exprs: MySQLExpressions = MySQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = MySQLConnectionConfig.parse_obj(config_dict)
        return cls(config)

    def table_metadata_query(self, table_name: str) -> str:
        sql = (
            f"SELECT column_name, data_type, is_nullable \n"
            f"FROM information_schema.columns \n"
            f"WHERE lower(table_name) = '{table_name}'"
        )
        if self.config.database:
            sql += f" \n  AND table_schema = '{self.database}'"
        return sql
