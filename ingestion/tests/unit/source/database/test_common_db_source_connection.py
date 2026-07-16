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
"""CommonDbSourceService owns a single BaseConnection and reuses it for the
test-connection step."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.ingestion.source.database.postgres.metadata import PostgresSource

MYSQL_CONFIG = {
    "type": "mysql",
    "serviceName": "local_mysql",
    "serviceConnection": {
        "config": {
            "type": "Mysql",
            "username": "openmetadata_user",
            "authType": {"password": "openmetadata_password"},
            "hostPort": "mysql-host:3306",
        }
    },
    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
}

POSTGRES_CONFIG = {
    "type": "postgres",
    "serviceName": "local_postgres",
    "serviceConnection": {
        "config": {
            "type": "Postgres",
            "username": "openmetadata_user",
            "authType": {"password": "openmetadata_password"},
            "hostPort": "postgres-host:5432",
            "database": "postgres",
        }
    },
    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
}


@pytest.fixture
def owned_connection():
    with patch("metadata.ingestion.source.database.common_db_source.create_connection") as mock_create_connection:
        yield mock_create_connection.return_value


def test_owned_connection_reused_for_test_connection(owned_connection):
    with patch("metadata.ingestion.source.database.database_service.run_test_connection") as mock_run_test_connection:
        source = MysqlSource.create(MYSQL_CONFIG, MagicMock())

    assert source.engine is owned_connection.client
    mock_run_test_connection.assert_called_once_with(source.metadata, owned_connection)


def test_owned_connection_closed_when_test_connection_fails(owned_connection):
    with (
        patch(
            "metadata.ingestion.source.database.database_service.run_test_connection",
            side_effect=RuntimeError("cannot connect"),
        ),
        pytest.raises(RuntimeError),
    ):
        MysqlSource.create(MYSQL_CONFIG, MagicMock())

    owned_connection.close.assert_called_once()


def test_set_inspector_disposes_previous_connection(owned_connection):
    with patch("metadata.ingestion.source.database.database_service.run_test_connection"):
        source = PostgresSource.create(POSTGRES_CONFIG, MagicMock())

    previous_engine = source.engine
    source.set_inspector("other_db")

    previous_engine.dispose.assert_called_once()
    owned_connection.close.assert_called_once()
    assert source._connection is owned_connection
