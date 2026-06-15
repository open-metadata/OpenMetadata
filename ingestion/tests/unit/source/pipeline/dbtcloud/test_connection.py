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
"""Unit tests for dbt Cloud connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.dbtcloud.connection import DBTCloudConnection

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.dbtcloud.connection"


def test_dbtcloud_connection_is_base_connection():
    assert issubclass(DBTCloudConnection, BaseConnection)


def test_get_client_builds_the_client():
    with patch(f"{CONNECTION_MODULE}.DBTCloudClient") as mock_builder:
        conn = DBTCloudConnection(MagicMock())
        client = conn.client

    assert client is mock_builder.return_value
    mock_builder.assert_called_once()


def test_test_connection_runs_steps():
    conn = DBTCloudConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
