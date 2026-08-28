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

"""
Tests for GCP CloudSQL MySQL connection handling
"""

import inspect
import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.common.gcpCloudSqlConfig import (
    GcpCloudsqlConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.source.database.mysql.connection import _CloudSqlStrategy

_NAMESPACE_MODULES = (
    "google",
    "google.cloud",
    "google.cloud.sql",
    "google.cloud.sql.connector",
)


def _package_module(name: str) -> ModuleType:
    """Build a stub namespace module that behaves like a package.

    A ``__path__`` is required so that ``from google.cloud.sql.connector import
    Connector`` resolves; without it Python treats the parent as a non-package
    and raises "not a package" when the real google namespace isn't installed."""
    module = ModuleType(name)
    module.__path__ = []  # type: ignore[attr-defined]
    return module


@pytest.fixture(autouse=True)
def mock_connector():
    """Inject a fake google.cloud.sql.connector module into sys.modules so the
    lazy import inside _CloudSqlStrategy.build works without installing
    cloud-sql-python-connector."""
    connector_instance = MagicMock()
    connector_cls = MagicMock(return_value=connector_instance)

    connector_mod = ModuleType("google.cloud.sql.connector")
    connector_mod.Connector = connector_cls

    originals = {k: sys.modules.get(k) for k in _NAMESPACE_MODULES}

    sys.modules.setdefault("google", _package_module("google"))
    sys.modules.setdefault("google.cloud", _package_module("google.cloud"))
    sys.modules.setdefault("google.cloud.sql", _package_module("google.cloud.sql"))
    sys.modules["google.cloud.sql.connector"] = connector_mod

    yield connector_cls, connector_instance

    for key, val in originals.items():
        if val is None:
            sys.modules.pop(key, None)
        else:
            sys.modules[key] = val


class TestMySQLCloudSQLConnection:
    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_password_auth(self, mock_create_conn, mock_connector):
        mock_connector_cls, mock_connector_inst = mock_connector  # noqa: RUF059
        mock_create_conn.return_value = MagicMock()

        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="dbuser",
            authType=GcpCloudsqlConfigurationSource(
                password="dbpassword",
            ),
        )

        _CloudSqlStrategy(connection).build()

        mock_create_conn.assert_called_once()
        call_kwargs = mock_create_conn.call_args
        assert "creator" in call_kwargs.kwargs

        creator_fn = call_kwargs.kwargs["creator"]
        creator_fn()

        mock_connector_inst.connect.assert_called_once()
        connect_kwargs = mock_connector_inst.connect.call_args.kwargs
        assert connect_kwargs["instance_connection_string"] == "my-project:us-central1:my-instance"
        assert connect_kwargs["driver"] == "pymysql"
        assert connect_kwargs["user"] == "dbuser"
        assert connect_kwargs["password"] == "dbpassword"
        assert "enable_iam_auth" not in connect_kwargs

    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_iam_auth(self, mock_create_conn, mock_connector):
        _, mock_connector_inst = mock_connector
        mock_create_conn.return_value = MagicMock()

        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="sa@my-project.iam",
            authType=GcpCloudsqlConfigurationSource(
                enableIamAuth=True,
            ),
        )

        _CloudSqlStrategy(connection).build()

        creator_fn = mock_create_conn.call_args.kwargs["creator"]
        creator_fn()

        connect_kwargs = mock_connector_inst.connect.call_args.kwargs
        assert connect_kwargs["enable_iam_auth"] is True
        assert "password" not in connect_kwargs

    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_url_is_bare_scheme(self, mock_create_conn, mock_connector):
        mock_create_conn.return_value = MagicMock()

        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="dbuser",
            authType=GcpCloudsqlConfigurationSource(password="pw"),
        )

        _CloudSqlStrategy(connection).build()

        url_fn = mock_create_conn.call_args.kwargs["get_connection_url_fn"]
        assert url_fn(connection) == "mysql+pymysql://"

    @patch("metadata.ingestion.source.database.mysql.connection.set_google_credentials")
    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_sets_gcp_credentials_when_provided(self, mock_create_conn, mock_set_creds, mock_connector):
        mock_create_conn.return_value = MagicMock()

        gcp_config = MagicMock()
        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="dbuser",
            authType=GcpCloudsqlConfigurationSource(password="pw"),
        )
        connection.authType.gcpConfig = gcp_config

        _CloudSqlStrategy(connection).build()

        mock_set_creds.assert_called_once_with(gcp_config)

    @patch("metadata.ingestion.source.database.mysql.connection.set_google_credentials")
    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_skips_gcp_credentials_when_not_provided(self, mock_create_conn, mock_set_creds, mock_connector):
        mock_create_conn.return_value = MagicMock()

        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="dbuser",
            authType=GcpCloudsqlConfigurationSource(password="pw"),
        )

        _CloudSqlStrategy(connection).build()

        mock_set_creds.assert_not_called()

    @patch("metadata.ingestion.source.database.mysql.connection.create_generic_db_connection")
    def test_cloudsql_passes_database_schema(self, mock_create_conn, mock_connector):
        _, mock_connector_inst = mock_connector
        mock_create_conn.return_value = MagicMock()

        connection = MysqlConnection(
            hostPort="my-project:us-central1:my-instance",
            username="dbuser",
            databaseSchema="mydb",
            authType=GcpCloudsqlConfigurationSource(password="pw"),
        )

        _CloudSqlStrategy(connection).build()

        creator_fn = mock_create_conn.call_args.kwargs["creator"]
        creator_fn()

        connect_kwargs = mock_connector_inst.connect.call_args.kwargs
        assert connect_kwargs["db"] == "mydb"

    def test_cloudsql_imports_singular_connector_module(self):
        """Guard against the plural-module typo (google.cloud.sql.connectors).

        The other tests mock the module into sys.modules, so they pass under
        either name; this asserts the real source imports the correct singular
        google.cloud.sql.connector module the library actually exposes."""
        source = inspect.getsource(_CloudSqlStrategy.build)

        assert "from google.cloud.sql.connector import Connector" in source
        assert "google.cloud.sql.connectors" not in source
