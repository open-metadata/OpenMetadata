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

from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: ImpalaConnection) -> str:
    """
    Build the URL handling auth requirements
    """
    url = f"{connection.scheme.value}://"
    if (
        connection.username
        and connection.authMechanism
        and connection.authMechanism.value in ("LDAP", "CUSTOM")
    ):
        url += quote_plus(connection.username)
        if not connection.password:
            connection.password = SecretStr("")
        url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    elif connection.username:
        url += quote_plus(connection.username)
        if connection.password:
            url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    url += connection.hostPort
    url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

    options = get_connection_options_dict(connection)
    if options:
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    if connection.authOptions:
        url = f"{url};{connection.authOptions}"
    return url


def get_connection(connection: ImpalaConnection) -> Engine:
    """
    Create connection
    """

    if connection.authMechanism:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root[
            "auth_mechanism"
        ] = connection.authMechanism.value

    if connection.kerberosServiceName:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root[
            "kerberos_service_name"
        ] = connection.kerberosServiceName

    if connection.useSSL:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root["use_ssl"] = connection.useSSL

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: ImpalaConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
