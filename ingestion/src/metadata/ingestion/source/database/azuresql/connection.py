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
from typing import Optional, Union
from urllib.parse import quote_plus

from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    Authentication,
    AuthenticationMode,
    AzureSQLConnection,
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
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: Union[AzureSQLConnection, MssqlConnection]) -> str:
    """
    Build the connection URL
    """

    if (
        isinstance(connection, AzureSQLConnection)
        and isinstance(connection.authenticationMode, AuthenticationMode)
        and connection.authenticationMode.authentication is not None
    ):
        connection_string = f"Driver={connection.driver};Server={connection.hostPort};Database={connection.database};"
        connection_string += f"Uid={connection.username};"
        if (
            connection.authenticationMode.authentication
            == Authentication.ActiveDirectoryPassword
        ):
            connection_string += f"Pwd={connection.password.get_secret_value()};"

        connection_string += f"Encrypt={'yes' if connection.authenticationMode.encrypt else 'no'};TrustServerCertificate={'yes' if connection.authenticationMode.trustServerCertificate else 'no'};"
        connection_string += f"Connection Timeout={connection.authenticationMode.connectionTimeout or 30};Authentication={connection.authenticationMode.authentication.value};"

        connection_url = URL.create(
            "mssql+pyodbc", query={"odbc_connect": connection_string}
        )
        return connection_url
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection.password
            else ""
        )
        url += "@"

    url += f"{connection.hostPort}"
    url += f"/{quote_plus(connection.database)}" if connection.database else ""
    url += f"?driver={quote_plus(connection.driver)}"

    options = get_connection_options_dict(connection)
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for key, value in options.items() if value
        )
        url = f"{url}&{params}"

    return url


def get_connection(connection: AzureSQLConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: AzureSQLConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
