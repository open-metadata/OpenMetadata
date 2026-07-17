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

"""Unit tests for Snowflake semantic view ingestion (issue #23680)."""

from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.ingestion.source.database.snowflake.utils import get_semantic_view_names


def test_semantic_view_table_type_exists():
    assert TableType.SemanticView.value == "SemanticView"


def test_include_semantic_views_defaults_to_false():
    field = SnowflakeConnection.model_fields["includeSemanticViews"]
    assert field.default is False


def test_get_semantic_view_names_maps_rows_to_semantic_view_type():
    # SHOW SEMANTIC VIEWS returns rows shaped (created_on, name, database, schema, ...)
    rows = [
        ("2026-01-01", "SALES_SEMANTIC", "DB", "PUBLIC"),
        ("2026-01-02", "ORDERS_SEMANTIC", "DB", "PUBLIC"),
    ]
    connection = Mock()
    connection.execute.return_value = iter(rows)

    dialect = Mock()
    # get_semantic_view_names(dialect, ...) binds `dialect` as `self`, so
    # `self.normalize_name(row[1])` calls this single-arg lambda with the name.
    dialect.normalize_name = lambda name: name

    result = get_semantic_view_names(dialect, connection, schema="PUBLIC")

    names = [t.name for t in result.tables]
    assert names == ["SALES_SEMANTIC", "ORDERS_SEMANTIC"]
    assert all(t.type_ == TableType.SemanticView for t in result.tables)
    assert all(t.deleted is None for t in result.tables)


def test_get_schema_definition_uses_semantic_view_definition():
    inspector = Mock()
    inspector.get_semantic_view_definition.return_value = "CREATE SEMANTIC VIEW SALES_SEMANTIC ..."

    self_mock = Mock()
    self_mock.connection = Mock()

    result = SnowflakeSource.get_schema_definition(
        self_mock,
        table_type=TableType.SemanticView,
        table_name="SALES_SEMANTIC",
        schema_name="PUBLIC",
        inspector=inspector,
    )

    inspector.get_semantic_view_definition.assert_called_once_with(self_mock.connection, "SALES_SEMANTIC", "PUBLIC")
    assert result == "CREATE SEMANTIC VIEW SALES_SEMANTIC ..."


def test_semantic_view_has_no_columns():
    inspector = Mock()

    result = SnowflakeSource._get_columns_internal(
        Mock(),
        schema_name="PUBLIC",
        table_name="SALES_SEMANTIC",
        db_name="DB",
        inspector=inspector,
        table_type=TableType.SemanticView,
    )

    assert result == []
    assert inspector.get_columns.call_count == 0


def test_query_table_names_includes_semantic_views_when_enabled():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = True
    self_mock._get_table_names_and_types.return_value = []
    self_mock._get_semantic_view_names_and_types.return_value = [
        TableNameAndType(name="SALES_SEMANTIC", type_=TableType.SemanticView)
    ]

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    self_mock._get_semantic_view_names_and_types.assert_called_once_with("PUBLIC")
    assert [t.name for t in result] == ["SALES_SEMANTIC"]


def test_query_table_names_excludes_semantic_views_when_disabled():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = False
    self_mock._get_table_names_and_types.return_value = []

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    self_mock._get_semantic_view_names_and_types.assert_not_called()
    assert result == []


def test_query_table_names_swallows_semantic_view_errors():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = True
    self_mock._get_table_names_and_types.return_value = [TableNameAndType(name="T1", type_=TableType.Regular)]
    self_mock._get_semantic_view_names_and_types.side_effect = Exception("Unsupported feature: SEMANTIC VIEWS")

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    assert [t.name for t in result] == ["T1"]
