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
"""Unit tests for OpenSearch connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.search.opensearch.connection import OpenSearchConnection

CONNECTION_MODULE = "metadata.ingestion.source.search.opensearch.connection"


def test_opensearch_connection_is_base_connection():
    assert issubclass(OpenSearchConnection, BaseConnection)


def test_get_client_builds_opensearch_client():
    config = MagicMock()
    config.connectionArguments = None
    config.sslConfig = None
    with patch(f"{CONNECTION_MODULE}.OpenSearch") as mock_os:
        client = OpenSearchConnection(config).client

    assert client is mock_os.return_value


def test_test_connection_runs_steps():
    conn = OpenSearchConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value
