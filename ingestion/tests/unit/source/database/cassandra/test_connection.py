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
"""Unit tests for the Cassandra BaseConnection wiring (non-Engine: driver Session)."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection as CassandraConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.cassandra.connection import CassandraConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.cassandra.connection"


def _config() -> CassandraConnectionConfig:
    return CassandraConnectionConfig(hostPort="localhost:9042")


def test_cassandra_connection_is_base_connection():
    assert issubclass(CassandraConnection, BaseConnection)


def test_get_client_connects_a_cluster_session():
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        session = CassandraConnection(_config()).client
    mock_cluster.assert_called_once()
    mock_cluster.return_value.connect.assert_called_once_with()
    assert session is mock_cluster.return_value.connect.return_value
