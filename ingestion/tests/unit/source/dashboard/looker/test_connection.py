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
"""Unit tests for Looker connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.looker.connection import LookerConnection

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.looker.connection"


def test_looker_connection_is_base_connection():
    assert issubclass(LookerConnection, BaseConnection)


def test_get_client_initialises_the_sdk():
    config = MagicMock()
    config.clientId = "client-id"
    config.clientSecret.get_secret_value.return_value = "secret"
    config.hostPort = "https://looker.example.com"
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        conn = LookerConnection(config)
        client = conn.client

    assert client is mock_sdk.init40.return_value
    mock_sdk.init40.assert_called_once()


def test_test_connection_runs_steps():
    conn = LookerConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
