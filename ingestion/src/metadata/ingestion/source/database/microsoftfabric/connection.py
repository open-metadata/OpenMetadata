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
Microsoft Fabric Database Connection Handler
"""

from typing import Optional

from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.microsoftFabricConnection import (
    MicrosoftFabricConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: MicrosoftFabricConnection) -> str:
    """
    Build the connection URL for Microsoft Fabric SQL endpoint.

    Fabric uses Service Principal authentication via ODBC connection string.
    """
    # Remove port from hostPort if present (Fabric doesn't use explicit port in connection string)
    server = connection.hostPort.split(":")[0] if ":" in connection.hostPort else connection.hostPort

    # Build ODBC connection string for Service Principal authentication
    # Note: Driver needs curly braces for ODBC
    driver = connection.driver if connection.driver else "ODBC Driver 18 for SQL Server"
    connection_string = f"Driver={{{driver}}};Server={server};"

    # Add database if specified
    if connection.database:
        connection_string += f"Database={connection.database};"

    # Service Principal authentication
    connection_string += f"Uid={connection.clientId};Pwd={connection.clientSecret.get_secret_value()};"

    # Fabric requires encryption and Active Directory Service Principal auth
    connection_string += (
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;Authentication=ActiveDirectoryServicePrincipal;"
    )

    # Build SQLAlchemy URL with ODBC connection string
    connection_url = URL.create("mssql+pyodbc", query={"odbc_connect": connection_string})
    return connection_url


def get_connection(connection: MicrosoftFabricConnection) -> Engine:
    """
    Create SQLAlchemy engine for Microsoft Fabric
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: MicrosoftFabricConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection to Microsoft Fabric SQL endpoint.
    """
    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
