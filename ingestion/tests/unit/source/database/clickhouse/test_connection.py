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
"""Unit tests for Clickhouse connection handling."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection as ClickhouseConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseScheme,
)
from metadata.ingestion.connections.builders import get_connection_url_common
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.clickhouse.connection import ClickhouseConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.clickhouse.connection"


def test_clickhouse_connection_is_base_connection():
    assert issubclass(ClickhouseConnection, BaseConnection)


def test_url_without_database_schema():
    connection = ClickhouseConnectionConfig(
        username="username",
        hostPort="localhost:8123",
        scheme=ClickhouseScheme.clickhouse_http,
        databaseSchema=None,
    )
    assert get_connection_url_common(connection) == "clickhouse+http://username:@localhost:8123"


def test_url_with_database_schema():
    connection = ClickhouseConnectionConfig(
        username="username",
        hostPort="localhost:8123",
        scheme=ClickhouseScheme.clickhouse_http,
        databaseSchema="default",
    )
    assert get_connection_url_common(connection) == "clickhouse+http://username:@localhost:8123/default"


def test_secure_and_keyfile_move_to_connection_arguments():
    connection = ClickhouseConnectionConfig(
        username="username",
        hostPort="localhost:8123",
        scheme=ClickhouseScheme.clickhouse_http,
        secure=True,
        keyfile="/path/to/key.pem",
    )
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection"):
        _ = ClickhouseConnection(connection).client
    assert connection.connectionArguments.root["secure"] is True
    assert connection.connectionArguments.root["keyfile"] == "/path/to/key.pem"
