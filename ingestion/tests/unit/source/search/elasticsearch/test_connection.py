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

def test_elasticsearch_client_verify_ssl_cases():
    from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
    
    with patch(f"{CONNECTION_MODULE}.Elasticsearch") as mock_es:
        # Ignore
        config = MagicMock()
        config.verifySSL = VerifySSL.ignore
        config.connectionArguments.root = {}
        config.sslConfig = None
        ElasticsearchConnection(config)._get_client()
        mock_es.assert_called_with(
            str(config.hostPort),
            basic_auth=None,
            api_key=None,
            ssl_context=None,
            verify_certs=False,
            ssl_show_warn=True,
        )
        
        mock_es.reset_mock()
        # Validate
        config.verifySSL = VerifySSL.validate
        ElasticsearchConnection(config)._get_client()
        mock_es.assert_called_with(
            str(config.hostPort),
            basic_auth=None,
            api_key=None,
            ssl_context=None,
            verify_certs=True,
            ssl_show_warn=False,
        )
        
        mock_es.reset_mock()
        # No-SSL
        config.verifySSL = VerifySSL.no_ssl
        ElasticsearchConnection(config)._get_client()
        mock_es.assert_called_with(
            str(config.hostPort),
            basic_auth=None,
            api_key=None,
            ssl_context=None,
            verify_certs=False,
            ssl_show_warn=False,
        )
