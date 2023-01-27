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
from typing import Union

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.utils.supersetApiConnection import (
    SupersetAPIConnection,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_db_common,
)
from metadata.ingestion.source.dashboard.superset.client import SupersetAPIClient
from metadata.ingestion.source.database.mysql.connection import (
    get_connection as mysql_get_connection,
)
from metadata.ingestion.source.database.postgres.connection import (
    get_connection as pg_get_connection,
)


def get_connection(connection: SupersetConnection) -> SupersetAPIClient:
    """
    Create connection
    """
    if isinstance(connection.connection, SupersetAPIConnection):
        return SupersetAPIClient(connection)
    if isinstance(connection.connection, PostgresConnection):
        return pg_get_connection(connection=connection.connection)
    if isinstance(connection.connection, MysqlConnection):
        return mysql_get_connection(connection=connection.connection)
    return None


def test_connection(client: Union[SupersetAPIClient, Engine]) -> None:
    """
    Test connection
    """
    try:
        if isinstance(client, SupersetAPIClient):
            client.fetch_total_dashboards()
        else:
            test_connection_db_common(client)
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg)
