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
"""Unit tests for the Solr connection handler."""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.search.solrConnection import (
    SolrConnection as SolrConnectionConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.search.solr.connection import SolrConnection

CONNECTION_MODULE = "metadata.ingestion.source.search.solr.connection"


def _config(**overrides) -> SolrConnectionConfig:
    base = {
        "type": "Solr",
        "hostPort": "http://localhost:8983/solr",
        "username": "admin",
        "password": "secret",
    }
    base.update(overrides)
    return SolrConnectionConfig(**base)


def test_solr_connection_is_base_connection():
    assert issubclass(SolrConnection, BaseConnection)


def test_get_client_builds_solr_client_with_auth():
    with patch(f"{CONNECTION_MODULE}.SolrClient") as mock_client:
        conn = SolrConnection(_config())
        client = conn.client

    assert client is mock_client.return_value
    _, kwargs = mock_client.call_args
    assert kwargs["base_url"] == "http://localhost:8983/solr"
    assert kwargs["username"] == "admin"
    assert kwargs["password"] == "secret"
    # Default verifySSL is "no-ssl", which resolves to None (requests default CAs).
    assert kwargs["verify_ssl"] is None


def test_get_client_ignore_ssl_disables_verification():
    with patch(f"{CONNECTION_MODULE}.SolrClient") as mock_client:
        conn = SolrConnection(_config(verifySSL=VerifySSL.ignore))
        _ = conn.client

    _, kwargs = mock_client.call_args
    assert kwargs["verify_ssl"] is False


def test_get_client_validate_ssl_uses_ca_path():
    ssl_config = {"caCertificate": "/certs/ca.pem"}
    with patch(f"{CONNECTION_MODULE}.SolrClient") as mock_client:
        conn = SolrConnection(_config(verifySSL=VerifySSL.validate, sslConfig=ssl_config))
        _ = conn.client

    _, kwargs = mock_client.call_args
    assert kwargs["verify_ssl"] == "/certs/ca.pem"


def test_test_connection_runs_expected_steps():
    conn = SolrConnection(_config())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value
    _, kwargs = mock_steps.call_args
    assert set(kwargs["test_fn"].keys()) == {"CheckAccess", "GetSearchIndexes"}
