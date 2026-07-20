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

from sqlalchemy.sql.sqltypes import NullType

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.snowflake.metadata import (
    SnowflakeSource,
    _resolve_semantic_column_type,
)
from metadata.ingestion.source.database.snowflake.utils import (
    get_semantic_view_definition,
    get_semantic_view_names,
)


def test_semantic_view_table_type_exists():
    assert TableType.SemanticView.value == "SemanticView"


def test_include_semantic_views_defaults_to_false():
    field = SnowflakeConnection.model_fields["includeSemanticViews"]
    assert field.default is False


def test_get_semantic_view_names_maps_rows_to_semantic_view_type():
    # INFORMATION_SCHEMA.SEMANTIC_VIEWS discovery selects a single NAME column.
    rows = [
        ("SALES_SEMANTIC",),
        ("ORDERS_SEMANTIC",),
    ]
    connection = Mock()
    connection.execute.return_value = iter(rows)

    dialect = Mock()
    # get_semantic_view_names(dialect, ...) binds `dialect` as `self`, so
    # `self.normalize_name(row[0])` calls this single-arg lambda with the name.
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


def test_semantic_view_columns_come_from_dimensions_facts_metrics():
    inspector = Mock()
    self_mock = Mock()
    self_mock._get_semantic_view_columns.return_value = [{"name": "CUSTOMER_NAME"}]

    result = SnowflakeSource._get_columns_internal(
        self_mock,
        schema_name="PUBLIC",
        table_name="SALES_SEMANTIC",
        db_name="DB",
        inspector=inspector,
        table_type=TableType.SemanticView,
    )

    self_mock._get_semantic_view_columns.assert_called_once_with("PUBLIC", "SALES_SEMANTIC")
    assert result == [{"name": "CUSTOMER_NAME"}]
    assert inspector.get_columns.call_count == 0


def test_fetch_semantic_view_columns_merges_kinds_and_maps_types():
    self_mock = Mock()
    # (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
    dimension_rows = [
        ("CUSTOMERS", "CUSTOMER_NAME", "VARCHAR(100)", "customers.c_name", "the name", None),
    ]
    fact_rows = [
        ("ORDERS", "LINE_AMOUNT", "NUMBER(12,2)", "orders.o_totalprice", None, None),
    ]
    metric_rows = [
        # same name as the fact -> kinds must merge onto one column
        ("ORDERS", "LINE_AMOUNT", "NUMBER(12,2)", "SUM(orders.line_amount)", None, None),
        ("ORDERS", "ORDER_COUNT", "NUMBER", "COUNT(orders.o_orderkey)", None, None),
    ]
    self_mock.connection.execute.side_effect = [
        iter(dimension_rows),
        iter(fact_rows),
        iter(metric_rows),
    ]

    columns = SnowflakeSource._fetch_semantic_view_columns(self_mock, "PUBLIC", "SALES_SEMANTIC")

    by_name = {c["name"]: c for c in columns}
    assert set(by_name) == {"CUSTOMER_NAME", "LINE_AMOUNT", "ORDER_COUNT"}

    dimension = by_name["CUSTOMER_NAME"]
    assert dimension["comment"].startswith("[Dimension]")
    assert "Logical table: CUSTOMERS." in dimension["comment"]
    assert "Expression: customers.c_name." in dimension["comment"]
    assert dimension["system_data_type"] == "VARCHAR(100)"

    # LINE_AMOUNT appears as both a fact and a metric -> both kinds on one column
    assert by_name["LINE_AMOUNT"]["comment"].startswith("[Fact, Metric]")


def test_get_semantic_view_columns_swallows_errors():
    self_mock = Mock()
    self_mock._fetch_semantic_view_columns.side_effect = Exception("SEMANTIC_DIMENSIONS not found")

    result = SnowflakeSource._get_semantic_view_columns(self_mock, "PUBLIC", "SALES_SEMANTIC")

    assert result == []


def test_resolve_semantic_column_type_maps_known_and_falls_back():
    assert _resolve_semantic_column_type("NUMBER(38,0)").__class__.__name__ != "NullType"
    assert _resolve_semantic_column_type("VARCHAR(100)").__class__.__name__ != "NullType"
    # Unknown/exotic base types fall back to NullType (OpenMetadata -> UNKNOWN)
    assert isinstance(_resolve_semantic_column_type("SOME_EXOTIC_TYPE"), NullType)
    assert isinstance(_resolve_semantic_column_type(None), NullType)


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


def test_get_semantic_view_definition_returns_ddl_when_row_found():
    self_mock = Mock()
    self_mock.default_schema_name = "PUBLIC"

    connection = Mock()
    connection.execute.return_value.fetchone.return_value = ("CREATE SEMANTIC VIEW SALES_SEMANTIC ...",)

    result = get_semantic_view_definition(self_mock, connection, "SALES_SEMANTIC", schema="PUBLIC")

    assert result == "CREATE SEMANTIC VIEW SALES_SEMANTIC ..."
    connection.execute.assert_called_once()


def test_get_semantic_view_definition_returns_none_when_no_row():
    self_mock = Mock()
    self_mock.default_schema_name = "PUBLIC"

    connection = Mock()
    connection.execute.return_value.fetchone.return_value = None

    result = get_semantic_view_definition(self_mock, connection, "SALES_SEMANTIC", schema="PUBLIC")

    assert result is None


def test_query_table_names_swallows_semantic_view_errors():
    self_mock = Mock()
    self_mock.service_connection.includeStreams = False
    self_mock.service_connection.includeStages = False
    self_mock.service_connection.includeSemanticViews = True
    self_mock._get_table_names_and_types.return_value = [TableNameAndType(name="T1", type_=TableType.Regular)]
    self_mock._get_semantic_view_names_and_types.side_effect = Exception("Unsupported feature: SEMANTIC VIEWS")

    result = SnowflakeSource.query_table_names_and_types(self_mock, "PUBLIC")

    assert [t.name for t in result] == ["T1"]
