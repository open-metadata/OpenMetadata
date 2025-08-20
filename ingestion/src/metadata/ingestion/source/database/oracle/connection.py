#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""
import os
import sys
from copy import deepcopy
from typing import Optional
from urllib.parse import quote_plus

import oracledb
from oracledb.exceptions import DatabaseError
from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection as OracleConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleDatabaseSchema,
    OracleServiceName,
    OracleTNSConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.oracle.queries import (
    CHECK_ACCESS_TO_ALL,
    ORACLE_GET_SCHEMA,
    ORACLE_GET_STORED_PACKAGES,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

CX_ORACLE_LIB_VERSION = "8.3.0"
LD_LIB_ENV = "LD_LIBRARY_PATH"

logger = ingestion_logger()


class OracleConnection(BaseConnection[OracleConnectionConfig, Engine]):
    def __init__(self, connection: OracleConnectionConfig):
        super().__init__(connection)

    def _get_client(self) -> Engine:
        """
        Create connection
        """
        try:
            if self.service_connection.instantClientDirectory:
                logger.info(
                    f"Initializing Oracle thick client at {self.service_connection.instantClientDirectory}"
                )
                os.environ[LD_LIB_ENV] = self.service_connection.instantClientDirectory
                oracledb.init_oracle_client(
                    lib_dir=self.service_connection.instantClientDirectory
                )
        except DatabaseError as err:
            logger.info(f"Could not initialize Oracle thick client: {err}")

        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """

        def test_oracle_package_access(engine):
            try:
                schema_name = engine.execute(ORACLE_GET_SCHEMA).scalar()
                return ORACLE_GET_STORED_PACKAGES.format(schema=schema_name)
            except Exception as e:
                raise OraclePackageAccessError(
                    f"Failed to access Oracle stored packages: {e}"
                )

        test_conn_queries = {
            "CheckAccess": CHECK_ACCESS_TO_ALL,
            "PackageAccess": test_oracle_package_access(self.client),
        }

        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=test_conn_queries,
            timeout_seconds=timeout_seconds,
        )

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        url = self.client.url
        connection_copy = deepcopy(self.service_connection)

        connection_dict = {
            "driver": url.drivername,
            "host": f"{url.host}:{url.port}",  # This is the format expected by data-diff. If we start using this for something else, we need to change it and modify the data-diff code.
            "user": url.username,
        }

        # Add password if present in the connection
        if connection_copy.password:
            connection_dict["password"] = connection_copy.password.get_secret_value()

        # Add connection type specific information
        if isinstance(connection_copy.oracleConnectionType, OracleDatabaseSchema):
            connection_dict[
                "database"
            ] = connection_copy.oracleConnectionType.databaseSchema
        elif isinstance(connection_copy.oracleConnectionType, OracleServiceName):
            connection_dict[
                "database"
            ] = connection_copy.oracleConnectionType.oracleServiceName
        elif isinstance(connection_copy.oracleConnectionType, OracleTNSConnection):
            connection_dict[
                "host"
            ] = connection_copy.oracleConnectionType.oracleTNSConnection

        # Add connection options if present
        if connection_copy.connectionOptions and connection_copy.connectionOptions.root:
            connection_with_options_secrets(lambda: connection_copy)
            connection_dict.update(connection_copy.connectionOptions.root)

        # Add connection arguments if present
        if (
            connection_copy.connectionArguments
            and connection_copy.connectionArguments.root
        ):
            connection_dict.update(get_connection_args_common(connection_copy))

        return connection_dict

    @staticmethod
    def get_connection_url(connection: OracleConnectionConfig) -> str:
        """
        Build the URL and handle driver version at system level
        """

        oracledb.version = CX_ORACLE_LIB_VERSION
        sys.modules["cx_Oracle"] = oracledb

        url = f"{connection.scheme.value}://"
        if connection.username:
            url += f"{quote_plus(connection.username)}"
            if not connection.password:
                connection.password = SecretStr("")
            url += f":{quote_plus(connection.password.get_secret_value())}"
            url += "@"

        url = OracleConnection._handle_connection_type(url=url, connection=connection)

        options = get_connection_options_dict(connection)
        if options:
            params = "&".join(
                f"{key}={quote_plus(value)}"
                for (key, value) in options.items()
                if value
            )
            if isinstance(connection.oracleConnectionType, OracleServiceName):
                url = f"{url}&{params}"
            else:
                url = f"{url}?{params}"

        return url

    @staticmethod
    def _handle_connection_type(url: str, connection: OracleConnectionConfig) -> str:
        """
        Depending on the oracle connection type, we need to handle the URL differently
        """

        if isinstance(connection.oracleConnectionType, OracleTNSConnection):
            # ref https://stackoverflow.com/questions/14140902/using-oracle-service-names-with-sqlalchemy
            url += connection.oracleConnectionType.oracleTNSConnection
            return url

        # If not TNS, we add the hostPort
        url += connection.hostPort

        if isinstance(connection.oracleConnectionType, OracleDatabaseSchema):
            url += (
                f"/{connection.oracleConnectionType.databaseSchema}"
                if connection.oracleConnectionType.databaseSchema
                else ""
            )
            return url

        if isinstance(connection.oracleConnectionType, OracleServiceName):
            url = f"{url}/?service_name={connection.oracleConnectionType.oracleServiceName}"
            return url

        raise ValueError(f"Unknown connection type {connection.oracleConnectionType}")


class OraclePackageAccessError(Exception):
    """
    Raised when unable to access Oracle stored packages
    """
