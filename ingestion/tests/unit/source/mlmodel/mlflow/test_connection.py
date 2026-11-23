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
"""Unit tests for MLflow connection handling."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection as MlflowConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.mlmodel.mlflow.connection import MlflowConnection

CONNECTION_MODULE = "metadata.ingestion.source.mlmodel.mlflow.connection"


def test_mlflow_connection_is_base_connection():
    assert issubclass(MlflowConnection, BaseConnection)


@pytest.mark.parametrize("registry_uri", ["mysql+pymysql://user:password@localhost/demo_db", "http://localhost:5000"])
def test_get_client_builds_mlflow_client(registry_uri):
    config = MlflowConnectionConfig(trackingUri="http://localhost:5000", registryUri=registry_uri)
    with patch(f"{CONNECTION_MODULE}.MlflowClient") as mock_builder:
        conn = MlflowConnection(config)
        client = conn.client

    assert client is mock_builder.return_value
    mock_builder.assert_called_once_with(tracking_uri="http://localhost:5000", registry_uri=registry_uri)


def test_get_client_resolves_registry_secret_reference():
    config = MlflowConnectionConfig(trackingUri="http://localhost:5000", registryUri="secret:my_registry")
    with (
        patch("metadata.utils.secrets.secrets_manager_factory.SecretsManagerFactory") as factory,
        patch(f"{CONNECTION_MODULE}.MlflowClient") as mock_builder,
    ):
        factory.return_value.get_secrets_manager.return_value.get_string_value.return_value = "http://localhost:5000"
        with MlflowConnection(config) as connection:
            assert connection.client is mock_builder.return_value
    mock_builder.assert_called_once_with(tracking_uri="http://localhost:5000", registry_uri="http://localhost:5000")


def test_test_connection_runs_steps():
    conn = MlflowConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
