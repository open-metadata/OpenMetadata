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
from uuid import UUID

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Language, MetricType, Type
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    SERVICE_PREFIX_MAX_LEN,
    build_metric_name,
    build_metric_request,
    infer_metric_type,
)

# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
TOTAL_REVENUE = ("orders", "total_revenue", "NUMBER", "SUM(orders.line_amount)", "Total revenue", None)
ORDER_COUNT = ("orders", "order_count", "NUMBER", "COUNT(orders.o_orderkey)", None, None)
DIM_REGION = ("customers", "region", "VARCHAR", "customers.c_region", "Customer region", "geo")
FACT_LINE_AMOUNT = ("orders", "line_amount", "NUMBER", "orders.o_totalprice", "Line amount", None)


def test_build_metric_name_uses_the_full_identity_digest():
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "orders", "total_revenue")

    assert name == ("snowflake_svc-eed93a1845927f3132d8602337a7cd8ad25ec9ceffb02c7faa7f2ff9c9e5476f")


def test_build_metric_name_is_a_single_fqn_segment():
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "orders", "total_revenue")

    assert "." not in name
    assert "::" not in name


def test_build_metric_name_never_exposes_reserved_identifier_characters():
    name = build_metric_name("svc", '"my.db"', "S", '"v.1"', "t", "a::b")

    assert name.startswith("svc-")
    assert "." not in name
    assert "::" not in name


def test_build_metric_name_sanitizes_the_service_prefix():
    """A service name is user-defined; a Metric's FQN is its raw name, so anything
    that would split the FQN has to be flattened out of the prefix."""
    name = build_metric_name('"prod.snowflake eu::1"', "DB", "S", "V", "t", "metric")

    assert name.startswith("prod-snowflake-eu--1-")
    assert "." not in name
    assert "::" not in name


def test_build_metric_name_stays_unique_when_service_prefixes_collide():
    """The prefix is lossy -- `a.b` and `a-b` flatten to the same string -- so the
    digest, which hashes the raw service name, is what keeps the names apart."""
    dotted = build_metric_name("prod.svc", "DB", "S", "V", "t", "metric")
    dashed = build_metric_name("prod-svc", "DB", "S", "V", "t", "metric")

    assert dotted.startswith("prod-svc-")
    assert dashed.startswith("prod-svc-")
    assert dotted != dashed


def test_build_metric_name_is_unique_per_path_element():
    base = ("svc", "DB", "SCH", "view", "tbl", "metric")
    variants = [build_metric_name(*(base[:index] + ("other",) + base[index + 1 :])) for index in range(len(base))]

    assert len(set(variants)) == len(base)
    assert build_metric_name(*base) not in variants


def test_build_metric_name_distinguishes_dotted_and_underscored_identifiers():
    dotted = build_metric_name("svc", "db", "a.b", "view", "t", "metric")
    underscored = build_metric_name("svc", "db", "a_b", "view", "t", "metric")

    assert dotted != underscored


def test_build_metric_name_is_unambiguous_across_part_boundaries():
    left = build_metric_name("svc", "db", "sales-prod", "reporting", "t", "metric")
    right = build_metric_name("svc", "db", "sales", "prod-reporting", "t", "metric")

    assert left != right


def test_build_metric_name_distinguishes_logical_tables():
    """Snowflake scopes a semantic object's name to its logical table, so one view
    can define `orders.total` and `returns.total`. A Metric's FQN *is* its name, so
    leaving the table out of the identity silently overwrites one with the other."""
    orders = build_metric_name("svc", "DB", "SALES", "SALES_ANALYSIS", "ORDERS", "TOTAL")
    returns = build_metric_name("svc", "DB", "SALES", "SALES_ANALYSIS", "RETURNS", "TOTAL")

    assert orders != returns


def test_metric_children_are_qualified_by_logical_table():
    """A Metric's dimensions/measures are FQN'd as `<metric>.dimension.<name>`, so two
    same-named semantic objects from different logical tables produced two children
    with an identical FQN. Snowflake permits that pair, so the logical table has to be
    part of the child's name -- these models carry no displayName to fall back on."""
    orders_status = ("ORDERS", "STATUS", "VARCHAR", "orders.o_orderstatus", None, None)
    returns_status = ("RETURNS", "STATUS", "VARCHAR", "returns.r_status", None, None)
    orders_amount = ("ORDERS", "AMOUNT", "NUMBER", "orders.o_totalprice", None, None)
    returns_amount = ("RETURNS", "AMOUNT", "NUMBER", "returns.r_refundamount", None, None)

    request = build_metric_request(
        "svc",
        "DB",
        "SALES",
        "COLLISION_CHECK",
        metric_row=("ORDERS", "TOTAL", "NUMBER", "SUM(orders.amount)", None, None),
        dimension_rows=[orders_status, returns_status],
        fact_rows=[orders_amount, returns_amount],
        view_ref=None,
    )

    assert [d.name for d in request.dimensions] == ["ORDERS.STATUS", "RETURNS.STATUS"]
    assert [m.name for m in request.measures] == ["ORDERS.AMOUNT", "RETURNS.AMOUNT"]


def test_metric_child_names_preserve_dots():
    """The server quotes dotted child names when appending them to the metric FQN."""
    row = ('"my.table"', '"my.dim"', "VARCHAR", "t.c", None, None)

    request = build_metric_request(
        "svc", "DB", "S", "V", metric_row=ORDER_COUNT, dimension_rows=[row], fact_rows=[], view_ref=None
    )

    assert request.dimensions[0].name == "my.table.my.dim"


