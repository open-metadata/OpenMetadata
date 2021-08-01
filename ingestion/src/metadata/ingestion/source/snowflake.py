from typing import Optional

import snowflake.sqlalchemy
from snowflake.sqlalchemy import custom_types

from .sql_source import (
    BasicSQLAlchemyConfig,
    SQLAlchemySource,
    register_custom_type,
)
from ..ometa.auth_provider import MetadataServerConfig

register_custom_type(custom_types.TIMESTAMP_TZ, "TIME")
register_custom_type(custom_types.TIMESTAMP_LTZ, "TIME")
register_custom_type(custom_types.TIMESTAMP_NTZ, "TIME")


class SnowflakeConfig(BasicSQLAlchemyConfig):
    scheme = "snowflake"
    account: str
    database: str  # database is required
    warehouse: Optional[str]
    role: Optional[str]
    duration: Optional[int]

    def get_sql_alchemy_url(self):
        connect_string = super().get_sql_alchemy_url()
        options = {
            "account": self.account,
            "warehouse": self.warehouse,
            "role": self.role,
        }
        params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
        if params:
            connect_string = f"{connect_string}?{params}"
        return connect_string

    def get_identifier(self, schema: str, table: str) -> str:
        regular = super().get_identifier(schema, table)
        return f"{self.database}.{regular}"


class SnowflakeSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx, "snowflake")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SnowflakeConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
