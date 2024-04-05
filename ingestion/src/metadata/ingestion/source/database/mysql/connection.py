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
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: MysqlConnection) -> Engine:
    """
    Create connection
    """
    if hasattr(connection.authType, "azureConfig"):
        azure_client = AzureClient(connection.authType.azureConfig).create_client()
        if not connection.authType.azureConfig.scopes:
            raise ValueError(
                "Azure Scopes are missing, please refer https://learn.microsoft.com/en-gb/azure/mysql/flexible-server/how-to-azure-ad#2---retrieve-microsoft-entra-access-token and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
            )
        access_token_obj = azure_client.get_token(
            *connection.authType.azureConfig.scopes.split(",")
        )
        connection.authType = BasicAuth(password=access_token_obj.token)
        if (
            connection.ssl.__root__.caCertificate
            or connection.ssl.__root__.sslCertificate
            or connection.ssl.__root__.sslKey
        ):
            connection.connectionArguments = (
                connection.connectionArguments or init_empty_connection_arguments()
            )
            ssl_args = connection.connectionArguments.get("ssl", {})
            if connection.ssl.__root__.caCertificate:
                ssl_args["ssl_ca"] = connection.ssl.__root__.caCertificate
            if connection.ssl.__root__.sslCertificate:
                ssl_args["ssl_cert"] = connection.ssl.__root__.sslCertificate
            if connection.ssl.__root__.sslKey:
                ssl_args["ssl_key"] = connection.ssl.__root__.sslKey
            connection.connectionArguments["ssl"] = ssl_args

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: MysqlConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
    )
