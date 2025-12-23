"""Extend the ProfilerSource class to add support for pinotdb"""

from ingestion.build.lib.metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database import (
    pinotDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.profiler.source.database.base.profiler_source import ProfilerSource


class PinotProfilerSource(ProfilerSource):
    """PinotDB Profiler source"""

    def _copy_service_config(
        self, config: OpenMetadataWorkflowConfig, database: Database
    ) -> pinotDBConnection.PinotDBConnection:
        """Make a copy of the service config and update the database name

        Args:
            database (_type_): a database entity

        Returns:
            DatabaseService.__config__
        """
        service_config: pinotDBConnection.PinotDBConnection = (
            super()._copy_service_config(config, database)
        )
        conn_args = service_config.connectionArguments or {}
        conn_args["use_multistage_engine"] = True
        service_config.connectionArguments = ConnectionArguments(**conn_args)
        return service_config
