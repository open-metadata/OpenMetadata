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
"""Unit tests for Grafana connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.grafana.connection import GrafanaConnection

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.grafana.connection"


def test_grafana_connection_is_base_connection():
    assert issubclass(GrafanaConnection, BaseConnection)


def test_test_connection_runs_steps():
    conn = GrafanaConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value


def _client_kwargs(verify_ssl_value):
    service_connection = MagicMock()
    service_connection.verifySSL = verify_ssl_value
    conn = GrafanaConnection(service_connection)
    with patch(f"{CONNECTION_MODULE}.GrafanaApiClient") as mock_client:
        conn._get_client()
    return mock_client.call_args.kwargs


def test_verify_ssl_honors_explicit_false():
    assert _client_kwargs(False)["verify_ssl"] is False


def test_verify_ssl_defaults_to_true_when_unset():
    assert _client_kwargs(None)["verify_ssl"] is True
