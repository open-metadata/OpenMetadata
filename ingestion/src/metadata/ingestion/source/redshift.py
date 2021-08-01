import logging
from typing import Optional

from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLAlchemySource, BasicSQLAlchemyConfig
from metadata.ingestion.api.source import Source, SourceStatus

logger = logging.getLogger(__name__)


class RedshiftConfig(BasicSQLAlchemyConfig):
    scheme = "postgresql+psycopg2"
    where_clause: Optional[str] = None
    duration: int = 1

    def get_identifier(self, schema: str, table: str) -> str:
        regular = f"{schema}.{table}"
        if self.database:
            return f"{self.database}.{regular}"
        return regular


class RedshiftSource(SQLAlchemySource):

    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = RedshiftConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def get_status(self) -> SourceStatus:
        return self.status
