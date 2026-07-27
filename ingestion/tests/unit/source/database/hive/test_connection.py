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


def test_hive_url():
    assert (
        HiveConnection.get_connection_url(HiveConnectionConfig(scheme=HiveScheme.hive, hostPort="localhost:10000"))
        == "hive://localhost:10000"
    )
    assert (
        HiveConnection.get_connection_url(HiveConnectionConfig(scheme=HiveScheme.hive_http, hostPort="localhost:1000"))
        == "hive+http://localhost:1000"
    )
    assert (
        HiveConnection.get_connection_url(HiveConnectionConfig(scheme=HiveScheme.hive_https, hostPort="localhost:1000"))
        == "hive+https://localhost:1000"
    )


def test_hive_url_custom_auth():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username",
        password="password",
        hostPort="localhost:10000",
        connectionArguments={"auth": "CUSTOM"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://username:password@localhost:10000"

    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username@444",
        password="password@333",
        hostPort="localhost:10000",
        connectionArguments={"auth": "CUSTOM"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://username%40444:password%40333@localhost:10000"


def test_hive_url_conn_options_with_db():
    config = HiveConnectionConfig(
        hostPort="localhost:10000",
        databaseSchema="test_db",
        connectionOptions={"Key": "Value"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://localhost:10000/test_db?Key=Value"


def test_hive_url_conn_options_without_db():
    config = HiveConnectionConfig(
        hostPort="localhost:10000",
        connectionOptions={"Key": "Value"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://localhost:10000?Key=Value"


def test_hive_url_with_kerberos_auth():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        hostPort="localhost:10000",
        connectionArguments={
            "auth": "KERBEROS",
            "kerberos_service_name": "hive",
        },
    )
    assert HiveConnection.get_connection_url(config) == "hive://localhost:10000"


def test_hive_url_with_ldap_auth():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username",
        password="password",
        hostPort="localhost:10000",
        connectionArguments={"auth": "LDAP"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://username:password@localhost:10000"


def test_hive_url_without_auth():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username",
        password="password",
        hostPort="localhost:10000",
        connectionArguments={"customKey": "value"},
    )
    assert HiveConnection.get_connection_url(config) == "hive://username:password@localhost:10000"


def test_hive_url_without_connection_arguments():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username",
        password="password",
        hostPort="localhost:10000",
    )
    assert HiveConnection.get_connection_url(config) == "hive://username:password@localhost:10000"


def test_hive_url_without_connection_arguments_pass():
    config = HiveConnectionConfig(
        scheme=HiveScheme.hive.value,
        username="username",
        hostPort="localhost:10000",
    )
    assert HiveConnection.get_connection_url(config) == "hive://username@localhost:10000"
