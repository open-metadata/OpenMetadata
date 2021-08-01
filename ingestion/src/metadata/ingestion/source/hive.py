from pyhive import hive  # noqa: F401
from pyhive.sqlalchemy_hive import HiveDate, HiveDecimal, HiveTimestamp

from .sql_source import (
    BasicSQLAlchemyConfig,
    SQLAlchemySource,
    register_custom_type,
)
from ..ometa.auth_provider import MetadataServerConfig

register_custom_type(HiveDate, "DATE")
register_custom_type(HiveTimestamp, "TIME")
register_custom_type(HiveDecimal, "NUMBER")


class HiveConfig(BasicSQLAlchemyConfig):
    scheme = "hive"


class HiveSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx, "hive")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = HiveConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
