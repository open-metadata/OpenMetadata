"""Extend the ProfilerSource class to add support for Databricks is_disconnect SQA method"""
from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.database.base.profiler_source import ProfilerSource


# pylint: disable=unused-argument
def is_disconnect(self, e, connection, cursor):
    """is_disconnect method for the Databricks dialect"""
    if "Invalid SessionHandle: SessionHandle" in str(e):
        return True
    return False


class DataBricksProfilerSource(ProfilerSource):
    """Databricks Profiler source"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        database: Database,
        ometa_client: OpenMetadata,
        global_profiler_config: ProfilerConfiguration,
    ):
        super().__init__(config, database, ometa_client, global_profiler_config)
        self.set_is_disconnect()

    def set_is_disconnect(self):
        """Set the is_disconnect method for the Databricks dialect"""
        # pylint: disable=import-outside-toplevel
        from databricks.sqlalchemy import DatabricksDialect

        DatabricksDialect.is_disconnect = is_disconnect
