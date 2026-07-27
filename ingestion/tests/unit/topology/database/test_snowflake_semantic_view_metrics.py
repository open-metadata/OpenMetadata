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
"""Unit tests for the Snowflake semantic-view metric builders."""

from unittest.mock import MagicMock

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Language, MetricType
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    build_metric_name,
    build_metric_request,
    infer_metric_type,
)

# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
TOTAL_REVENUE = ("orders", "total_revenue", "NUMBER", "SUM(orders.line_amount)", "Total revenue", None)
ORDER_COUNT = ("orders", "order_count", "NUMBER", "COUNT(orders.o_orderkey)", None, None)
DIM_REGION = ("customers", "region", "VARCHAR", "customers.c_region", "Customer region", "geo")
FACT_LINE_AMOUNT = ("orders", "line_amount", "NUMBER", "orders.o_totalprice", "Line amount", None)


def test_build_metric_name_is_qualified():
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "total_revenue")
    assert "snowflake_svc" in name
    assert "sales_analysis" in name
    assert name.endswith("total_revenue")
    # distinct views must produce distinct names
    other = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "other_view", "total_revenue")
    assert name != other


def test_infer_metric_type_by_prefix():
    assert infer_metric_type("SUM(x)") == MetricType.SUM
    assert infer_metric_type("count(x)") == MetricType.COUNT
    assert infer_metric_type("AVG(x)") == MetricType.AVERAGE
    assert infer_metric_type("MIN(x)") == MetricType.MIN
    assert infer_metric_type("MAX(x)") == MetricType.MAX
    assert infer_metric_type("x / y") == MetricType.OTHER
    assert infer_metric_type(None) == MetricType.OTHER


def test_build_metric_request_maps_all_fields():
    view_ref = EntityReference(id="12345678-1234-1234-1234-123456789012", type="table")
    request = build_metric_request(
        "snowflake_svc",
        "TEST_DB",
        "SALES",
        "sales_analysis",
        metric_row=TOTAL_REVENUE,
        dimension_rows=[DIM_REGION],
        fact_rows=[FACT_LINE_AMOUNT],
        view_ref=view_ref,
    )
    assert request.name.root.endswith("total_revenue")
    assert request.displayName == "total_revenue"
    assert request.description.root == "Total revenue"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.language == Language.SQL
    assert request.metricExpression.code == "SUM(orders.line_amount)"
    assert [d.name for d in request.dimensions] == ["region"]
    assert request.dimensions[0].expression == "customers.c_region"
    assert [m.name for m in request.measures] == ["line_amount"]
    assert request.measures[0].expression == "orders.o_totalprice"
    assert request.assets.root[0].id.root == view_ref.id.root


def test_build_metric_request_without_comment_or_assets():
    request = build_metric_request(
        "svc",
        "db",
        "sc",
        "v",
        metric_row=ORDER_COUNT,
        dimension_rows=[],
        fact_rows=[],
        view_ref=None,
    )
    assert request.description is None
    assert request.dimensions is None
    assert request.measures is None
    assert request.assets is None
    assert request.metricType == MetricType.COUNT


def _make_source():
    from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource

    source = SnowflakeSource.__new__(SnowflakeSource)
    context = MagicMock()
    context.get.return_value = MagicMock(database_service="snowflake_svc", database="TEST_DB", database_schema="SALES")
    # `connection` is a read-only property backed by `_connection_map`
    # (see CommonDbSourceService.connection) - populate the map directly
    # rather than assigning to the property.
    context.get_current_thread_id.return_value = "test-thread"
    source.context = context
    source._connection_map = {"test-thread": MagicMock()}
    source.metadata = MagicMock()
    view_entity = MagicMock()
    view_entity.id.root = "12345678-1234-1234-1234-123456789012"
    source.metadata.get_by_name.return_value = view_entity
    return source


def _rows_for(query):
    # `_semantic_rows` interpolates `{schema}`/`{semantic_view}` via `.format()`
    # before wrapping the query in `text(...)`, so the executed SQL text never
    # matches the raw, unformatted query constants byte-for-byte. Match on the
    # source catalog view name instead, which `.format()` leaves untouched.
    lowered = query.lower()
    if "semantic_dimensions" in lowered:
        return [DIM_REGION]
    if "semantic_facts" in lowered:
        return [FACT_LINE_AMOUNT]
    return [TOTAL_REVENUE, ORDER_COUNT]


def test_yield_semantic_view_metrics_yields_one_per_metric():
    source = _make_source()
    source.connection.execute.side_effect = lambda clause: _rows_for(str(clause.text))

    results = list(
        source.yield_semantic_view_metrics(TableNameAndType(name="sales_analysis", type_=TableType.SemanticView))
    )
    requests = [r.right for r in results if r.right is not None]
    assert len(requests) == 2
    names = {r.displayName for r in requests}
    assert names == {"total_revenue", "order_count"}
    revenue = next(r for r in requests if r.displayName == "total_revenue")
    assert str(revenue.assets.root[0].id.root) == "12345678-1234-1234-1234-123456789012"
    assert [d.name for d in revenue.dimensions] == ["region"]
    assert [m.name for m in revenue.measures] == ["line_amount"]


def test_yield_semantic_view_metrics_skips_non_semantic_tables():
    source = _make_source()
    results = list(source.yield_semantic_view_metrics(TableNameAndType(name="regular_table", type_=TableType.Regular)))
    assert results == []
    source.connection.execute.assert_not_called()


def test_yield_semantic_view_metrics_warns_and_continues_on_error():
    source = _make_source()
    source.connection.execute.side_effect = Exception("boom")
    results = list(
        source.yield_semantic_view_metrics(TableNameAndType(name="sales_analysis", type_=TableType.SemanticView))
    )
    assert results == []


def test_snowflake_topology_does_not_leak_into_base_topology():
    """Import-time isolation guard: constructing the Snowflake module must not
    mutate the shared base DatabaseServiceTopology definition."""
    import metadata.ingestion.source.database.snowflake.metadata  # noqa: F401
    from metadata.ingestion.source.database.database_service import (
        DatabaseServiceTopology,
    )

    base_stage_types = [stage.type_ for stage in DatabaseServiceTopology().table.stages]
    assert CreateMetricRequest not in base_stage_types
