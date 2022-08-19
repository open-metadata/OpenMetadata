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
Hosts the singledispatch to build source URLs
"""
from functools import singledispatch
from urllib.parse import quote_plus

from pydantic import SecretStr
from requests import Session

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
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
from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)
from metadata.generated.schema.security.credentials.gcsCredentials import GCSValues

CX_ORACLE_LIB_VERSION = "8.3.0"


class OracleConnectionError(Exception):
    """
    Custom Exception Class to be thown when both
    service name and database schema is passed in config
    """


def get_connection_url_common(connection):
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{connection.username}"
        if not connection.password:
            connection.password = SecretStr("")
        url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    url += connection.hostPort
    if hasattr(connection, "database"):
        url += f"/{connection.database}" if connection.database else ""

    elif hasattr(connection, "databaseSchema"):
        url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

    options = (
        connection.connectionOptions.dict()
        if connection.connectionOptions
        else connection.connectionOptions
    )
    if options:
        if (hasattr(connection, "database") and not connection.database) or (
            hasattr(connection, "databaseSchema") and not connection.databaseSchema
        ):
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    return url


@singledispatch
def get_connection_url(connection):
    raise NotImplemented(
        f"Connection URL build not implemented for type {type(connection)}: {connection}"
    )


@get_connection_url.register(MariaDBConnection)
@get_connection_url.register(PostgresConnection)
@get_connection_url.register(RedshiftConnection)
@get_connection_url.register(MysqlConnection)
@get_connection_url.register(SalesforceConnection)
@get_connection_url.register(ClickhouseConnection)
@get_connection_url.register(SingleStoreConnection)
@get_connection_url.register(Db2Connection)
@get_connection_url.register(VerticaConnection)
def _(connection):
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: MssqlConnection):
    if connection.scheme.value == connection.scheme.mssql_pyodbc:
        return f"{connection.scheme.value}://{connection.uriString}"
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: OracleConnection):
    # Patching the cx_Oracle module with oracledb lib
    # to work take advantage of the thin mode of oracledb
    # which doesn't require the oracle client libs to be installed
    import sys

    import oracledb

    oracledb.version = CX_ORACLE_LIB_VERSION
    sys.modules["cx_Oracle"] = oracledb
    if connection.oracleServiceName and connection.databaseSchema:
        raise OracleConnectionError(
            "Please pass either Service Name or Database Schema not both"
        )
    url = get_connection_url_common(connection)
    if connection.oracleServiceName:
        url = f"{url}/?service_name={connection.oracleServiceName}"
    return url


@get_connection_url.register
def _(connection: SQLiteConnection):
    """
    SQLite is only used for testing with the in-memory db
    """

    database_mode = connection.databaseMode if connection.databaseMode else ":memory:"

    return f"{connection.scheme.value}:///{database_mode}"


@get_connection_url.register
def _(connection: TrinoConnection):
    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if connection.password:
            url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"
    url += f"{connection.hostPort}"
    url += f"/{connection.catalog}"
    if connection.params is not None:
        params = "&".join(
            f"{key}={quote_plus(value)}"
            for (key, value) in connection.params.items()
            if value
        )
        url = f"{url}?{params}"
    return url


@get_connection_url.register
def _(connection: DatabricksConnection):
    url = f"{connection.scheme.value}://token:{connection.token.get_secret_value()}@{connection.hostPort}"
    return url


@get_connection_url.register
def _(connection: PrestoConnection):
    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if connection.password:
            url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"
    url += f"{connection.hostPort}"
    url += f"/{connection.catalog}"
    if connection.databaseSchema:
        url += f"?schema={quote_plus(connection.databaseSchema)}"
    return url


@singledispatch
def get_connection_args(connection):
    return connection.connectionArguments or {}


@get_connection_args.register
def _(connection: TrinoConnection):
    if connection.proxies:
        session = Session()
        session.proxies = connection.proxies
        if connection.connectionArguments:
            connection_args = connection.connectionArguments.dict()
            connection_args.update({"http_session": session})
            return connection_args
        else:
            return {"http_session": session}
    else:
        return connection.connectionArguments if connection.connectionArguments else {}


@get_connection_url.register
def _(connection: SnowflakeConnection):
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{connection.username}"
        if not connection.password:
            connection.password = SecretStr("")
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.account
    url += f"/{connection.database}" if connection.database else ""

    options = (
        connection.connectionOptions.dict()
        if connection.connectionOptions
        else connection.connectionOptions
    )
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    options = {
        "account": connection.account,
        "warehouse": connection.warehouse,
        "role": connection.role,
    }
    params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
    if params:
        url = f"{url}?{params}"
    return url


@get_connection_url.register
def _(connection: HiveConnection):
    url = f"{connection.scheme.value}://"
    if (
        connection.username
        and connection.connectionArguments
        and hasattr(connection.connectionArguments, "auth")
        and connection.connectionArguments.auth in ("LDAP", "CUSTOM")
    ):
        url += f"{connection.username}"
        if not connection.password:
            connection.password = SecretStr("")
        url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    url += connection.hostPort
    url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

    options = (
        connection.connectionOptions.dict()
        if connection.connectionOptions
        else connection.connectionOptions
    )

    if options:
        if not connection.databaseSchema:
            url += "/"
        url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    if connection.authOptions:
        return f"{url};{connection.authOptions}"
    return url


@get_connection_url.register
def _(connection: BigQueryConnection):
    from google import auth

    _, project_id = auth.default()
    if not project_id and isinstance(connection.credentials.gcsConfig, GCSValues):
        project_id = connection.credentials.gcsConfig.projectId
    if project_id:
        return f"{connection.scheme.value}://{project_id}"
    return f"{connection.scheme.value}://"


@get_connection_url.register
def _(connection: AzureSQLConnection):

    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{connection.username}"
        url += f":{connection.password.get_secret_value()}" if connection else ""
        url += "@"

    url += f"{connection.hostPort}"
    url += f"/{quote_plus(connection.database)}" if connection.database else ""
    url += f"?driver={quote_plus(connection.driver)}"
    options = (
        connection.connectionOptions.dict()
        if connection.connectionOptions
        else connection.connectionOptions
    )
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"

    return url


@get_connection_url.register
def _(connection: AthenaConnection):
    url = f"{connection.scheme.value}://"
    if connection.awsConfig.awsAccessKeyId:
        url += connection.awsConfig.awsAccessKeyId
        if connection.awsConfig.awsSecretAccessKey:
            url += f":{connection.awsConfig.awsSecretAccessKey.get_secret_value()}"
    else:
        url += ":"
    url += f"@athena.{connection.awsConfig.awsRegion}.amazonaws.com:443"

    url += f"?s3_staging_dir={quote_plus(connection.s3StagingDir)}"
    if connection.workgroup:
        url += f"&work_group={connection.workgroup}"
    return url


@get_connection_url.register
def _(connection: DruidConnection):
    url = get_connection_url_common(connection)
    return f"{url}/druid/v2/sql"


@get_connection_url.register
def _(connection: PinotDBConnection):
    url = get_connection_url_common(connection)
    url += f"/query/sql?controller={connection.pinotControllerHost}"
    return url
