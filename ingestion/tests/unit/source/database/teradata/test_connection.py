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
"""Unit tests for Teradata connection handling."""

from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection as TeradataConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.teradata.connection import TeradataConnection


def test_teradata_connection_is_base_connection():
    assert issubclass(TeradataConnection, BaseConnection)


def test_get_connection_url_with_credentials_and_defaults():
    connection = TeradataConnectionConfig(
        scheme=TeradataScheme.teradatasql,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:1025",
    )
    assert (
        TeradataConnection.get_connection_url(connection) == "teradatasql://localhost:1025/?user=openmetadata_user"
        "&password=openmetadata_password&logmech=TD2&tmode=DEFAULT"
    )
