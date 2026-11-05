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
"""Unit tests for Lightdash connection handling."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.lightdash.connection import LightdashConnection

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.lightdash.connection"


def test_lightdash_connection_is_base_connection():
    assert issubclass(LightdashConnection, BaseConnection)


def test_get_client_builds_the_client():
    with patch(f"{CONNECTION_MODULE}.LightdashApiClient") as mock_builder:
        conn = LightdashConnection(MagicMock())
        client = conn.client

    assert client is mock_builder.return_value
    mock_builder.assert_called_once()


def test_test_connection_runs_steps():
    conn = LightdashConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value


def test_get_client_wraps_construction_failure_with_interpolated_message():
    connection = MagicMock()
    connection.__str__ = MagicMock(return_value="LightdashConfig(hostPort='https://lightdash.example.com')")
    underlying = RuntimeError("kaboom")
    with patch(f"{CONNECTION_MODULE}.LightdashApiClient", side_effect=underlying):
        conn = LightdashConnection(connection)
        with pytest.raises(SourceConnectionException) as exc_info:
            _ = conn.client

    assert exc_info.value.__cause__ is underlying
    message = str(exc_info.value)
    assert "Unknown error connecting with" in message
    assert "LightdashConfig(hostPort='https://lightdash.example.com')" in message
    assert "kaboom" in message
    assert "{connection}" not in message
    assert "{exc}" not in message
