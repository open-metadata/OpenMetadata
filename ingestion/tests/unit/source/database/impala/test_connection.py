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
"""Unit tests for Impala connection handling."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    AuthMechanism,
    ImpalaScheme,
)
from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaConnection as ImpalaConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.impala.connection import ImpalaConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.impala.connection"


def _config(**kwargs) -> ImpalaConnectionConfig:
    base = {
        "scheme": ImpalaScheme.impala,
        "hostPort": "localhost:21050",
        "databaseSchema": "default",
    }
    base.update(kwargs)
    return ImpalaConnectionConfig(**base)


def test_impala_connection_is_base_connection():
    assert issubclass(ImpalaConnection, BaseConnection)


def test_get_client_injects_auth_kerberos_and_ssl_args():
    config = _config(
        authMechanism=AuthMechanism.GSSAPI,
        kerberosServiceName="impala",
        useSSL=True,
    )
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = ImpalaConnection(config).client
    built = mock_connection.call_args.kwargs["connection"]
    root = built.connectionArguments.root
    assert root["auth_mechanism"] == "GSSAPI"
    assert root["kerberos_service_name"] == "impala"
    assert root["use_ssl"] is True


def test_get_client_leaves_connection_arguments_unset_without_auth():
    config = _config(authMechanism=None, useSSL=None)
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = ImpalaConnection(config).client
    assert mock_connection.call_args.kwargs["connection"].connectionArguments is None


def test_get_client_uses_the_class_url_builder():
    config = _config()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = ImpalaConnection(config).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_impala_url():
    config = ImpalaConnectionConfig(scheme=ImpalaScheme.impala, hostPort="localhost:21050")
    assert ImpalaConnection.get_connection_url(config) == "impala://localhost:21050"


def test_impala_url_custom_auth():
    config = ImpalaConnectionConfig(
        scheme=ImpalaScheme.impala.value,
        username="username",
        password="password",
        hostPort="localhost:21050",
        connectionArguments={"auth": "CUSTOM"},
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://username:password@localhost:21050"

    config = ImpalaConnectionConfig(
        scheme=ImpalaScheme.impala.value,
        username="username@444",
        password="password@333",
        hostPort="localhost:21050",
        connectionArguments={"auth": "CUSTOM"},
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://username%40444:password%40333@localhost:21050"


def test_impala_url_conn_options_with_db():
    config = ImpalaConnectionConfig(
        hostPort="localhost:21050",
        databaseSchema="test_db",
        connectionOptions={"Key": "Value"},
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://localhost:21050/test_db?Key=Value"


def test_impala_url_conn_options_without_db():
    config = ImpalaConnectionConfig(
        hostPort="localhost:21050",
        connectionOptions={"Key": "Value"},
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://localhost:21050?Key=Value"


def test_impala_url_with_ldap_auth():
    config = ImpalaConnectionConfig(
        scheme=ImpalaScheme.impala.value,
        username="username",
        password="password",
        hostPort="localhost:21050",
        connectionArguments={"auth_mechanism": "LDAP"},
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://username:password@localhost:21050"


def test_impala_url_without_connection_arguments():
    config = ImpalaConnectionConfig(
        scheme=ImpalaScheme.impala.value,
        username="username",
        password="password",
        hostPort="localhost:21050",
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://username:password@localhost:21050"


def test_impala_url_without_connection_arguments_pass():
    config = ImpalaConnectionConfig(
        scheme=ImpalaScheme.impala.value,
        username="username",
        hostPort="localhost:21050",
    )
    assert ImpalaConnection.get_connection_url(config) == "impala://username@localhost:21050"
