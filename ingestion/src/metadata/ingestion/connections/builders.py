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
Get and test connection utilities
"""
from functools import partial
from typing import Any, Callable, Dict, Optional
from urllib.parse import quote_plus

from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.event import listen
from sqlalchemy.pool import QueuePool

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
)
from metadata.ingestion.connections.headers import inject_query_header_by_conn
from metadata.ingestion.connections.secrets import connection_with_options_secrets


@connection_with_options_secrets
def get_connection_args_common(connection) -> Dict[str, Any]:
    """
    Read the connection arguments of a connection.

    Any function operating on top of the connection
    arguments should be decorated with `connection_with_options_secrets`
    """

    return (
        connection.connectionArguments.__root__
        if connection.connectionArguments and connection.connectionArguments.__root__
        else {}
    )


def create_generic_db_connection(
    connection, get_connection_url_fn: Callable, get_connection_args_fn: Callable
) -> Engine:
    """
    Generic Engine creation from connection object

    Args:
        connection: JSON Schema connection model
        get_connection_url_fn: url build callable
        get_connection_args_fn: args build callable
    Returns:
        SQLAlchemy Engine
    """
    engine = create_engine(
        get_connection_url_fn(connection),
        connect_args=get_connection_args_fn(connection),
        poolclass=QueuePool,
        pool_reset_on_return=None,  # https://docs.sqlalchemy.org/en/14/core/pooling.html#reset-on-return
        echo=False,
        max_overflow=-1,
    )

    if hasattr(connection, "supportsQueryComment"):
        listen(
            engine,
            "before_cursor_execute",
            partial(inject_query_header_by_conn, connection),
            retval=True,
        )

    return engine


def get_connection_options_dict(connection) -> Optional[Dict[str, Any]]:
    """
    Given a connection object, returns the connection options
    dictionary if exists
    """
    return (
        connection.connectionOptions.__root__
        if connection.connectionOptions and connection.connectionOptions.__root__
        else None
    )


def init_empty_connection_arguments() -> ConnectionArguments:
    """
    Initialize a ConnectionArguments model with an empty dictionary.
    This helps set keys without further validations.

    Running `ConnectionArguments()` returns `ConnectionArguments(__root__=None)`.

    Instead, we want `ConnectionArguments(__root__={}})` so that
    we can pass new keys easily as `connectionArguments.__root__["key"] = "value"`
    """
    return ConnectionArguments(__root__={})


def get_connection_url_common(connection):
    """
    Common method for building the source connection urls
    """

    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if not connection.password:
            connection.password = SecretStr("")
        url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    url += connection.hostPort
    if hasattr(connection, "database"):
        url += f"/{connection.database}" if connection.database else ""

    elif hasattr(connection, "databaseSchema"):
        url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

    options = get_connection_options_dict(connection)
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
