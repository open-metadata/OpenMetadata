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
    HiveConnection as HiveConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
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
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.hive.custom_hive_connection import (
    CustomHiveConnection,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_manager import check_ssl_and_init

HIVE_POSTGRES_SCHEME = "hive+postgres"
HIVE_MYSQL_SCHEME = "hive+mysql"

# Monkey-patch the pyhive.hive module to use our custom connection
import pyhive.hive  # noqa: E402

pyhive.hive.Connection = CustomHiveConnection


def get_connection_url(connection: HiveConnectionConfig) -> str:
    """
    Build the URL handling auth requirements
    """
    url = f"{connection.scheme.value}://"
    if connection.username and connection.auth and connection.auth.value in ("LDAP", "CUSTOM"):
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
        params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
        url = f"{url}?{params}"
    if connection.authOptions:
        return f"{url};{connection.authOptions}"
    return url


class HiveConnection(BaseConnection[HiveConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        connection = self.service_connection

        if connection.auth:
            auth_key = (
                "auth"
                if connection.scheme in {HiveScheme.hive, HiveScheme.hive_http, HiveScheme.hive_https}
                else "auth_mechanism"
            )
            self._connection_arguments_root(connection)[auth_key] = connection.auth.value

        if connection.kerberosServiceName:
            self._connection_arguments_root(connection)["kerberos_service_name"] = connection.kerberosServiceName

        # SSL cert paths (ssl_ca_certs, ssl_certfile, ssl_keyfile) are set by ssl_manager.setup_ssl()
        # via SSLManager.create_temp_file(). Do not assign sslConfig fields here directly —
        # SecretStr values are not file paths and will cause a driver-level file-not-found error.
        ssl_manager = check_ssl_and_init(connection)
        if ssl_manager:
            connection = ssl_manager.setup_ssl(connection)  # pyright: ignore[reportAttributeAccessIssue]
            connection._ssl_manager = ssl_manager  # pyright: ignore[reportAttributeAccessIssue]

        # use_ssl=True is a Hive-specific driver flag not set by ssl_manager, so it is handled here.
        if hasattr(connection, "useSSL") and connection.useSSL:
            self._connection_arguments_root(connection)["use_ssl"] = True

        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    @staticmethod
    def _connection_arguments_root(connection: HiveConnectionConfig) -> dict[str, Any]:
        """Get-or-create the connectionArguments root dict for in-place key injection."""
        arguments = connection.connectionArguments or init_empty_connection_arguments()
        connection.connectionArguments = arguments
        if arguments.root is None:
            arguments.root = {}
        return arguments.root

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        engine = self.client
        service_connection = self.service_connection
        metastore_conn = service_connection.metastoreConnection

        if metastore_conn:
            if isinstance(metastore_conn, (PostgresConnection, MysqlConnection)):
                engine = get_metastore_connection(metastore_conn)
            elif isinstance(metastore_conn, dict) and len(metastore_conn) > 0:
                try:
                    service_connection.metastoreConnection = PostgresConnection.model_validate(metastore_conn)
                except ValidationError:
                    try:
                        service_connection.metastoreConnection = MysqlConnection.model_validate(metastore_conn)
                    except ValidationError:
                        raise ValueError("Invalid metastore connection")  # noqa: B904
                engine = get_metastore_connection(service_connection.metastoreConnection)

        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=engine,
            service_connection=service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
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
    from metadata.ingestion.source.database.hive.metastore_dialects.postgres import (  # nopycln: import  # noqa: PLC0415
        HivePostgresMetaStoreDialect,  # noqa: F401
    )

    class CustomPostgresScheme(Enum):
        HIVE_POSTGRES = HIVE_POSTGRES_SCHEME

    class CustomPostgresConnection(PostgresConnection):
        scheme: Optional[CustomPostgresScheme]  # noqa: UP045

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
    from metadata.ingestion.source.database.hive.metastore_dialects.mysql import (  # nopycln: import  # noqa: PLC0415
        HiveMysqlMetaStoreDialect,  # noqa: F401
    )

    class CustomMysqlScheme(Enum):
        HIVE_MYSQL = HIVE_MYSQL_SCHEME

    class CustomMysqlConnection(MysqlConnection):
        scheme: Optional[CustomMysqlScheme]  # noqa: UP045

    connection_copy = deepcopy(connection.__dict__)
    connection_copy["scheme"] = CustomMysqlScheme.HIVE_MYSQL

    custom_connection = CustomMysqlConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )
