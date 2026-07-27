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
"""Unit tests for DB2 connection handling."""

from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection as Db2ConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Scheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.db2.connection import (
    Db2Connection,
    Db2IbmiStrategy,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.db2.connection"


def _ibmi_config() -> Db2ConnectionConfig:
    return Db2ConnectionConfig(
        scheme=Db2Scheme.ibmi,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="myhost:8471",
        database="MYDB",
    )


def _db2_config() -> Db2ConnectionConfig:
    return Db2ConnectionConfig(
        scheme=Db2Scheme.db2_ibm_db,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:50000",
        database="testdb",
    )


def test_db2_connection_is_base_connection():
    assert issubclass(Db2Connection, BaseConnection)


def test_ibmi_url_drops_the_port():
    config = _ibmi_config()
    assert (
        Db2IbmiStrategy(config).get_connection_url(config)
        == "ibmi://openmetadata_user:openmetadata_password@myhost/MYDB"
    )


def test_ibmi_args_pass_the_port_via_connect_args():
    config = _ibmi_config()
    assert Db2IbmiStrategy(config).get_connection_args(config)["port"] == 8471


def test_ibmi_args_reject_a_non_numeric_port():
    config = _ibmi_config()
    config.hostPort = "myhost:not-a-port"
    with pytest.raises(ValueError, match="Invalid port"):
        Db2IbmiStrategy(config).get_connection_args(config)


def test_get_client_dispatches_ibmi_scheme_to_ibmi_strategy():
    config = _ibmi_config()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = Db2Connection(config).client
    url_fn = mock_connection.call_args.kwargs["get_connection_url_fn"]
    assert url_fn.__name__ == "get_connection_url"
    assert url_fn(config) == "ibmi://openmetadata_user:openmetadata_password@myhost/MYDB"


def test_get_client_dispatches_db2_scheme_to_standard_strategy():
    config = _db2_config()
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection,
        patch(f"{CONNECTION_MODULE}.check_ssl_and_init", return_value=None),
    ):
        _ = Db2Connection(config).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url_common"
