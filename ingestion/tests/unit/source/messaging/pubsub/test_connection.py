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
"""Unit tests for Pub/Sub connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.messaging.pubsub.connection import PubSubConnection

CONNECTION_MODULE = "metadata.ingestion.source.messaging.pubsub.connection"


def test_pubsub_connection_is_base_connection():
    assert issubclass(PubSubConnection, BaseConnection)


def test_get_client_builds_pubsub_client():
    connection = MagicMock()
    connection.useEmulator = True
    connection.hostPort = "localhost:8085"
    connection.schemaRegistryEnabled = False
    connection.projectId = "test-project"
    with (
        patch(f"{CONNECTION_MODULE}.pubsub_v1.PublisherClient"),
        patch(f"{CONNECTION_MODULE}.pubsub_v1.SubscriberClient"),
    ):
        client = PubSubConnection(connection).client

    assert client.project_id == "test-project"


def test_test_connection_runs_steps():
    conn = PubSubConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
