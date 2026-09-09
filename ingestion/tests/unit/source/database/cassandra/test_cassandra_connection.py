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
"""Unit tests for Cassandra connection handling."""

from typing import Optional
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.cassandra.cloudConfig import (
    CloudConfig,
    CloudConfig1,
)
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection as CassandraConnectionConfig,
)
from metadata.ingestion.source.database.cassandra.connection import get_connection

CONNECTION_MODULE = "metadata.ingestion.source.database.cassandra.connection"


def _cloud_config(token: Optional[str] = "astra-token") -> CassandraConnectionConfig:
    return CassandraConnectionConfig(
        authType=CloudConfig(
            cloudConfig=CloudConfig1(
                token=token,
                secureConnectBundle="/tmp/secure-connect-bundle.zip",
            )
        )
    )


def test_get_client_unwraps_astra_token():
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        get_connection(_cloud_config())

    auth_provider = mock_cluster.call_args.kwargs["auth_provider"]
    assert auth_provider.password == "astra-token"


def test_get_client_allows_missing_astra_token():
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        get_connection(_cloud_config(token=None))

    auth_provider = mock_cluster.call_args.kwargs["auth_provider"]
    assert auth_provider.password is None
