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
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common


def get_connection_url(connection: DatabricksConnection) -> str:
    url = f"{connection.scheme.value}://token:{connection.token.get_secret_value()}@{connection.hostPort}"
    return url


def get_connection(connection: DatabricksConnection) -> Engine:
    """
    Create connection
    """
    if connection.httpPath:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.__root__["http_path"] = connection.httpPath

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine) -> None:
    """
    Test connection
    """
    test_connection_db_common(engine)
