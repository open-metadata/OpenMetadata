from typing import Optional

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
    register_custom_type,
)
from openmetadata.profiler.profiler_metadata import SupportedDataType

register_custom_type(
    ["VARCHAR", "CHAR", "CHARACTER", "STRING", "TEXT"],
    SupportedDataType.TEXT,
)

register_custom_type(
    [
        "NUMBER",
        "INT",
        "INTEGER",
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        "BYTEINT",
        "FLOAT",
        "FLOAT4",
        "FLOAT8",
        "DOUBLE",
        "DOUBLE PRECISION",
        "REAL",
    ],
    SupportedDataType.NUMERIC,
)

register_custom_type(
    [
        "DATE",
        "DATETIME",
        "TIME",
        "TIMESTAMP",
        "TIMESTAMP_LTZ",
        "TIMESTAMP_NTZ",
        "TIMESTAMP_TZ",
    ],
    SupportedDataType.TIME,
)


class SnowflakeConnectionConfig(SQLConnectionConfig):
    scheme = "snowflake"
    account: str
    database: str  # database is required
    warehouse: Optional[str]
    role: Optional[str]
    duration: Optional[int]
    service_type = "Snowflake"

    def get_connection_url(self):
        connect_string = super().get_connection_url()
        options = {
            "account": self.account,
            "warehouse": self.warehouse,
            "role": self.role,
        }
        params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
        if params:
            connect_string = f"{connect_string}?{params}"
        return connect_string


class SnowflakeSQLExpressions(SQLExpressions):
    count_conditional_expr = "COUNT(CASE WHEN {} THEN 1 END) AS _"
    regex_like_pattern_expr = "{} regexp '{}'"


class Snowflake(DatabaseCommon):
    config: SnowflakeConnectionConfig = None
    sql_exprs: SnowflakeSQLExpressions = SnowflakeSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = SnowflakeConnectionConfig.parse_obj(config_dict)
        return cls(config)
