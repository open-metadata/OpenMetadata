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
Unit tests for the IOMETE connector — no live cluster required.
"""

import types
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.iometeConnection import (
    IometeConnection,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.iomete.connection import get_connection
from metadata.ingestion.source.database.iomete.metadata import IometeSource

# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def iomete_connection():
    return IometeConnection(
        hostPort="dev.iomete.cloud:443",
        username="alice",
        password="secret",
        cluster="dwh",
        dataPlane="spark-resources",
        catalog="spark_catalog",
        databaseSchema="default",
    )


@pytest.fixture
def iomete_connection_no_port():
    return IometeConnection(
        hostPort="dev.iomete.cloud",
        username="alice",
        password="secret",
        cluster="dwh",
        dataPlane="spark-resources",
    )


@pytest.fixture
def minimal_connection():
    return IometeConnection(
        hostPort="dev.iomete.cloud:443",
        username="alice",
        password="secret",
        cluster="dwh",
        dataPlane="spark-resources",
    )


# ── get_connection: URL construction ─────────────────────────────────────────


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_uses_flightsql_dialect(mock_engine, iomete_connection):
    get_connection(iomete_connection)
    url = mock_engine.call_args[0][0]
    assert url.drivername == "iomete"


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_parses_host_and_port(mock_engine, iomete_connection):
    get_connection(iomete_connection)
    url = mock_engine.call_args[0][0]
    assert url.host == "dev.iomete.cloud"
    assert url.port == 443


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_defaults_to_port_443_when_no_port(
    mock_engine, iomete_connection_no_port
):
    get_connection(iomete_connection_no_port)
    url = mock_engine.call_args[0][0]
    assert url.host == "dev.iomete.cloud"
    assert url.port == 443


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_passes_credentials(mock_engine, iomete_connection):
    get_connection(iomete_connection)
    url = mock_engine.call_args[0][0]
    assert url.username == "alice"
    assert url.password == "secret"


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_passes_cluster_query_param(mock_engine, iomete_connection):
    get_connection(iomete_connection)
    url = mock_engine.call_args[0][0]
    assert url.query["cluster"] == "dwh"


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_passes_data_plane_query_param(mock_engine, iomete_connection):
    get_connection(iomete_connection)
    url = mock_engine.call_args[0][0]
    assert url.query["data_plane"] == "spark-resources"


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_passes_catalog_as_database(mock_engine, minimal_connection):
    minimal_connection.catalog = "spark_catalog"
    get_connection(minimal_connection)
    url = mock_engine.call_args[0][0]
    assert url.database == "spark_catalog"


@patch("metadata.ingestion.source.database.iomete.connection.sqlalchemy.create_engine")
def test_get_connection_omits_database_when_catalog_not_set(
    mock_engine, minimal_connection
):
    get_connection(minimal_connection)
    url = mock_engine.call_args[0][0]
    assert url.database is None


def test_database_schema_field_exists_on_model(minimal_connection):
    """
    databaseSchema must exist as an attribute on IometeConnection even when not set.
    The shared test_connections.py accesses service_connection.databaseSchema directly
    without hasattr — if the field is missing the test connection step raises AttributeError.
    """
    assert hasattr(minimal_connection, "databaseSchema")
    assert minimal_connection.databaseSchema is None


def test_catalog_field_exists_on_model(minimal_connection):
    assert hasattr(minimal_connection, "catalog")
    assert minimal_connection.catalog is None


# ── IometeSource.create ───────────────────────────────────────────────────────

MOCK_WORKFLOW_CONFIG = {
    "source": {
        "type": "iomete",
        "serviceName": "iomete_test",
        "serviceConnection": {
            "config": {
                "type": "Iomete",
                "hostPort": "dev.iomete.cloud:443",
                "username": "alice",
                "password": "secret",
                "cluster": "dwh",
                "dataPlane": "spark-resources",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test-token"},
        }
    },
}


@patch(
    "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
)
def test_create_raises_for_wrong_connection_type(mock_test_conn):
    mock_metadata = MagicMock()
    bad_config = dict(MOCK_WORKFLOW_CONFIG)
    bad_config["source"] = dict(bad_config["source"])
    bad_config["source"]["serviceConnection"] = {
        "config": {"type": "Mysql", "hostPort": "localhost:3306", "username": "root"}
    }
    with pytest.raises(InvalidSourceException):
        IometeSource.create(bad_config["source"], mock_metadata)


# ── get_schema_definition ─────────────────────────────────────────────────────


@patch(
    "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
)
def test_get_schema_definition_returns_none_on_not_implemented(mock_test_conn):
    """Inspector raises NotImplementedError — must return None, not propagate."""
    mock_metadata = MagicMock()
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.source_config = MagicMock(includeDDL=False)

    inspector = types.SimpleNamespace()
    inspector.get_view_definition = MagicMock(side_effect=NotImplementedError)

    result = source.get_schema_definition("Regular", "my_table", "my_schema", inspector)
    assert result is None


@patch(
    "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
)
def test_get_schema_definition_returns_none_on_generic_exception(mock_test_conn):
    """Any unexpected exception must be swallowed and return None."""
    mock_metadata = MagicMock()
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.source_config = MagicMock(includeDDL=False)

    inspector = types.SimpleNamespace()
    inspector.get_view_definition = MagicMock(side_effect=RuntimeError("unexpected"))

    result = source.get_schema_definition("Regular", "my_table", "my_schema", inspector)
    assert result is None


@patch(
    "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
)
def test_get_schema_definition_returns_definition_for_view(mock_test_conn):
    """View type must fetch and return the DDL."""
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.source_config = MagicMock(includeDDL=False)

    inspector = types.SimpleNamespace()
    inspector.get_view_definition = MagicMock(return_value="CREATE VIEW v AS SELECT 1")

    result = source.get_schema_definition(TableType.View, "v", "my_schema", inspector)
    assert result == "CREATE VIEW v AS SELECT 1"


@patch(
    "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
)
def test_get_schema_definition_strips_whitespace(mock_test_conn):
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.source_config = MagicMock(includeDDL=True)

    inspector = types.SimpleNamespace()
    inspector.get_view_definition = MagicMock(
        return_value="  CREATE TABLE t (id INT)  "
    )

    result = source.get_schema_definition("Regular", "t", "my_schema", inspector)
    assert result == "CREATE TABLE t (id INT)"


# ── get_database_names ────────────────────────────────────────────────────────


def test_get_database_names_yields_catalog_when_set(minimal_connection):
    """When catalog is configured, get_database_names must yield it directly
    instead of falling through to the base which looks for connection.database."""
    minimal_connection.catalog = "spark_catalog"
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.service_connection = minimal_connection

    assert list(source.get_database_names()) == ["spark_catalog"]


def test_get_database_names_falls_back_to_base_when_catalog_not_set(minimal_connection):
    """Without a catalog the base implementation is used, which returns 'default'
    (no databaseName or database field on IometeConnection)."""
    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.service_connection = minimal_connection

    assert list(source.get_database_names()) == ["default"]


# ── set_inspector ─────────────────────────────────────────────────────────────


@patch("metadata.ingestion.source.database.iomete.metadata.get_connection")
@patch("metadata.ingestion.source.database.iomete.metadata.kill_active_connections")
def test_set_inspector_uses_catalog_field(mock_kill, mock_get_conn):
    """set_inspector must pass catalog=database_name to get_connection, not
    connection.database, because IometeConnection has no database field."""
    mock_engine = MagicMock()
    mock_get_conn.return_value = mock_engine

    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.engine = MagicMock()
        source.service_connection = IometeConnection(
            hostPort="dev.iomete.cloud:443",
            username="alice",
            password="secret",
            cluster="dwh",
            dataPlane="spark-resources",
            catalog="old_catalog",
        )
        source._connection_map = {}
        source._inspector_map = {}

    source.set_inspector("new_catalog")

    passed_connection = mock_get_conn.call_args[0][0]
    assert isinstance(passed_connection, IometeConnection)
    assert passed_connection.catalog == "new_catalog"
    assert source.engine is mock_engine


@patch("metadata.ingestion.source.database.iomete.metadata.get_connection")
@patch("metadata.ingestion.source.database.iomete.metadata.kill_active_connections")
def test_set_inspector_resets_connection_maps(mock_kill, mock_get_conn):
    """set_inspector must reset _connection_map and _inspector_map so
    cached inspectors for the old catalog are not reused."""
    mock_get_conn.return_value = MagicMock()

    with patch(
        "metadata.ingestion.source.database.iomete.metadata.IometeSource.__init__",
        return_value=None,
    ):
        source = IometeSource.__new__(IometeSource)
        source.engine = MagicMock()
        source.service_connection = IometeConnection(
            hostPort="dev.iomete.cloud:443",
            username="alice",
            password="secret",
            cluster="dwh",
            dataPlane="spark-resources",
        )
        source._connection_map = {"stale": object()}
        source._inspector_map = {"stale": object()}

    source.set_inspector("some_catalog")

    assert source._connection_map == {}
    assert source._inspector_map == {}
