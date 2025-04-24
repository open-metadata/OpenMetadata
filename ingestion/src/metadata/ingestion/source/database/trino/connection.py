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
from copy import deepcopy
from typing import Optional
from urllib.parse import quote_plus

from requests import Session
from sqlalchemy.engine import Engine
from trino.auth import BasicAuthentication, JWTAuthentication, OAuth2Authentication

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common import (
    basicAuth,
    jwtAuth,
    noConfigAuthenticationTypes,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
    init_empty_connection_options,
)
from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.trino.queries import TRINO_GET_DATABASE
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: TrinoConnection) -> str:
    """
    Prepare the connection url for trino
    """
    url = f"{connection.scheme.value}://"

    # leaving username here as, even though with basic auth is used directly
    # in BasicAuthentication class, it's often also required as a part of url.
    # For example - it will be used by OAuth2Authentication to persist token in
    # cache more efficiently (per user instead of per host)
    if connection.username:
        url += f"{quote_plus(connection.username)}@"

    url += f"{connection.hostPort}"
    if connection.catalog:
        url += f"/{connection.catalog}"
    if connection.connectionOptions is not None:
        params = "&".join(
            f"{key}={quote_plus(value)}"
            for (key, value) in connection.connectionOptions.root.items()
            if value
        )
        url = f"{url}?{params}"
    return url


@connection_with_options_secrets
def get_connection_args(connection: TrinoConnection):
    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.proxies:
        session = Session()
        session.proxies = connection.proxies

        connection.connectionArguments.root["http_session"] = session

    if isinstance(connection.authType, basicAuth.BasicAuth):
        connection.connectionArguments.root["auth"] = BasicAuthentication(
            connection.username,
            connection.authType.password.get_secret_value()
            if connection.authType.password
            else None,
        )
        connection.connectionArguments.root["http_scheme"] = "https"

    elif isinstance(connection.authType, jwtAuth.JwtAuth):
        connection.connectionArguments.root["auth"] = JWTAuthentication(
            connection.authType.jwt.get_secret_value()
        )
        connection.connectionArguments.root["http_scheme"] = "https"

    elif hasattr(connection.authType, "azureConfig"):
        if not connection.authType.azureConfig.scopes:
            raise ValueError(
                "Azure Scopes are missing, please refer https://learn.microsoft.com/en-gb/azure/mysql/flexible-server/how-to-azure-ad#2---retrieve-microsoft-entra-access-token and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
            )

        azure_client = AzureClient(connection.authType.azureConfig).create_client()

        access_token_obj = azure_client.get_token(
            *connection.authType.azureConfig.scopes.split(",")
        )

        connection.connectionArguments.root["auth"] = JWTAuthentication(
            access_token_obj.token
        )
        connection.connectionArguments.root["http_scheme"] = "https"

    elif (
        connection.authType
        == noConfigAuthenticationTypes.NoConfigAuthenticationTypes.OAuth2
    ):
        connection.connectionArguments.root["auth"] = OAuth2Authentication()
        connection.connectionArguments.root["http_scheme"] = "https"

    return get_connection_args_common(connection)


def get_connection(connection: TrinoConnection) -> Engine:
    """
    Create connection
    """
    # here we are creating a copy of connection, because we need to dynamically
    # add auth params to connectionArguments, which we do no intend to store
    # in original connection object and in OpenMetadata database
    from trino.sqlalchemy.dialect import TrinoDialect

    TrinoDialect.is_disconnect = _is_disconnect

    connection_copy = deepcopy(connection)
    if connection_copy.verify:
        connection_copy.connectionArguments = (
            connection_copy.connectionArguments or init_empty_connection_arguments()
        )
        connection.connectionArguments.root["verify"] = {"verify": connection.verify}
    if hasattr(connection.authType, "azureConfig"):
        azure_client = AzureClient(connection.authType.azureConfig).create_client()
        if not connection.authType.azureConfig.scopes:
            raise ValueError(
                "Azure Scopes are missing, please refer https://learn.microsoft.com/en-gb/azure/mysql/flexible-server/how-to-azure-ad#2---retrieve-microsoft-entra-access-token and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
            )
        access_token_obj = azure_client.get_token(
            *connection.authType.azureConfig.scopes.split(",")
        )
        if not connection.connectionOptions:
            connection.connectionOptions = init_empty_connection_options()
        connection.connectionOptions.root["access_token"] = access_token_obj.token
    return create_generic_db_connection(
        connection=connection_copy,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: TrinoConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    queries = {
        "GetDatabases": TRINO_GET_DATABASE,
    }

    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
        timeout_seconds=timeout_seconds,
    )


# pylint: disable=unused-argument
def _is_disconnect(self, e, connection, cursor):
    """is_disconnect method for the Databricks dialect"""
    if "JWT expired" in str(e):
        return True
    return False
