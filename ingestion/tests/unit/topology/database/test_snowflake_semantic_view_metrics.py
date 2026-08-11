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

import inspect
import threading
from unittest.mock import MagicMock

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Language, MetricType, Type
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    MAX_METRIC_NAME_LENGTH,
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
    """The readable path leads the name; the trailing digest disambiguates paths
    that sanitize or join to the same string (see the collision tests below)."""
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "total_revenue")

    assert name.startswith("snowflake_svc-TEST_DB-SALES-sales_analysis-total_revenue-")


def test_build_metric_name_is_a_single_fqn_segment():
    """A Metric's FQN *is* its name, and the server appends dimension/measure names
    to it. Any dot would turn those into multi-segment FQNs that positional FQN
    parsers misread as service.database.schema.table.column."""
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "total_revenue")

    assert "." not in name


def test_build_metric_name_strips_separators_from_identifiers():
    """Quoted Snowflake identifiers may themselves contain dots, which would
    reintroduce FQN segments, and `::` is rejected by the entityName pattern."""
    name = build_metric_name("svc", '"my.db"', "S", '"v.1"', "a::b")

    assert name.startswith("svc-my_db-S-v_1-a__b-")
    assert "." not in name
    assert "::" not in name


def test_build_metric_name_is_unique_per_path_element():
    base = ("svc", "DB", "SCH", "view", "metric")
    variants = [build_metric_name(*(base[:index] + ("other",) + base[index + 1 :])) for index in range(len(base))]

    assert len(set(variants)) == len(base)
    assert build_metric_name(*base) not in variants


def test_build_metric_name_survives_lossy_sanitization():
    """`.` and `:` are rewritten to `_`, which is itself legal in an identifier, so
    the sanitized form alone is not injective: `a.b` and `a_b` are distinct Snowflake
    objects that must not collapse onto one Metric. A Metric's FQN *is* its name, so
    a collision silently overwrites one metric with the other."""
    dotted = build_metric_name("svc", "db", "a.b", "view", "metric")
    underscored = build_metric_name("svc", "db", "a_b", "view", "metric")

    assert dotted != underscored


def test_build_metric_name_is_unambiguous_across_part_boundaries():
    """METRIC_NAME_SEPARATOR is legal inside a quoted Snowflake identifier, so
    joining on it alone is ambiguous: ("sales-prod", "reporting") and
    ("sales", "prod-reporting") would otherwise produce the same name."""
    left = build_metric_name("svc", "db", "sales-prod", "reporting", "metric")
    right = build_metric_name("svc", "db", "sales", "prod-reporting", "metric")

    assert left != right


def test_build_metric_name_ignores_identifier_quoting():
    """The two call sites disagree on quoting: the metadata stage passes the
    topology context value, which may be quoted, while the lineage workflow passes
    the raw INFORMATION_SCHEMA value, which never is. If the derived name differed
    the lineage pass would miss the metric it just ingested and create an orphan."""
    from_metadata = build_metric_name("svc", "DB", '"My.Schema"', '"My.View"', "total_revenue")
    from_lineage = build_metric_name("svc", "DB", "My.Schema", "My.View", "total_revenue")

    assert from_metadata == from_lineage


def test_build_metric_name_respects_the_entity_name_limit():
    long_name = build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "m" * 80)

    assert len(long_name) == MAX_METRIC_NAME_LENGTH
    # deterministic: the lineage workflow re-derives the name through this function
    assert long_name == build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "m" * 80)
    # the digest keeps truncated names distinct
    assert long_name != build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "x" * 80)


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
    assert request.name.root == build_metric_name(
        "snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "total_revenue"
    )
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
    # __new__ skips __init__, which is where the per-thread catalog cache is created
    source._semantic_catalog_local = threading.local()
    source.metadata = MagicMock()
    view_entity = MagicMock()
    view_entity.id.root = "12345678-1234-1234-1234-123456789012"
    source.metadata.get_by_name.return_value = view_entity
    return source


VIEW = "sales_analysis"


def _rows_for(query):
    """Schema-wide catalog rows, keyed off the catalog view name in the SQL.

    The schema-wide query leads its projection with SEMANTIC_VIEW_NAME, so every
    row is prefixed with the owning view before the usual 6-column layout.
    """
    lowered = query.lower()
    if "semantic_dimensions" in lowered:
        rows = [DIM_REGION]
    elif "semantic_facts" in lowered:
        rows = [FACT_LINE_AMOUNT]
    else:
        rows = [TOTAL_REVENUE, ORDER_COUNT]

    return [(VIEW, *row) for row in rows]


def _metric_requests(records):
    """The stage interleaves a sink-flush Barrier with the CreateMetricRequests."""
    return [r.right for r in records if r.right is not None and not isinstance(r.right, Barrier)]


def test_yield_table_metrics_yields_one_per_metric():
    source = _make_source()
    source.connection.execute.side_effect = lambda clause: _rows_for(str(clause.text))

    results = list(source.yield_table_metrics(("sales_analysis", TableType.SemanticView)))
    requests = _metric_requests(results)
    assert len(requests) == 2
    names = {r.displayName for r in requests}
    assert names == {"total_revenue", "order_count"}
    revenue = next(r for r in requests if r.displayName == "total_revenue")
    assert str(revenue.assets.root[0].id.root) == "12345678-1234-1234-1234-123456789012"
    assert [d.name for d in revenue.dimensions] == ["region"]
    assert [m.name for m in revenue.measures] == ["line_amount"]


