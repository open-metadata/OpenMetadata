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
from typing import Any
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
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
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
from metadata.ingestion.source.database.hive.custom_hive_connection import (
    CustomHiveConnection,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_manager import check_ssl_and_init

HIVE_POSTGRES_SCHEME = "hive+postgres"
HIVE_MYSQL_SCHEME = "hive+mysql"
HIVE_MSSQL_PYODBC_SCHEME = "hive+mssql.pyodbc"
HIVE_MSSQL_PYTDS_SCHEME = "hive+mssql.pytds"
HIVE_MSSQL_PYMSSQL_SCHEME = "hive+mssql.pymssql"
HIVE_ORACLE_SCHEME = "hive+oracle"

# Monkey-patch the pyhive.hive module to use our custom connection
import pyhive.hive  # noqa: E402

pyhive.hive.Connection = CustomHiveConnection


def get_connection_url(connection: HiveConnection) -> str:
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


def get_connection(connection: HiveConnection) -> Engine:
    """
    Create connection
    """

    if connection.auth:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        auth_key = (
            "auth"
            if connection.scheme in {HiveScheme.hive, HiveScheme.hive_http, HiveScheme.hive_https}
            else "auth_mechanism"
        )
        connection.connectionArguments.root[auth_key] = connection.auth.value

    if connection.kerberosServiceName:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root["kerberos_service_name"] = connection.kerberosServiceName

    # SSL cert paths (ssl_ca_certs, ssl_certfile, ssl_keyfile) are set by ssl_manager.setup_ssl()
    # via SSLManager.create_temp_file(). Do not assign sslConfig fields here directly —
    # SecretStr values are not file paths and will cause a driver-level file-not-found error.
    ssl_manager = check_ssl_and_init(connection)
    if ssl_manager:
        connection = ssl_manager.setup_ssl(connection)
        connection._ssl_manager = ssl_manager

    # use_ssl=True is a Hive-specific driver flag not set by ssl_manager, so it is handled here.
    if hasattr(connection, "useSSL") and connection.useSSL:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root["use_ssl"] = True

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def get_mssql_metastore_connection_url(connection: MssqlConnection) -> str:
    """
    Build the Hive metastore MSSQL URL while preserving the configured DBAPI.
    """
    url = get_connection_url_common(connection)
    scheme = connection.scheme.value if connection.scheme else None

    if scheme == HIVE_MSSQL_PYODBC_SCHEME and connection.driver:
        url += "&" if "?" in url else "?"
        url += f"driver={quote_plus(connection.driver)}"

    return url


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
    from metadata.ingestion.source.database.hive.metastore_dialects.postgres import (  # nopycln: import  # noqa: PLC0415, RUF100
        HivePostgresMetaStoreDialect,  # noqa: F401
    )

    class CustomPostgresScheme(Enum):
        HIVE_POSTGRES = HIVE_POSTGRES_SCHEME

    class CustomPostgresConnection(PostgresConnection):
        scheme: CustomPostgresScheme | None

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
    from metadata.ingestion.source.database.hive.metastore_dialects.mysql import (  # nopycln: import  # noqa: PLC0415, RUF100
        HiveMysqlMetaStoreDialect,  # noqa: F401
    )

    class CustomMysqlScheme(Enum):
        HIVE_MYSQL = HIVE_MYSQL_SCHEME

    class CustomMysqlConnection(MysqlConnection):
        scheme: CustomMysqlScheme | None

    connection_copy = deepcopy(connection.__dict__)
    connection_copy["scheme"] = CustomMysqlScheme.HIVE_MYSQL

    custom_connection = CustomMysqlConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


@get_metastore_connection.register
def _(connection: MssqlConnection):
    # import required to load sqlalchemy plugin
    # pylint: disable=import-outside-toplevel,unused-import
    from metadata.ingestion.source.database.hive.metastore_dialects.mssql import (  # nopycln: import  # noqa: PLC0415, RUF100
        HiveMssqlMetaStoreDialect,  # noqa: F401
        HiveMssqlPymssqlMetaStoreDialect,  # noqa: F401
        HiveMssqlPyodbcMetaStoreDialect,  # noqa: F401
    )

    class CustomMssqlScheme(Enum):
        HIVE_MSSQL_PYODBC = HIVE_MSSQL_PYODBC_SCHEME
        HIVE_MSSQL_PYTDS = HIVE_MSSQL_PYTDS_SCHEME
        HIVE_MSSQL_PYMSSQL = HIVE_MSSQL_PYMSSQL_SCHEME

    class CustomMssqlConnection(MssqlConnection):
        scheme: CustomMssqlScheme | None  # pyright: ignore[reportIncompatibleVariableOverride]

    hive_scheme_by_mssql_scheme = {
        "mssql+pyodbc": CustomMssqlScheme.HIVE_MSSQL_PYODBC,
        "mssql+pytds": CustomMssqlScheme.HIVE_MSSQL_PYTDS,
        "mssql+pymssql": CustomMssqlScheme.HIVE_MSSQL_PYMSSQL,
    }
    if not connection.scheme:
        raise ValueError("MSSQL metastore connection scheme is required")
    connection_copy: dict[str, Any] = dict(deepcopy(connection.__dict__))
    connection_copy["scheme"] = hive_scheme_by_mssql_scheme[connection.scheme.value]

    custom_connection = CustomMssqlConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=get_mssql_metastore_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


@get_metastore_connection.register
def _(connection: OracleConnection):
    # import required to load sqlalchemy plugin
    # pylint: disable=import-outside-toplevel,unused-import
    from metadata.ingestion.source.database.hive.metastore_dialects.oracle import (  # nopycln: import  # noqa: PLC0415, RUF100
        HiveOracleMetaStoreDialect,  # noqa: F401
    )
    from metadata.ingestion.source.database.oracle.connection import (  # noqa: PLC0415, RUF100
        OracleConnection as OracleConnectionHandler,
    )

    class CustomOracleScheme(Enum):
        HIVE_ORACLE = HIVE_ORACLE_SCHEME

    class CustomOracleConnection(OracleConnection):
        scheme: CustomOracleScheme | None  # pyright: ignore[reportIncompatibleVariableOverride]

    connection_copy: dict[str, Any] = dict(deepcopy(connection.__dict__))
    connection_copy["scheme"] = CustomOracleScheme.HIVE_ORACLE

    custom_connection = CustomOracleConnection(**connection_copy)

    return create_generic_db_connection(
        connection=custom_connection,
        get_connection_url_fn=OracleConnectionHandler.get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: HiveConnection,
    automation_workflow: AutomationWorkflow | None = None,
    timeout_seconds: int | None = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    metastore_conn = service_connection.metastoreConnection

    if metastore_conn:
        if isinstance(
            metastore_conn,
            PostgresConnection | MysqlConnection | MssqlConnection | OracleConnection,
        ):
            engine = get_metastore_connection(metastore_conn)
        elif isinstance(metastore_conn, dict) and len(metastore_conn) > 0:
            for conn_cls in (
                PostgresConnection,
                MysqlConnection,
                MssqlConnection,
                OracleConnection,
            ):
                try:
                    service_connection.metastoreConnection = conn_cls.model_validate(metastore_conn)
                    break
                except ValidationError:
                    continue
            else:
                raise ValueError("Invalid metastore connection")
            engine = get_metastore_connection(service_connection.metastoreConnection)

    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
