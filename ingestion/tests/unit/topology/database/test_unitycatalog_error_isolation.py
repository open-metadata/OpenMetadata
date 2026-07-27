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
Tests for Unity Catalog error isolation.

Covers the failure-isolation behavior of the metadata extraction:
- SDK listing errors (catalogs/schemas/tables) record a status failure and keep
  the already-listed entities instead of aborting the whole ingestion.
- A malformed column is skipped with a warning instead of dropping its table.
- A failing tag query does not abort the remaining tag queries.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.service.catalog import (
    CatalogInfo,
    ColumnInfo,
    ColumnTypeName,
    SchemaInfo,
    TableInfo,
)
from databricks.sdk.service.catalog import TableType as DatabricksTableType

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

mock_unitycatalog_config = {
    "source": {
        "type": "unitycatalog",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "hive_metastore",
                "databaseSchema": "default",
                "authType": {"token": "123sawdtesttoken"},
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/abcdedfg",
                "connectionTimeout": 120,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {"excludes": []},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "unity_catalog"},
        }
    },
}

GOOD_COLUMN = ColumnInfo(
    name="good_col",
    position=0,
    type_json='{"name":"good_col","type":"integer","nullable":true,"metadata":{}}',
    type_name=ColumnTypeName.INT,
    type_text="int",
)
MALFORMED_COLUMN = ColumnInfo(
    name="bad_col",
    position=1,
    type_json="{not-valid-json",
    type_name=ColumnTypeName.INT,
    type_text="int",
)
ANOTHER_GOOD_COLUMN = ColumnInfo(
    name="another_good_col",
    position=2,
    type_json='{"name":"another_good_col","type":"string","nullable":true,"metadata":{}}',
    type_name=ColumnTypeName.STRING,
    type_text="string",
)


def _raising_listing(items, exc):
    """Emulate an SDK paginated listing that fails mid-iteration."""
    yield from items
    raise exc


@pytest.fixture
def uc_source():
    with patch.object(UnitycatalogSource, "test_connection", return_value=False):
        config = OpenMetadataWorkflowConfig.model_validate(mock_unitycatalog_config)
        source = UnitycatalogSource.create(
            mock_unitycatalog_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
    source.context.get().__dict__["database"] = "hive_metastore"
    source.context.get().__dict__["database_service"] = "local_unitycatalog"
    source.context.get().__dict__["database_schema"] = "default"
    source.client = MagicMock()
    return source


class TestListingErrorIsolation:
    """SDK listing failures record a status failure and keep prior results."""

    def test_catalog_listing_failure_keeps_prior_catalogs(self, uc_source):
        uc_source.client.catalogs.list.return_value = _raising_listing(
            [CatalogInfo(name="demo"), CatalogInfo(name="main")],
            Exception("429 Too Many Requests"),
        )

        names = list(uc_source.get_database_names_raw())

        assert names == ["demo", "main"]
        assert len(uc_source.status.failures) == 1
        assert uc_source.status.failures[0].name == "catalogs"
        assert "429 Too Many Requests" in uc_source.status.failures[0].error

    def test_catalog_listing_immediate_failure_records_status(self, uc_source):
        uc_source.client.catalogs.list.side_effect = Exception("503 Service Unavailable")

        names = list(uc_source.get_database_names_raw())

        assert names == []
        assert len(uc_source.status.failures) == 1
        assert "503 Service Unavailable" in uc_source.status.failures[0].error

    def test_schema_listing_failure_keeps_prior_schemas(self, uc_source):
        uc_source.client.schemas.list.return_value = _raising_listing(
            [
                SchemaInfo(catalog_name="hive_metastore", name="schema1"),
                SchemaInfo(catalog_name="hive_metastore", name="schema2"),
            ],
            Exception("token expired"),
        )

        names = list(uc_source.get_database_schema_names())

        assert names == ["schema1", "schema2"]
        assert len(uc_source.status.failures) == 1
        assert uc_source.status.failures[0].name == "schemas in catalog [hive_metastore]"

    def test_table_listing_failure_keeps_prior_tables(self, uc_source):
        uc_source.metadata = MagicMock()
        uc_source.metadata.es_search_from_fqn.return_value = None
        uc_source.client.tables.list.return_value = _raising_listing(
            [
                TableInfo(name="t1", table_type=DatabricksTableType.MANAGED),
                TableInfo(name="t2", table_type=DatabricksTableType.MANAGED),
            ],
            Exception("connection reset"),
        )

        tables = list(uc_source.get_tables_name_and_type())

        assert tables == [("t1", TableType.Regular), ("t2", TableType.Regular)]
        assert len(uc_source.status.failures) == 1
        assert uc_source.status.failures[0].name == "tables in schema [hive_metastore.default]"


class TestColumnErrorIsolation:
    """A malformed column is skipped instead of dropping the whole table."""

    def test_get_columns_skips_malformed_column(self, uc_source):
        columns = list(
            uc_source.get_columns(
                table_name="my_table",
                column_data=[GOOD_COLUMN, MALFORMED_COLUMN, ANOTHER_GOOD_COLUMN],
            )
        )

        assert [column.name.root for column in columns] == ["good_col", "another_good_col"]

    def test_yield_table_with_malformed_column_keeps_table(self, uc_source):
        table_info = TableInfo(
            catalog_name="hive_metastore",
            columns=[GOOD_COLUMN, MALFORMED_COLUMN, ANOTHER_GOOD_COLUMN],
            comment="table with one bad column",
            name="partially_bad_table",
            schema_name="default",
            table_constraints=[],
            table_type=DatabricksTableType.MANAGED,
        )
        uc_source.context.get().table_data = table_info

        results = list(uc_source.yield_table(("partially_bad_table", TableType.Regular)))

        table_requests = [either.right for either in results if either.right is not None]
        assert len(table_requests) == 1
        assert [column.name.root for column in table_requests[0].columns] == [
            "good_col",
            "another_good_col",
        ]


class TestTagQueryErrorIsolation:
    """A failing tag query does not abort the remaining tag queries."""

    def _mock_sql_connection(self, uc_source, execute_side_effect):
        mock_connection = MagicMock()
        mock_connection.execute.side_effect = execute_side_effect
        uc_source.engine = MagicMock()
        uc_source.engine.connect.return_value = mock_connection
        uc_source.metadata = MagicMock()
        uc_source.metadata.es_search_from_fqn.return_value = []
        return mock_connection

    def test_database_tag_query_failure_does_not_abort_remaining_queries(self, uc_source):
        schema_tag_row = SimpleNamespace(tag_name="env", tag_value="prod", schema_name="default")
        mock_connection = self._mock_sql_connection(
            uc_source,
            [Exception("catalog tags query failed"), [schema_tag_row]],
        )

        results = list(uc_source.yield_database_tag("hive_metastore"))

        assert mock_connection.execute.call_count == 2
        tag_requests = [either.right for either in results if either.right is not None]
        assert len(tag_requests) == 1
        assert tag_requests[0].tag_request.name.root == "prod"

    def test_table_tag_query_failure_does_not_abort_column_tags(self, uc_source):
        column_tag_row = SimpleNamespace(
            tag_name="pii",
            tag_value="sensitive",
            table_name="my_table",
            column_name="my_column",
        )
        mock_connection = self._mock_sql_connection(
            uc_source,
            [Exception("table tags query failed"), [column_tag_row]],
        )

        results = list(uc_source.yield_tag("default"))

        assert mock_connection.execute.call_count == 2
        tag_requests = [either.right for either in results if either.right is not None]
        assert len(tag_requests) == 1
        assert tag_requests[0].tag_request.name.root == "sensitive"
