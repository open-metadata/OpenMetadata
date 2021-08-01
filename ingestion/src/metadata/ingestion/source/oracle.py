# This import verifies that the dependencies are available.
import cx_Oracle  # noqa: F401

from .sql_source import BasicSQLAlchemyConfig, SQLAlchemySource
from ..ometa.auth_provider import MetadataServerConfig


class OracleConfig(BasicSQLAlchemyConfig):
    # defaults
    scheme = "oracle+cx_oracle"


class OracleSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config,metadata_config, ctx, "oracle")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = OracleConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)