def test_yield_table_metrics_flushes_the_sink_before_resolving_the_view():
    """The semantic view's own Table is still sitting in the sink's bulk buffer
    (CreateTableRequest batches at bulk_sink_batch_size; CreateMetricRequest is
    written immediately), so resolving it by FQN first would 404 on every first
    run and drop the assets[] back-reference. Yield a Barrier to flush, and only
    then look the view up."""
    source = _make_source()
    source.connection.execute.side_effect = lambda clause: _rows_for(str(clause.text))

    records = source.yield_table_metrics((VIEW, TableType.SemanticView))

    first = next(records).right
    assert isinstance(first, Barrier)
    # the lookup must not have happened yet -- that is the whole point of the flush
    source.metadata.get_by_name.assert_not_called()

    remaining = [r.right for r in records]
    source.metadata.get_by_name.assert_called_once()
    assert [r.displayName for r in remaining] == ["total_revenue", "order_count"]


def test_yield_table_metrics_does_not_flush_when_the_view_has_no_metrics():
    """The stage runs for *every* table, so an unconditional Barrier would flush
    the bulk buffer once per table and destroy sink throughput for all connectors."""
    source = _make_source()
    source.connection.execute.side_effect = lambda clause: []

    records = list(source.yield_table_metrics((VIEW, TableType.SemanticView)))

    assert records == []
    source.metadata.get_by_name.assert_not_called()


def test_yield_table_metrics_skips_non_semantic_tables():
    source = _make_source()
    results = list(source.yield_table_metrics(("regular_table", TableType.Regular)))
    assert results == []
    source.connection.execute.assert_not_called()


def test_yield_table_metrics_warns_and_continues_on_error():
    source = _make_source()
    source.connection.execute.side_effect = Exception("boom")
    results = list(source.yield_table_metrics(("sales_analysis", TableType.SemanticView)))
    assert results == []


def test_metric_stage_consumes_the_producer_tuple_contract():
    """The ``table`` node's producer (``get_tables_name_and_type``) yields plain
    ``(table_name, table_type)`` tuples -- not ``TableNameAndType`` objects. The
    metric stage must unpack that shape, exactly like the sibling ``yield_table``
    stage does, or every table errors with "'tuple' object has no attribute 'type_'".
    """
    source_line = inspect.getsource(CommonDbSourceService.get_tables_name_and_type)
    assert "yield table_name, table_and_type.type_" in source_line

    source = _make_source()
    source.connection.execute.side_effect = lambda clause: _rows_for(str(clause.text))

    produced_entity = ("sales_analysis", TableType.SemanticView)
    results = list(source.yield_table_metrics(produced_entity))
    assert [r.displayName for r in _metric_requests(results)] == [
        "total_revenue",
        "order_count",
    ]


def test_snowflake_topology_does_not_leak_into_base_topology():
    """Import-time isolation guard: constructing the Snowflake module must not
    mutate the shared base DatabaseServiceTopology definition."""
    import metadata.ingestion.source.database.snowflake.metadata  # noqa: F401
    from metadata.ingestion.source.database.database_service import (
        DatabaseServiceTopology,
    )

    base_stage_types = [stage.type_ for stage in DatabaseServiceTopology().table.stages]
    assert CreateMetricRequest not in base_stage_types


def test_dimensions_carry_the_detail_stripped_from_columns():
    """The view's columns no longer describe synonyms, so the Metric's dimensions
    must carry them or they are lost entirely."""
    row = ("customers", "REGION", "VARCHAR", "customers.c_region", "Customer region", "geo, area")
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=[row], fact_rows=[], view_ref=None
    )

    dimension = request.dimensions[0]

    assert dimension.name == "REGION"
    assert dimension.description == "Customer region Synonyms: geo, area."
    assert dimension.expression == "customers.c_region"


def test_description_omits_the_logical_table():
    """The owning logical table is already named by the expression, so repeating it
    in the description is noise."""
    row = ("customers", "REGION", "VARCHAR", "customers.c_region", "Customer region", None)
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=[row], fact_rows=[], view_ref=None
    )

    assert request.dimensions[0].description == "Customer region"


def test_dimension_type_is_classified_from_the_data_type():
    rows = [
        ("orders", "ORDER_DATE", "DATE", "orders.o_orderdate", None, None),
        ("orders", "SHIPPED_AT", "TIMESTAMP_NTZ", "orders.o_shipdate", None, None),
        ("customers", "REGION", "VARCHAR", "customers.c_region", None, None),
        ("orders", "UNTYPED", None, "orders.x", None, None),
    ]
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=rows, fact_rows=[], view_ref=None
    )

    by_name = {d.name: d.type for d in request.dimensions}

    assert by_name == {
        "ORDER_DATE": Type.TIME,
        "SHIPPED_AT": Type.TIME,
        "REGION": Type.CATEGORICAL,
        "UNTYPED": None,
    }


def test_measure_aggregation_is_inferred_only_when_aggregated():
    rows = [
        ("orders", "REVENUE", "NUMBER", "SUM(orders.o_totalprice)", None, None),
        ("orders", "LINE_AMOUNT", "NUMBER", "orders.o_totalprice", None, None),
    ]
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=[], fact_rows=rows, view_ref=None
    )

    by_name = {m.name: m.aggregation for m in request.measures}

    assert by_name == {"REVENUE": "SUM", "LINE_AMOUNT": None}


def test_semantic_description_is_none_when_the_row_is_bare():
    row = ("", "PLAIN", "VARCHAR", "t.c", None, None)
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=[row], fact_rows=[], view_ref=None
    )

    assert request.dimensions[0].description is None
