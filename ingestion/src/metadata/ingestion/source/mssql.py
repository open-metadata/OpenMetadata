# This import verifies that the dependencies are available.
import sqlalchemy_pytds  # noqa: F401

from .sql_source import BasicSQLAlchemyConfig, SQLAlchemySource
from ..ometa.auth_provider import MetadataServerConfig


class SQLServerConfig(BasicSQLAlchemyConfig):
    host_port = "localhost:1433"
    scheme = "mssql+pytds"

    def get_identifier(self, schema: str, table: str) -> str:
        regular = f"{schema}.{table}"
        if self.database:
            return f"{self.database}.{regular}"
        return regular


class SQLServerSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx, "mssql")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SQLServerConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
