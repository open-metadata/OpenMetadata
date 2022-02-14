from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class DatabricksConfig(SQLConnectionConfig):
    host_port = "localhost:443"
    scheme = "databricks+pyhive"
    service_type = "Databricks"
    token = "token"

    def get_connection_url(self):
        return f"{self.scheme}://token:{self.token}@{self.host_port}/{self.database}"


class DatabricksSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = DatabricksConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
