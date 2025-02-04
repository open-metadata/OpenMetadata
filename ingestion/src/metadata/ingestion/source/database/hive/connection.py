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
from copy import deepcopy
from enum import Enum
from functools import singledispatch
from typing import Any, Optional
from urllib.parse import quote_plus

from pydantic import SecretStr, ValidationError
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
    HiveScheme,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_connection_url_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN

HIVE_POSTGRES_SCHEME = "hive+postgres"
HIVE_MYSQL_SCHEME = "hive+mysql"


def get_connection_url(connection: HiveConnection) -> str:
    """
    Build the URL handling auth requirements
    """
    url = f"{connection.scheme.value}://"
    if (
        connection.username
        and connection.auth
        and connection.auth.value in ("LDAP", "CUSTOM")
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
        auth_key = (
            "auth"
            if connection.scheme
            in {HiveScheme.hive, HiveScheme.hive_http, HiveScheme.hive_https}
            else "auth_mechanism"
        )
        connection.connectionArguments.root[auth_key] = connection.auth.value

    if connection.kerberosServiceName:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root[
            "kerberos_service_name"
        ] = connection.kerberosServiceName

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


@singledispatch
def get_metastore_connection(connection: Any) -> Engine:
    """
    Create connection
    """
    raise NotImplementedError("Metastore not implemented")


@get_metastore_connection.register
def _(connection: PostgresConnection):
    # import required to load sqlalchemy plugin
    # pylint: disable=import-outside-toplevel,unused-import
    from metadata.ingestion.source.database.hive.metastore_dialects.postgres import (  # nopycln: import
        HivePostgresMetaStoreDialect,
    )

    class CustomPostgresScheme(Enum):
        HIVE_POSTGRES = HIVE_POSTGRES_SCHEME

    class CustomPostgresConnection(PostgresConnection):
        scheme: Optional[CustomPostgresScheme]

    connection_copy = deepcopy(connection.__dict__)
    connection_copy["scheme"] = CustomPostgresScheme.HIVE_POSTGRES

    custom_connection = CustomPostgresConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


@get_metastore_connection.register
def _(connection: MysqlConnection):
    # import required to load sqlalchemy plugin
    # pylint: disable=import-outside-toplevel,unused-import
    from metadata.ingestion.source.database.hive.metastore_dialects.mysql import (  # nopycln: import
        HiveMysqlMetaStoreDialect,
    )

    class CustomMysqlScheme(Enum):
        HIVE_MYSQL = HIVE_MYSQL_SCHEME

    class CustomMysqlConnection(MysqlConnection):
        scheme: Optional[CustomMysqlScheme]

    connection_copy = deepcopy(connection.__dict__)
    connection_copy["scheme"] = CustomMysqlScheme.HIVE_MYSQL

    custom_connection = CustomMysqlConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: HiveConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    if service_connection.metastoreConnection and isinstance(
        service_connection.metastoreConnection, dict
    ):
        try:
            service_connection.metastoreConnection = MysqlConnection.model_validate(
                service_connection.metastoreConnection
            )
        except ValidationError:
            try:
                service_connection.metastoreConnection = (
                    PostgresConnection.model_validate(
                        service_connection.metastoreConnection
                    )
                )
            except ValidationError:
                raise ValueError("Invalid metastore connection")
        engine = get_metastore_connection(service_connection.metastoreConnection)

    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
