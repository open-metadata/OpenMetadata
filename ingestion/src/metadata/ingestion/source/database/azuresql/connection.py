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

from urllib.parse import quote_plus

from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    Authentication,
    AuthenticationMode,
    AzureSQLScheme,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection as AzureSQLConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
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
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN

DEFAULT_SQL_SERVER_PORT = 1433


def get_connection_url(connection: AzureSQLConnectionConfig | MssqlConnection) -> str:
    """
    Build the connection URL
    """

    if (
        isinstance(connection, AzureSQLConnectionConfig)
        and isinstance(connection.authenticationMode, AuthenticationMode)
        and connection.authenticationMode.authentication is not None
    ):
        connection_string = f"Driver={connection.driver};Server={connection.hostPort};Database={connection.database};"
        connection_string += f"Uid={connection.username};"
        if connection.authenticationMode.authentication == Authentication.ActiveDirectoryPassword:
            connection_string += f"Pwd={connection.password.get_secret_value()};"

        connection_string += f"Encrypt={'yes' if connection.authenticationMode.encrypt else 'no'};TrustServerCertificate={'yes' if connection.authenticationMode.trustServerCertificate else 'no'};"
        connection_string += f"Connection Timeout={connection.authenticationMode.connectionTimeout or 30};Authentication={connection.authenticationMode.authentication.value};"

        connection_url = URL.create("mssql+pyodbc", query={"odbc_connect": connection_string})
        return connection_url  # noqa: RET504
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        url += f":{quote_plus(connection.password.get_secret_value())}" if connection.password else ""
        url += "@"

    url += f"{connection.hostPort}"
    url += f"/{quote_plus(connection.database)}" if connection.database else ""
    url += f"?driver={quote_plus(connection.driver)}"

    options = get_connection_options_dict(connection)
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(f"{key}={quote_plus(value)}" for key, value in options.items() if value)
        url = f"{url}&{params}"

    return url


class AzureSQLConnection(BaseConnection[AzureSQLConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    def get_connection_dict(self) -> dict:
        """Return the connection parameters for data-diff."""
        # data-diff reads credentials from the URL authority only, and the Active Directory URL
        # keeps them inside an opaque `odbc_connect` query parameter - hence the explicit dict.
        connection = self.service_connection
        host, _, port = connection.hostPort.partition(":")
        scheme = connection.scheme or AzureSQLScheme.mssql_pyodbc

        connection_dict = {
            "driver": scheme.value,
            "host": host,
            "port": int(port) if port else DEFAULT_SQL_SERVER_PORT,
            "user": connection.username,
            "password": connection.password.get_secret_value() if connection.password else None,
            "database": connection.database,
        }

        authentication_mode = connection.authenticationMode
        if isinstance(authentication_mode, AuthenticationMode) and authentication_mode.authentication is not None:
            connection_dict["Authentication"] = authentication_mode.authentication.value
            connection_dict["Encrypt"] = "yes" if authentication_mode.encrypt else "no"

        return connection_dict

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
