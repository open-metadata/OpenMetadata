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
"""Unit tests for Hive connection handling."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    Auth,
    HiveScheme,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection as HiveConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.hive.connection import HiveConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.hive.connection"


def _config(**kwargs) -> HiveConnectionConfig:
    base = {
        "scheme": HiveScheme.hive,
        "hostPort": "localhost:10000",
        "databaseSchema": "default",
    }
    base.update(kwargs)
    return HiveConnectionConfig(**base)


def test_hive_connection_is_base_connection():
    assert issubclass(HiveConnection, BaseConnection)


def test_get_client_injects_auth_and_kerberos_args():
    config = _config(auth=Auth.LDAP, kerberosServiceName="hive")
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection,
        patch(f"{CONNECTION_MODULE}.check_ssl_and_init", return_value=None),
    ):
        _ = HiveConnection(config).client
    root = mock_connection.call_args.kwargs["connection"].connectionArguments.root
    assert root["auth"] == "LDAP"
    assert root["kerberos_service_name"] == "hive"


def test_get_client_runs_ssl_setup_when_manager_present():
    config = _config(useSSL=True)
    ssl_manager = type("M", (), {"setup_ssl": staticmethod(lambda conn: conn)})()
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection,
        patch(f"{CONNECTION_MODULE}.check_ssl_and_init", return_value=ssl_manager),
    ):
        _ = HiveConnection(config).client
    assert mock_connection.call_args.kwargs["connection"].connectionArguments.root["use_ssl"] is True
