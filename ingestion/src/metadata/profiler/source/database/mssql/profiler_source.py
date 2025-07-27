"""Extend the ProfilerSource class to add support for MSSQL is_disconnect SQA method"""
from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.database.base.profiler_source import ProfilerSource


def is_disconnect(is_disconnect_original):
    """Wrapper to add custom is_disconnect method for the MSSQL dialects"""

    def inner_is_disconnect(self, e, connection, cursor):
        """is_disconnect method for the MSSQL dialects"""
        error_str = str(e)

        mssql_disconnect_codes = [
            "08S01",  # Communication link failure
            "08001",  # Cannot connect
            "HY000",  # General error often used for connection issues
        ]

        mssql_disconnect_messages = [
            "Server closed connection",
            "ClosedConnectionError",
            "Connection is closed",
            "Connection reset by peer",
            "Timeout expired",
            "Socket closed",
        ]

        if any(code in error_str for code in mssql_disconnect_codes) or any(
            message in error_str for message in mssql_disconnect_messages
        ):
            return True

        # If none of our custom checks match, fall back to SQLAlchemy's built-in detection
        return is_disconnect_original(self, e, connection, cursor)

    return inner_is_disconnect


class MssqlProfilerSource(ProfilerSource):
    """MSSQL Profiler source"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        database: Database,
        ometa_client: OpenMetadata,
        global_profiler_config: ProfilerConfiguration,
    ):
        super().__init__(config, database, ometa_client, global_profiler_config)
        self.set_is_disconnect(config)

    def set_is_disconnect(self, config: OpenMetadataWorkflowConfig):
        """Set the is_disconnect method based on the configured connection scheme"""
        # pylint: disable=import-outside-toplevel

        # Get the configured scheme from the source connection
        scheme = config.source.serviceConnection.root.config.scheme

        # Set the appropriate is_disconnect method based on the scheme
        if scheme == MssqlScheme.mssql_pytds:
            from sqlalchemy_pytds.dialect import MSDialect_pytds

            original_is_disconnect = MSDialect_pytds.is_disconnect
            MSDialect_pytds.is_disconnect = is_disconnect(original_is_disconnect)
        elif scheme == MssqlScheme.mssql_pyodbc:
            from sqlalchemy.dialects.mssql.pyodbc import MSDialect_pyodbc

            original_is_disconnect = MSDialect_pyodbc.is_disconnect
            MSDialect_pyodbc.is_disconnect = is_disconnect(original_is_disconnect)
        elif scheme == MssqlScheme.mssql_pymssql:
            from sqlalchemy.dialects.mssql.pymssql import MSDialect_pymssql

            original_is_disconnect = MSDialect_pymssql.is_disconnect
            MSDialect_pymssql.is_disconnect = is_disconnect(original_is_disconnect)
        else:
            raise ValueError(f"Unsupported MSSQL scheme: {scheme}")
