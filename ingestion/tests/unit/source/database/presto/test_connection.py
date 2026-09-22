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
"""Unit tests for Presto connection handling."""

from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection as PrestoConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.presto.connection import PrestoConnection


def test_presto_connection_is_base_connection():
    assert issubclass(PrestoConnection, BaseConnection)


def test_url_with_catalog_and_no_password():
    connection = PrestoConnectionConfig(
        username="admin",
        hostPort="localhost:8080",
        scheme=PrestoScheme.presto,
        catalog="test_catalog",
    )
    assert PrestoConnection.get_connection_url(connection) == "presto://admin@localhost:8080/test_catalog"


def test_url_escapes_special_characters_in_credentials():
    connection = PrestoConnectionConfig(
        username="admin@333",
        password="pass@111",
        hostPort="localhost:8080",
        scheme=PrestoScheme.presto,
        catalog="test_catalog",
    )
    assert (
        PrestoConnection.get_connection_url(connection) == "presto://admin%40333:pass%40111@localhost:8080/test_catalog"
    )


def test_url_without_catalog():
    connection = PrestoConnectionConfig(
        scheme=PrestoScheme.presto,
        hostPort="localhost:8080",
        username="username",
        password="pass",
    )
    assert PrestoConnection.get_connection_url(connection) == "presto://username:pass@localhost:8080"
