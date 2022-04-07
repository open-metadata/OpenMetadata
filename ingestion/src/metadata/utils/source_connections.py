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

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
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


@get_connection_url.register(RedshiftConnection)
@get_connection_url.register(MysqlConnection)
@get_connection_url.register(ClickhouseConnection)
def _(connection):
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: MssqlConnection):
    if connection.scheme.value == connection.scheme.mssql_pyodbc:
        return f"{connection.scheme.value}://{connection.uriString}"
    return get_connection_url_common(connection)


@get_connection_url.register
def _(connection: SQLiteConnection):
    """
    SQLite is only used for testing with the in-memory db
    """

    return f"{connection.scheme.value}:///:memory:"


def get_connection_url(connection: DatabricksConnection):
    url = f"{connection.scheme.value}://token:{connection.token}@{connection.hostPort}"
    if connection.database:
        url += f"/{connection.database}"
    return url
