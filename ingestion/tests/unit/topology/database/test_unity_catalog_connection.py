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
Tests for unitycatalog.connection.
"""

from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.service.catalog import TableType
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.unitycatalog import connection as uc_connection
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_catalogs,
    get_schemas,
    get_sqlalchemy_connection,
    get_tables,
    get_views,
)
from metadata.ingestion.source.database.unitycatalog.models import DatabricksTable


def _connection(**overrides) -> UnityCatalogConnection:
    defaults = {
        "hostPort": "test-host:443",
        "authType": PersonalAccessToken(token="test-token"),
    }
    defaults.update(overrides)
    return UnityCatalogConnection(**defaults)


def test_returns_engine_when_http_path_and_connection_args_are_unset():
    """
    Regression for the AttributeError raised on
    `connection.connectionArguments.root.update(auth_args)` when both
    httpPath and connectionArguments are omitted from the service config.
    """
    connection = _connection()
    assert connection.httpPath is None
    assert connection.connectionArguments is None

    engine = get_sqlalchemy_connection(connection)

    assert isinstance(engine, Engine)


def test_returns_engine_when_http_path_is_set():
    """Engine is created and http_path is accepted as a connect arg."""
    connection = _connection(httpPath="/sql/1.0/warehouses/abc")

    engine = get_sqlalchemy_connection(connection)

    assert isinstance(engine, Engine)
    assert engine.url.host == "test-host"


def _named_mock(name: str, **attributes) -> MagicMock:
    mock = MagicMock(**attributes)
    mock.name = name
    return mock


def _workspace_client(catalogs=None, schemas=None, tables=None) -> MagicMock:
    client = MagicMock()
    client.catalogs.list.return_value = iter(catalogs or [])
    client.schemas.list.return_value = iter(schemas or [])
    client.tables.list.return_value = iter(tables or [])
    return client


class TestGetCatalogs:
    def test_picks_first_non_internal_catalog_when_not_configured(self):
        client = _workspace_client(catalogs=[_named_mock("__databricks_internal"), _named_mock("main")])
        table_obj = DatabricksTable()

        get_catalogs(client, table_obj)

        assert table_obj.catalog_name == "main"

    def test_validates_configured_catalog(self):
        client = _workspace_client()
        client.catalogs.get.return_value = _named_mock("configured_catalog")
        table_obj = DatabricksTable()

        get_catalogs(client, table_obj, catalog_name="configured_catalog")

        client.catalogs.get.assert_called_once_with("configured_catalog")
        client.catalogs.list.assert_not_called()
        assert table_obj.catalog_name == "configured_catalog"

    def test_configured_catalog_failure_propagates(self):
        client = _workspace_client()
        client.catalogs.get.side_effect = Exception("catalog not found")
        table_obj = DatabricksTable()

        with pytest.raises(Exception, match="catalog not found"):
            get_catalogs(client, table_obj, catalog_name="missing_catalog")

        assert table_obj.catalog_name is None


class TestGetSchemas:
    def test_picks_first_schema_when_not_configured(self):
        client = _workspace_client(schemas=[_named_mock("bronze"), _named_mock("silver")])
        table_obj = DatabricksTable(catalog_name="main")

        get_schemas(client, table_obj)

        client.schemas.list.assert_called_once_with(catalog_name="main")
        assert table_obj.schema_name == "bronze"

    def test_validates_configured_schema(self):
        client = _workspace_client()
        client.schemas.get.return_value = _named_mock("configured_schema")
        table_obj = DatabricksTable(catalog_name="main")

        get_schemas(client, table_obj, schema_name="configured_schema")

        client.schemas.get.assert_called_once_with("main.configured_schema")
        client.schemas.list.assert_not_called()
        assert table_obj.schema_name == "configured_schema"

    def test_raises_when_catalog_unresolved(self):
        client = _workspace_client()
        table_obj = DatabricksTable()

        with pytest.raises(SourceConnectionException, match="Could not resolve a catalog"):
            get_schemas(client, table_obj)


class TestGetTables:
    def test_sets_first_table_name(self):
        client = _workspace_client(tables=[_named_mock("orders"), _named_mock("customers")])
        table_obj = DatabricksTable(catalog_name="main", schema_name="bronze")

        get_tables(client, table_obj)

        client.tables.list.assert_called_once_with(catalog_name="main", schema_name="bronze", max_results=1)
        assert table_obj.name == "orders"

    def test_raises_when_catalog_unresolved(self):
        client = _workspace_client()
        table_obj = DatabricksTable(schema_name="bronze")

        with pytest.raises(SourceConnectionException, match="Could not resolve a catalog"):
            get_tables(client, table_obj)

        client.tables.list.assert_not_called()

    def test_raises_when_schema_unresolved(self):
        client = _workspace_client()
        table_obj = DatabricksTable(catalog_name="main")

        with pytest.raises(SourceConnectionException, match="USE SCHEMA"):
            get_tables(client, table_obj)

        client.tables.list.assert_not_called()


class TestGetViews:
    def test_lists_views_from_resolved_catalog_and_schema(self):
        client = _workspace_client(
            tables=[
                _named_mock("orders", table_type=TableType.MANAGED),
                _named_mock("orders_view", table_type=TableType.VIEW),
            ]
        )
        table_obj = DatabricksTable(catalog_name="main", schema_name="bronze")

        get_views(client, table_obj)

        client.tables.list.assert_called_once_with(catalog_name="main", schema_name="bronze")

    def test_raises_when_catalog_and_schema_unresolved(self):
        client = _workspace_client()
        table_obj = DatabricksTable()

        with pytest.raises(SourceConnectionException, match="Could not resolve a catalog"):
            get_views(client, table_obj)

        client.tables.list.assert_not_called()


class TestTestConnectionWiring:
    def test_steps_are_wired_with_configured_catalog_and_schema(self):
        service_connection = _connection(catalog="configured_catalog", databaseSchema="configured_schema")
        client = MagicMock()

        with (
            patch.object(uc_connection, "get_connection", return_value=client),
            patch.object(uc_connection, "get_sqlalchemy_connection"),
            patch.object(uc_connection, "test_connection_steps") as mock_steps,
        ):
            uc_connection.UnityCatalogConnection(service_connection).test_connection(MagicMock())

        test_fn = mock_steps.call_args.kwargs["test_fn"]
        assert test_fn["GetTables"].func is get_tables
        assert test_fn["GetViews"].func is get_views
        assert test_fn["GetDatabases"].func is get_catalogs
        assert test_fn["GetSchemas"].func is get_schemas
        assert test_fn["GetDatabases"].args[-1] == "configured_catalog"
        assert test_fn["GetSchemas"].args[-1] == "configured_schema"
