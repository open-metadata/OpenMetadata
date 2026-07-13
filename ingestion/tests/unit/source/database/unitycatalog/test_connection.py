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
"""Unit tests for the Unity Catalog BaseConnection wiring (non-Engine: WorkspaceClient)."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection as UnityCatalogConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.unitycatalog.connection import UnityCatalogConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.unitycatalog.connection"


def _config() -> UnityCatalogConnectionConfig:
    return UnityCatalogConnectionConfig(
        hostPort="test-host:443",
        authType=PersonalAccessToken(token="test-token"),
    )


def test_unitycatalog_connection_is_base_connection():
    assert issubclass(UnityCatalogConnection, BaseConnection)


def test_get_client_delegates_to_the_workspace_client_builder():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get_connection:
        client = UnityCatalogConnection(_config()).client
    mock_get_connection.assert_called_once()
    assert client is mock_get_connection.return_value
