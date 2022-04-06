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

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)


@singledispatch
def get_connection_url(connection):
    raise NotImplemented(
        f"Connection URL build not implemented for type {type(connection)}: {connection}"
    )


@get_connection_url.register
def _(connection: MysqlConnection):

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
