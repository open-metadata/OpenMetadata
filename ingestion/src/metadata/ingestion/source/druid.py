from typing import Optional

import pydruid

from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLConnectionConfig, SQLSource


class DruidConfig(SQLConnectionConfig):
    scheme = "druid"
    auth_options: Optional[str] = None
    service_type = "Druid"

    def get_connection_url(self):
        url = super().get_connection_url()
        return f"{url}/druid/v2/sql"


class DruidSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = DruidConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