def test_build_metric_name_ignores_identifier_quoting():
    """The two call sites disagree on quoting: the metadata stage passes the
    topology context value, which may be quoted, while the lineage workflow passes
    the raw INFORMATION_SCHEMA value, which never is. If the derived name differed
    the lineage pass would miss the metric it just ingested and create an orphan."""
    from_metadata = build_metric_name("svc", "DB", '"My.Schema"', '"My.View"', '"My.Table"', "total_revenue")
    from_lineage = build_metric_name("svc", "DB", "My.Schema", "My.View", "My.Table", "total_revenue")

    assert from_metadata == from_lineage


def test_build_metric_name_normalizes_escaped_identifier_quotes():
    from_metadata = build_metric_name("svc", "DB", '"My""Schema"', "view", "table", "metric")
    from_lineage = build_metric_name("svc", "DB", 'My"Schema', "view", "table", "metric")

    assert from_metadata == from_lineage


def test_build_metric_name_has_fixed_length_for_long_identifiers():
    """The service prefix is capped so the name cannot exceed the 256-character
    entityName limit, and the digest is what stays stable and distinguishing."""
    long_name = build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "t" * 80, "m" * 80)

    assert len(long_name) == SERVICE_PREFIX_MAX_LEN + 1 + 64
    assert long_name == build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "t" * 80, "m" * 80)
    assert long_name != build_metric_name("s" * 80, "d" * 80, "c" * 80, "v" * 80, "t" * 80, "x" * 80)
    assert long_name != build_metric_name("s" * 90, "d" * 80, "c" * 80, "v" * 80, "t" * 80, "m" * 80)


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
        "snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "orders", "total_revenue"
    )
    assert request.displayName == "total_revenue"
    assert request.description.root == "Total revenue"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.language == Language.SQL
    assert request.metricExpression.code == "SUM(orders.line_amount)"
    assert [d.name for d in request.dimensions] == ["customers.region"]
    assert request.dimensions[0].expression == "customers.c_region"
    assert [m.name for m in request.measures] == ["orders.line_amount"]
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
    assert [d.name for d in revenue.dimensions] == ["customers.region"]
    assert [m.name for m in revenue.measures] == ["orders.line_amount"]


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


def test_lineage_resolves_the_name_the_metadata_stage_emitted():
    """End-to-end name round-trip across the two independent call sites.

    The metadata stage writes the Metric under a name built from topology context
    values; the lineage workflow later re-derives that name from raw
    INFORMATION_SCHEMA rows to attach the `view -> Metric` edge. Nothing but
    ``build_metric_name`` keeps them in agreement, and the existing lineage test
    stubs the resolver to accept any name -- so only this test fails if they drift.
    """
    from metadata.ingestion.source.database.snowflake.semantic_view_lineage import (
        SnowflakeSemanticViewLineage,
    )

    # the metadata stage sees a *quoted* schema/view from the topology context
    source = _make_source()
    source.context.get.return_value = MagicMock(
        database_service="snowflake_svc", database="TEST_DB", database_schema='"SALES"'
    )
    source.connection.execute.side_effect = lambda clause: _rows_for(str(clause.text))
    emitted = _metric_requests(source.yield_table_metrics((f'"{VIEW}"', TableType.SemanticView)))
    ingested = {r.name.root for r in emitted}
    assert ingested, "metadata stage emitted no metrics"

    # the lineage workflow sees the same objects *unquoted*, straight from the catalog
    view_entity = MagicMock()
    view_entity.id = Uuid(root=UUID("11111111-1111-1111-1111-111111111111"))
    metric_entity = MagicMock()
    metric_entity.id = Uuid(root=UUID("22222222-2222-2222-2222-222222222222"))
    resolved = []

    def _resolve_metric(name):
        resolved.append(name)
        return metric_entity if name in ingested else None

    extractor = SnowflakeSemanticViewLineage(
        service_name="snowflake_svc",
        engine=MagicMock(),
        database_filter_pattern=None,
        resolve_table_by_fqn=lambda _f: view_entity,
        resolve_metric_by_name=_resolve_metric,
    )
    # the catalog rows carry the metric's owning logical table, which is part of its
    # identity: TOTAL_REVENUE and ORDER_COUNT are both declared on `orders`
    requests = list(
        extractor._build_view_metric_edges(
            "TEST_DB", "SALES", VIEW, view_entity, [("orders", "total_revenue"), ("orders", "order_count")]
        )
    )

    edges = [r.right for r in requests if r.right is not None]
    assert sorted(resolved) == sorted(ingested)
    assert len(edges) == len(ingested)


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

    assert dimension.name == "customers.REGION"
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
        "orders.ORDER_DATE": Type.TIME,
        "orders.SHIPPED_AT": Type.TIME,
        "customers.REGION": Type.CATEGORICAL,
        "orders.UNTYPED": None,
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

    assert by_name == {"orders.REVENUE": "SUM", "orders.LINE_AMOUNT": None}


def test_semantic_description_is_none_when_the_row_is_bare():
    row = ("", "PLAIN", "VARCHAR", "t.c", None, None)
    request = build_metric_request(
        "svc", "db", "sc", "v", metric_row=TOTAL_REVENUE, dimension_rows=[row], fact_rows=[], view_ref=None
    )

    assert request.dimensions[0].description is None
