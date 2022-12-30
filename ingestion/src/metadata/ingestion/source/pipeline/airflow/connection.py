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
from functools import singledispatch

from airflow import settings
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_db_common,
)


# Only import when needed
# pylint: disable=import-outside-toplevel
@singledispatch
def _get_connection(airflow_connection) -> Engine:
    """
    Internal call for Airflow connection build
    """
    raise NotImplementedError(f"Not support connection type {airflow_connection}")


@_get_connection.register
def _(_: BackendConnection) -> Engine:
    with settings.Session() as session:
        return session.get_bind()


@_get_connection.register
def _(airflow_connection: MysqlConnection) -> Engine:
    from metadata.ingestion.source.database.mysql.connection import (
        get_connection as get_mysql_connection,
    )

    return get_mysql_connection(airflow_connection)


@_get_connection.register
def _(airflow_connection: PostgresConnection) -> Engine:
    from metadata.ingestion.source.database.postgres.connection import (
        get_connection as get_postgres_connection,
    )

    return get_postgres_connection(airflow_connection)


@_get_connection.register
def _(airflow_connection: MssqlConnection) -> Engine:
    from metadata.ingestion.source.database.mssql.connection import (
        get_connection as get_mssql_connection,
    )

    return get_mssql_connection(airflow_connection)


@_get_connection.register
def _(airflow_connection: SQLiteConnection) -> Engine:
    from metadata.ingestion.source.database.sqlite.connection import (
        get_connection as get_sqlite_connection,
    )

    return get_sqlite_connection(airflow_connection)


def get_connection(connection: AirflowConnection) -> Engine:
    """
    Create connection
    """
    try:
        return _get_connection(connection.connection)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


def test_connection(engine: Engine) -> None:
    """
    Test connection
    """
    test_connection_db_common(engine)
