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
from urllib.parse import quote_plus

from requests import Session
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common import (
    basicAuth,
    jwtAuth,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
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


def get_connection_url(connection: TrinoConnection) -> str:
    """
    Prepare the connection url for trino
    """
    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if (
            isinstance(connection.authType, basicAuth.BasicAuth)
            and connection.authType.password
        ):
            url += f":{quote_plus(connection.authType.password.get_secret_value())}"
        url += "@"
    url += f"{connection.hostPort}"
    if connection.catalog:
        url += f"/{connection.catalog}"
    if isinstance(connection.authType, jwtAuth.JwtAuth):
        if not connection.connectionOptions:
            connection.connectionOptions = init_empty_connection_options()
        connection.connectionOptions.__root__[
            "access_token"
        ] = connection.authType.jwt.get_secret_value()
    if connection.connectionOptions is not None:
        params = "&".join(
            f"{key}={quote_plus(value)}"
            for (key, value) in connection.connectionOptions.__root__.items()
            if value
        )
        url = f"{url}?{params}"
    return url


@connection_with_options_secrets
def get_connection_args(connection: TrinoConnection):
    if connection.proxies:
        session = Session()
        session.proxies = connection.proxies
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()

        connection.connectionArguments.__root__["http_session"] = session

    return get_connection_args_common(connection)


def get_connection(connection: TrinoConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: TrinoConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    queries = {
        "GetDatabases": TRINO_GET_DATABASE,
    }

    test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
    )
