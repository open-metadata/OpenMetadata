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


def test_get_client_uses_the_module_url_builder():
    config = _config()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = ImpalaConnection(config).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"
