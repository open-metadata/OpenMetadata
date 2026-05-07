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
Tests for unitycatalog.connection.get_sqlalchemy_connection.
"""

from unittest.mock import MagicMock

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_sqlalchemy_connection,
    select_test_catalog,
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


def _catalog(name: str, catalog_type: str = "MANAGED_CATALOG"):
    """Build a stand-in for a Databricks SDK CatalogInfo."""
    obj = MagicMock()
    obj.name = name
    obj.catalog_type = catalog_type
    return obj


def test_select_test_catalog_uses_configured_catalog():
    """Catalog pinned in the form wins; SDK is not even queried."""
    workspace = MagicMock()
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog="my_catalog")

    assert table_obj.catalog_name == "my_catalog"
    workspace.catalogs.list.assert_not_called()


def test_select_test_catalog_uses_configured_catalog_even_when_foreign():
    """If the user explicitly pins a foreign catalog, respect that — they
    own that decision and may have valid credentials configured for it."""
    workspace = MagicMock()
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog="postgres_catalog")

    assert table_obj.catalog_name == "postgres_catalog"
    workspace.catalogs.list.assert_not_called()


def test_select_test_catalog_skips_databricks_internal():
    workspace = MagicMock()
    workspace.catalogs.list.return_value = [
        _catalog("__databricks_internal"),
        _catalog("main"),
    ]
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog=None)

    assert table_obj.catalog_name == "main"


def test_select_test_catalog_skips_foreign_catalogs():
    """Regression for the `postgres_catalog` PG password failure: federated
    catalogs must not be auto-picked because their information_schema
    pushes down to the source DB."""
    workspace = MagicMock()
    workspace.catalogs.list.return_value = [
        _catalog("postgres_catalog", "FOREIGN_CATALOG"),
        _catalog("snowflake_catalog", "FOREIGN_CATALOG"),
        _catalog("main", "MANAGED_CATALOG"),
    ]
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog=None)

    assert table_obj.catalog_name == "main"


def test_select_test_catalog_handles_missing_catalog_type():
    """Older SDK versions / sparse responses without catalog_type still pick."""
    workspace = MagicMock()
    catalog = MagicMock(spec=["name"])
    catalog.name = "main"
    workspace.catalogs.list.return_value = [catalog]
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog=None)

    assert table_obj.catalog_name == "main"


def test_select_test_catalog_when_only_foreign_catalogs_exist():
    """If every catalog is foreign, leave catalog_name unset rather than
    silently picking one that will fail downstream."""
    workspace = MagicMock()
    workspace.catalogs.list.return_value = [
        _catalog("postgres_catalog", "FOREIGN_CATALOG"),
    ]
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog=None)

    assert table_obj.catalog_name is None


def test_select_test_catalog_accepts_enum_like_catalog_type():
    """The Databricks SDK exposes catalog_type as an enum whose str() looks
    like 'CatalogType.FOREIGN_CATALOG'. The substring check handles that."""
    enum_like = MagicMock()
    enum_like.__str__ = lambda self: "CatalogType.FOREIGN_CATALOG"
    foreign = MagicMock()
    foreign.name = "postgres_catalog"
    foreign.catalog_type = enum_like
    managed_enum = MagicMock()
    managed_enum.__str__ = lambda self: "CatalogType.MANAGED_CATALOG"
    managed = MagicMock()
    managed.name = "main"
    managed.catalog_type = managed_enum

    workspace = MagicMock()
    workspace.catalogs.list.return_value = [foreign, managed]
    table_obj = DatabricksTable()

    select_test_catalog(workspace, table_obj, configured_catalog=None)

    assert table_obj.catalog_name == "main"
