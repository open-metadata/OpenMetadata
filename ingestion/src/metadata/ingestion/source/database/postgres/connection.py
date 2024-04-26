#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""

from typing import Optional

from sqlalchemy.engine import Engine

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.ingestion.connections.sql.builders.helpers import (
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.connections.sql.builders.engine import default_engine_builder
from metadata.ingestion.connections.sql.builders.url import default_url_builder
from metadata.ingestion.connections.sql.builders.connection import SqlAlchemyConnectionBuilder
from metadata.generated.schema.security.ssl import verifySSLConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.ssl_manager import SSLManager
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_DATABASE,
    POSTGRES_TEST_GET_QUERIES,
    POSTGRES_TEST_GET_TAGS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_postgres_time_column_name,
)


def setup_ssl(connection: PostgresConnection) -> Optional[SSLManager]:
    if not connection.sslMode:
        return None

    ssl_manager = SSLManager(
        ca=connection.sslConfig.__root__.caCertificate
        if connection.sslConfig
        else None
    )

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    connection.connectionArguments.__root__["sslmode"] = connection.sslMode.value

    if connection.sslMode in (
        verifySSLConfig.SslMode.verify_ca,
        verifySSLConfig.SslMode.verify_full,
    ):
        if ssl_manager.ca_file_path:
            connection.connectionArguments.__root__["sslrootcert"] = ssl_manager.ca_file_path
        else:
            raise ValueError(
                "CA certificate is required for SSL mode verify-ca or verify-full"
            )

    return ssl_manager



def get_connection(connection: PostgresConnection) -> SqlAlchemyConnectionBuilder:
    """
    Create connection
    """
    if hasattr(connection.authType, "azureConfig"):
        azure_client = AzureClient(connection.authType.azureConfig).create_client()
        if not connection.authType.azureConfig.scopes:
            raise ValueError(
                "Azure Scopes are missing, please refer https://learn.microsoft.com/en-gb/azure/postgresql/flexible-server/how-to-configure-sign-in-azure-ad-authentication#retrieve-the-microsoft-entra-access-token and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
            )
        access_token_obj = azure_client.get_token(
            *connection.authType.azureConfig.scopes.split(",")
        )
        connection.authType = BasicAuth(password=access_token_obj.token)

    ssl_manager = setup_ssl(connection)

    engine = default_engine_builder(
        default_url_builder(connection).build(),
        get_connection_args_common(connection)
    ).build()

    return SqlAlchemyConnectionBuilder(engine) \
        .with_ssl_manager(ssl_manager)


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: PostgresConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    queries = {
        "GetQueries": POSTGRES_TEST_GET_QUERIES.format(
            time_column_name=get_postgres_time_column_name(engine=engine),
        ),
        "GetDatabases": POSTGRES_GET_DATABASE,
        "GetTags": POSTGRES_TEST_GET_TAGS,
    }
    test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
    )
