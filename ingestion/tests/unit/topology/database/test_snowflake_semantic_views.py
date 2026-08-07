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

import threading
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

import pytest
from sqlalchemy import exc as sa_exc
from sqlalchemy.sql.sqltypes import NullType

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.ingestion.source.database.snowflake.utils import (
    SEMANTIC_CATALOG_CACHE_SIZE,
    SEMANTIC_CATALOG_VIEWS,
    SEMANTIC_METRICS,
    SEMANTIC_VIEW_COLUMN_KINDS,
    _resolve_semantic_column_type,
    build_semantic_view_column,
    get_semantic_view_definition,
    get_semantic_view_names,
)

# Schema-wide catalog rows: SEMANTIC_VIEW_NAME leads, then
# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS).
_DIMENSION_ROWS = [
    ("SALES_SEMANTIC", "CUSTOMERS", "CUSTOMER_NAME", "VARCHAR(100)", "customers.c_name", "the name", "alias"),
    # same name as the fact -> must collapse onto one column
    ("SALES_SEMANTIC", "ORDERS", "LINE_AMOUNT", "NUMBER(12,2)", "orders.line_amount", None, None),
]
_FACT_ROWS = [
    ("SALES_SEMANTIC", "ORDERS", "LINE_AMOUNT", "NUMBER(12,2)", "orders.o_totalprice", None, None),
]
_METRIC_ROWS = [
    ("SALES_SEMANTIC", "ORDERS", "TOTAL_REVENUE", "NUMBER", "SUM(orders.line_amount)", None, None),
]


def _semantic_source():
    """A SnowflakeSource wired only far enough to exercise the semantic catalog."""
    source = SnowflakeSource.__new__(SnowflakeSource)
    context = MagicMock()
    context.get_current_thread_id.return_value = "test-thread"
    source.context = context
    source._connection_map = {"test-thread": MagicMock()}
    # __new__ skips __init__, which is where the per-thread catalog cache is created
    source._semantic_catalog_local = threading.local()

    def execute(clause):
        sql = str(clause.text)
        lowered = sql.lower()
        if "semantic_dimensions" in lowered:
            rows = _DIMENSION_ROWS
        elif "semantic_facts" in lowered:
            rows = _FACT_ROWS
        else:
            rows = _METRIC_ROWS

        # The per-view fallback query does NOT select SEMANTIC_VIEW_NAME, so it must
        # yield 6-column rows. Returning the 7-column schema-wide shape for both
        # would let a field-shift bug in either path pass unnoticed.
        if "SELECT SEMANTIC_VIEW_NAME" not in sql:
            return iter([row[1:] for row in rows])

        return iter(rows)

    source.connection.execute.side_effect = execute

    return source


def _executed_catalog_views(source):
    """Which INFORMATION_SCHEMA catalog views were actually queried, in order."""
    views = []
    for call in source.connection.execute.call_args_list:
        lowered = str(call.args[0].text).lower()
        views += [name for name in ("semantic_dimensions", "semantic_facts", "semantic_metrics") if name in lowered]

    return views


def test_semantic_column_description_is_the_raw_comment_only():
    """The kind, logical table, synonyms and expression all live on the Metric
    entity's dimensions/measures, so the column carries only Snowflake's COMMENT."""
    column = build_semantic_view_column(
        {
            "name": "REGION",
            "data_type": "VARCHAR",
            "expression": "customers.c_region",
            "comment": "Customer region",
        }
    )

    assert column["comment"] == "Customer region"


def test_semantic_column_description_is_none_without_a_comment():
    column = build_semantic_view_column({"name": "REGION", "data_type": "VARCHAR", "expression": "x", "comment": None})

    assert column["comment"] is None


def test_semantic_view_columns_exclude_metrics():
    """Metrics are Metric entities, not columns, so only dimensions and facts feed
    the semantic view Table's column list -- even though the batch fetches all three."""
    assert {kind for kind, _ in SEMANTIC_VIEW_COLUMN_KINDS} == {"Dimension", "Fact"}
    assert SEMANTIC_METRICS not in {view for _, view in SEMANTIC_VIEW_COLUMN_KINDS}
    assert SEMANTIC_METRICS in SEMANTIC_CATALOG_VIEWS


