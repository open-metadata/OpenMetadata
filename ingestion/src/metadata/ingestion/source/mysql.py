import pymysql  # noqa: F401

from .sql_source import BasicSQLAlchemyConfig, SQLAlchemySource
from ..ometa.auth_provider import MetadataServerConfig


class MySQLConfig(BasicSQLAlchemyConfig):
    # defaults
    host_port = "localhost:3306"
    scheme = "mysql+pymysql"


class MySQLSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = MySQLConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)