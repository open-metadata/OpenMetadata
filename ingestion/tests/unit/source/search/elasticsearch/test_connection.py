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
"""Unit tests for Elasticsearch connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.search.elasticsearch.connection import (
    ElasticsearchConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.search.elasticsearch.connection"


def test_elasticsearch_connection_is_base_connection():
    assert issubclass(ElasticsearchConnection, BaseConnection)


def test_get_client_builds_elasticsearch():
    config = MagicMock()
    config.connectionArguments.root = {}
    config.sslConfig = None
    with patch(f"{CONNECTION_MODULE}.Elasticsearch") as mock_es:
        conn = ElasticsearchConnection(config)
        client = conn.client

    assert client is mock_es.return_value
    mock_es.assert_called_once()


def test_test_connection_runs_steps():
    conn = ElasticsearchConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value
