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
from urllib.parse import quote_plus

from pydantic import SecretStr
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_db_common,
)


def get_connection_url(connection: HiveConnection) -> str:
    """
    Build the URL handling auth requirements
    """
    url = f"{connection.scheme.value}://"
    if (
        connection.username
        and connection.auth
        and connection.auth in ("LDAP", "CUSTOM")
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
        return f"{url};{connection.authOptions}"
    return url


def get_connection(connection: HiveConnection) -> Engine:
    """
    Create connection
    """

    if connection.auth:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.__root__["auth"] = connection.auth

    if connection.kerberosServiceName:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.__root__[
            "kerberos_service_name"
        ] = connection.kerberosServiceName

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine) -> TestConnectionResult:
    """
    Test connection
    """
    inspector = inspect(engine)
    steps = [
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=inspector.get_table_names,
            name="Get Tables",
        ),
        TestConnectionStep(
            function=inspector.get_view_names,
            name="Get Views",
            mandatory=False,
        ),
    ]
    return test_connection_db_common(engine, steps)
