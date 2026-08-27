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
"""Unit tests for Databricks Pipeline connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.databrickspipeline.connection import DatabricksPipelineConnection

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.databrickspipeline.connection"


def test_databrickspipeline_connection_is_base_connection():
    assert issubclass(DatabricksPipelineConnection, BaseConnection)


def test_get_client_builds_client():
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_engine,
        patch(f"{CONNECTION_MODULE}.DatabricksClient") as mock_client,
        patch(f"{CONNECTION_MODULE}.get_auth_config", return_value={}),
    ):
        conn = DatabricksPipelineConnection(MagicMock())
        client = conn.client

    assert client is mock_client.return_value
    mock_client.assert_called_once_with(conn.service_connection, mock_engine.return_value)


def test_close_disposes_the_engine():
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_engine,
        patch(f"{CONNECTION_MODULE}.DatabricksClient"),
        patch(f"{CONNECTION_MODULE}.get_auth_config", return_value={}),
    ):
        conn = DatabricksPipelineConnection(MagicMock())
        _ = conn.client
        conn.close()

    mock_engine.return_value.dispose.assert_called_once()


def test_test_connection_runs_steps():
    conn = DatabricksPipelineConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
