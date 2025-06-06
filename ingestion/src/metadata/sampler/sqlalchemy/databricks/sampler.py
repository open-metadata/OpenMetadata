from metadata.ingestion.source.database.databricks.connection import (
    get_connection as databricks_get_connection,
)
from metadata.sampler.sqlalchemy.sampler import SQASampler


class DatabricksSamplerInterface(SQASampler):
    def get_client(self):
        """client is the session for SQA"""
        self.connection = databricks_get_connection(self.service_connection_config)
        client = super().get_client()
        self.set_catalog(client)
        return client