def test_batch_and_fallback_queries_return_the_same_column_layout():
    """Rows from the fallback must parse identically to batch rows with the leading
    SEMANTIC_VIEW_NAME stripped, or the fallback silently yields shifted fields."""
    from metadata.ingestion.source.database.snowflake.queries import (
        SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW,
        SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA,
    )

    def projection(query):
        select = query.strip().split("FROM")[0]
        return [column.strip() for column in select.replace("SELECT", "").split(",")]

    batch = projection(SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA)
    per_view = projection(SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW)

    assert batch[0] == "SEMANTIC_VIEW_NAME"
    assert batch[1:] == per_view


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


def test_fetch_semantic_view_columns_dedupes_names_and_maps_types():
    source = _semantic_source()

    columns = source._fetch_semantic_view_columns("PUBLIC", "SALES_SEMANTIC")

    by_name = {c["name"]: c for c in columns}
    assert set(by_name) == {"CUSTOMER_NAME", "LINE_AMOUNT"}

    dimension = by_name["CUSTOMER_NAME"]
    assert dimension["system_data_type"] == "VARCHAR(100)"
    # no kind tag, no logical table, no synonyms, no expression -- Metric carries those
    assert dimension["comment"] == "the name"
    assert by_name["LINE_AMOUNT"]["comment"] is None


def test_semantic_catalog_is_three_queries_per_schema_not_per_view():
    """The whole point of the schema-wide batch: query count must scale with the
    number of schemas, not the number of semantic views."""
    source = _semantic_source()

    for view in ("SALES_SEMANTIC", "ORDERS_SEMANTIC", "CUSTOMER_SEMANTIC"):
        source._fetch_semantic_view_columns("PUBLIC", view)
        source._semantic_rows("semantic_metrics", "PUBLIC", view)

    # 3 catalog views x 1 schema, regardless of how many views were asked for
    assert source.connection.execute.call_count == 3
    assert _executed_catalog_views(source) == ["semantic_dimensions", "semantic_facts", "semantic_metrics"]


def test_semantic_catalog_refetches_for_a_different_schema():
    source = _semantic_source()

    source._fetch_semantic_view_columns("PUBLIC", "SALES_SEMANTIC")
    source._fetch_semantic_view_columns("OTHER", "SALES_SEMANTIC")

    assert source.connection.execute.call_count == 6


def test_semantic_catalog_cache_is_bounded():
    """A schema with very many semantic objects must not be retained for the whole
    database run -- the LRU evicts past SEMANTIC_CATALOG_CACHE_SIZE."""
    source = _semantic_source()
    for index in range(SEMANTIC_CATALOG_CACHE_SIZE + 3):
        source._fetch_semantic_view_columns(f"SCHEMA_{index}", "SALES_SEMANTIC")

    assert len(source._semantic_catalog_cache()) == SEMANTIC_CATALOG_CACHE_SIZE


def test_semantic_catalog_falls_back_to_per_view_on_too_much_data():
    """Snowflake errno 90030 means the bulk information_schema query returned too
    much data; fall back to per-view queries rather than losing the metadata."""
    source = _semantic_source()
    too_much_data = sa_exc.ProgrammingError("stmt", {}, Exception())
    too_much_data.orig = SimpleNamespace(errno=90030)

    per_view_rows = [("CUSTOMERS", "CUSTOMER_NAME", "VARCHAR(100)", "customers.c_name", "the name", None)]
    source.connection.execute.side_effect = [too_much_data, iter(per_view_rows), iter([])]

    columns = source._fetch_semantic_view_columns("PUBLIC", "SALES_SEMANTIC")

    assert [c["name"] for c in columns] == ["CUSTOMER_NAME"]
    # the None sentinel is cached, so the bulk query is not retried per view
    assert source._semantic_catalog_cache().get("PUBLIC") is None


def test_semantic_catalog_reraises_other_programming_errors():
    source = _semantic_source()
    other = sa_exc.ProgrammingError("stmt", {}, Exception())
    other.orig = SimpleNamespace(errno=12345)
    source.connection.execute.side_effect = other

    with pytest.raises(sa_exc.ProgrammingError):
        source._semantic_rows("semantic_metrics", "PUBLIC", "SALES_SEMANTIC")


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
