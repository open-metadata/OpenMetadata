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

from requests import Session

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    DB2Connection,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveSQLConnection,
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
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
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


def get_connection_url_common(connection):
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{connection.username}"
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.hostPort
    url += f"/{connection.database}" if connection.database else ""

    options = connection.connectionOptions
    if options:
        if not connection.database:
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
@get_connection_url.register(VerticaConnection)
@get_connection_url.register(DB2Connection)
def _(connection):
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: MssqlConnection):
    if connection.scheme.value == connection.scheme.mssql_pyodbc:
        return f"{connection.scheme.value}://{connection.uriString}"
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: OracleConnection):
    url = get_connection_url_common(connection)
    if connection.oracleServiceName:
        assert not connection.database
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
    url = f"{connection.scheme.value}://token:{connection.token}@{connection.hostPort}"
    if connection.database:
        url += f"/{connection.database}"
    return url


@singledispatch
def get_connection_args(connection):
    if connection.connectionArguments:
        return connection.connectionArguments
    else:
        return {}


@get_connection_args.register
def _(connection: TrinoConnection):
    if connection.proxies:
        session = Session()
        session.proxies = connection.proxies
        if connection.connectionArguments:
            return {**connection.connectionArguments, "http_session": session}
        else:
            return {"http_session": session}
    else:
        return connection.connectionArguments


@get_connection_args.register
def _(connection: SnowflakeConnection):

    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{connection.username}"
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.account
    url += f"/{connection.database}" if connection.database else ""
    url += "?warehouse=" + connection.warehouse
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


@get_connection_url.register
def _(connection: HiveSQLConnection):
    url = get_connection_url_common(connection)
    if connection.authOptions:
        return f"{url};{connection.authOptions}"
    return url
