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
"""Unit tests for Databricks metric-view lineage (the lineage workflow's pass)."""

import json
import textwrap
import uuid
from types import SimpleNamespace

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)
from metadata.ingestion.source.database.unitycatalog.metric_view_lineage import (
    UnitycatalogMetricViewLineage,
)
from metadata.ingestion.source.database.unitycatalog.metric_views import (
    build_metric_name,
    extract_column_refs,
    is_table_reference,
    resolve_alias,
)

SERVICE = "databricks_svc"
CATALOG = "samples"
SCHEMA = "tpch"
VIEW = "orders_metrics"

ORDERS_YAML = textwrap.dedent(
    """
    version: 1.1
    source: samples.tpch.orders
    joins:
      - name: customer
        source: samples.tpch.customer
        'on': source.o_custkey = customer.c_custkey
    dimensions:
      - name: Order Date
        expr: o_orderdate
      - name: Customer Nation
        expr: customer.c_nationkey
    measures:
      - name: Total Revenue
        expr: SUM(o_totalprice)
      - name: Order Count
        expr: COUNT(1)
    """
)

SQL_VIEW_DEFINITION = "SELECT o_orderdate, o_totalprice FROM samples.tpch.orders"


def _table(catalog: str, schema: str, name: str, columns: list[str]) -> Table:
    table_fqn = f"{SERVICE}.{catalog}.{schema}.{name}"
    return Table(
        id=uuid.uuid5(uuid.NAMESPACE_DNS, table_fqn),
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(name=column, dataType=DataType.STRING, fullyQualifiedName=f"{table_fqn}.{column}")
            for column in columns
        ],
    )


ORDERS_TABLE = _table(CATALOG, SCHEMA, "orders", ["o_orderdate", "o_totalprice", "o_custkey", "o_orderstatus"])
CUSTOMER_TABLE = _table(CATALOG, SCHEMA, "customer", ["c_custkey", "c_nationkey"])
VIEW_TABLE = _table(CATALOG, SCHEMA, VIEW, ["Order Date", "Customer Nation", "Total Revenue", "Order Count"])
ALL_TABLES = (ORDERS_TABLE, CUSTOMER_TABLE, VIEW_TABLE)


def _metric(measure: str):
    """The Metric the metadata workflow writes for one measure of the view."""
    name = build_metric_name(SERVICE, CATALOG, SCHEMA, VIEW, measure)
    return SimpleNamespace(id=uuid.uuid5(uuid.NAMESPACE_DNS, name), name=name, displayName=measure)


# Every measure ORDERS_YAML declares, as the metadata pass would have left them.
ALL_METRICS = {metric.name: metric for metric in (_metric("Total Revenue"), _metric("Order Count"))}


class FakeStatus:
    def __init__(self):
        self.warnings = []
        self.filtered = []

    def warning(self, key, reason):
        self.warnings.append((key, reason))

    def filter(self, key, reason):
        self.filtered.append((key, reason))


class FakeSourceConfig:
    def __init__(self, schema_filter=None, table_filter=None):
        self.schemaFilterPattern = schema_filter
        self.tableFilterPattern = table_filter
        self.databaseFilterPattern = None
        self.processViewLineage = True


def _extractor(rows, tables=ALL_TABLES, source_config=None, status=None, metric_views=(), describe=None, metrics=None):
    """An extractor over canned Unity Catalog catalog metadata.

    ``rows`` is the ``information_schema.views`` result, ``metric_views`` the
    ``information_schema.tables`` rows carrying ``TABLE_TYPE = 'METRIC_VIEW'``, and
    ``describe`` the YAML each one yields from ``DESCRIBE ... AS JSON``. They are kept
    apart because Databricks keeps them apart: a metric view can be listed by the
    second pair and be entirely absent from the first. ``metrics`` is what the metadata
    workflow already wrote, keyed by the hashed Metric name.
    """
    by_fqn = {table.fullyQualifiedName.root: table for table in tables}
    describe = describe or {}
    queries = []

    def run_query(query):
        queries.append(query)
        if "TABLE_TYPE = 'METRIC_VIEW'" in query:
            return list(metric_views)
        if query.startswith("DESCRIBE TABLE EXTENDED"):
            schema, view = query.split("`")[3], query.split("`")[5]
            return [(json.dumps({"view_text": describe[(schema, view)]}),)]
        return rows

    extractor = UnitycatalogMetricViewLineage(
        service_name=SERVICE,
        source_config=source_config or FakeSourceConfig(),
        status=status or FakeStatus(),
        run_query=run_query,
        resolve_table_by_fqn=by_fqn.get,
        resolve_metric_by_name=(ALL_METRICS if metrics is None else metrics).get,
        list_databases=_databases(CATALOG),
    )
    extractor.queries = queries
    return extractor


def _databases(*names: str):
    """The ``Database`` listing the source hands the extractor."""
    return lambda: [SimpleNamespace(name=name, fullyQualifiedName=f"{SERVICE}.{name}") for name in names]


def _edges(extractor):
    return [either.right for either in extractor.iter_lineage()]


def _source_edges(extractor):
    """Only the ``source relation -> metric view`` edges."""
    return [request for request in _edges(extractor) if request.edge.toEntity.type == "table"]


def _metric_edges(extractor):
    """Only the ``metric view -> Metric`` edges."""
    return [request for request in _edges(extractor) if request.edge.toEntity.type == "metric"]


# ----------------------------------------------------------- reference parsing


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("SUM(o_totalprice)", [(None, "o_totalprice")]),
        ("customer.c_nationkey", [("customer", "c_nationkey")]),
        ("source.o_custkey", [("source", "o_custkey")]),
        ("customer.nation.n_name", [("customer.nation", "n_name")]),
        ("`Total Revenue`", [(None, "Total Revenue")]),
        # A string literal must never become a column candidate: a date dimension
        # really can have a column called MONTH.
        ("DATE_TRUNC('MONTH', o_orderdate)", [(None, "o_orderdate")]),
        ("SUM(o_totalprice) FILTER (WHERE o_orderstatus = 'F')", [(None, "o_totalprice"), (None, "o_orderstatus")]),
        # A struct column referenced both bare and field-qualified: the shorter chain
        # must not blank its own prefix inside the longer one and leave ``city``
        # behind as an unqualified candidate, which would resolve against the primary
        # source and invent a column-lineage pair.
        (
            "CONCAT(source.address, source.address.city)",
            [("source", "address"), ("source.address", "city")],
        ),
    ],
)
def test_extract_column_refs(expression, expected):
    assert extract_column_refs(expression) == expected


def test_resolve_alias_prefers_the_longest_matching_join():
    """Nested joins are referenced by a dotted path, so matching only the first
    segment would attribute ``customer.nation.n_name`` to ``customer``."""
    assert resolve_alias("customer.nation", ["customer", "customer.nation"]) == "customer.nation"
    assert resolve_alias("customer", ["customer", "customer.nation"]) == "customer"
    assert resolve_alias("source", ["customer"]) is None
    assert resolve_alias(None, ["customer"]) is None
    # An unknown qualifier is most likely a struct field on the primary source.
    assert resolve_alias("address", ["customer"]) is None


def test_is_table_reference_separates_a_relation_from_a_query():
    assert is_table_reference("samples.tpch.orders")
    assert is_table_reference("`my catalog`.tpch.orders")
    assert not is_table_reference("SELECT * FROM samples.tpch.orders")


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("samples.tpch.orders", [("samples", "tpch", "orders")]),
        ("tpch.orders", [(CATALOG, "tpch", "orders")]),
        ("orders", [(CATALOG, SCHEMA, "orders")]),
        ("SELECT * FROM orders", [(CATALOG, SCHEMA, "orders")]),
        (None, []),
        ("", []),
    ],
)
def test_source_table_refs_inherit_the_metric_view_scope(source, expected):
    assert UnitycatalogMetricViewLineage.source_table_refs(source, CATALOG, SCHEMA) == expected


def test_source_table_refs_parses_a_query_source():
    references = UnitycatalogMetricViewLineage.source_table_refs(
        "SELECT * FROM samples.tpch.orders o JOIN samples.tpch.lineitem l ON o.k = l.k", CATALOG, SCHEMA
    )

    assert set(references) == {("samples", "tpch", "orders"), ("samples", "tpch", "lineitem")}


# ------------------------------------------------------------------ discovery


def test_discovery_costs_two_catalog_wide_queries_when_the_views_scan_suffices():
    """A ``DESCRIBE`` per view would not scale. On a runtime that publishes a metric
    view's YAML as its ``view_definition`` the catalog-wide scans find everything, and
    no per-view round-trip is paid at all."""
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)])

    _edges(extractor)

    assert len(extractor.queries) == 2
    assert "INFORMATION_SCHEMA.VIEWS" in extractor.queries[0]
    assert "TABLE_TYPE = 'METRIC_VIEW'" in extractor.queries[1]
    assert all(f"`{CATALOG}`" in query for query in extractor.queries)
    assert not [query for query in extractor.queries if query.startswith("DESCRIBE")]


def test_a_metric_view_missing_from_information_schema_views_is_still_found():
    """The shape current Databricks SQL actually returns: ``information_schema.views``
    does not list a metric view at all, so the views scan alone finds nothing and the
    whole pass silently yields no lineage. ``information_schema.tables`` does list it,
    and ``DESCRIBE ... AS JSON`` carries its YAML."""
    extractor = _extractor(
        [(SCHEMA, "orders_view", SQL_VIEW_DEFINITION)],
        metric_views=[(SCHEMA, VIEW)],
        describe={(SCHEMA, VIEW): ORDERS_YAML},
    )

    edges = _source_edges(extractor)

    assert {edge.edge.fromEntity.id.root for edge in edges} == {ORDERS_TABLE.id.root, CUSTOMER_TABLE.id.root}
    assert [query for query in extractor.queries if query.startswith("DESCRIBE")] == [
        f"DESCRIBE TABLE EXTENDED `{CATALOG}`.`{SCHEMA}`.`{VIEW}` AS JSON"
    ]


def test_a_metric_view_the_views_scan_already_returned_is_not_described_twice():
    """The two passes overlap on a runtime that answers both, and the ``DESCRIBE`` is
    the expensive half -- a view the first pass resolved must not pay for it again."""
    extractor = _extractor(
        [(SCHEMA, VIEW, ORDERS_YAML)],
        metric_views=[(SCHEMA, VIEW)],
        describe={(SCHEMA, VIEW): ORDERS_YAML},
    )

    edges = _source_edges(extractor)

    assert {edge.edge.fromEntity.id.root for edge in edges} == {ORDERS_TABLE.id.root, CUSTOMER_TABLE.id.root}
    assert not [query for query in extractor.queries if query.startswith("DESCRIBE")]


def test_a_filtered_out_metric_view_is_never_described():
    """Filtering happens before the round-trip: every candidate here is already known
    to be a metric view, so one the run excludes costs nothing to skip."""
    extractor = _extractor(
        [],
        source_config=FakeSourceConfig(schema_filter=SimpleNamespace(includes=["^other$"], excludes=None)),
        metric_views=[(SCHEMA, VIEW)],
        describe={(SCHEMA, VIEW): ORDERS_YAML},
    )

    assert _edges(extractor) == []
    assert not [query for query in extractor.queries if query.startswith("DESCRIBE")]


def test_a_plain_sql_view_produces_no_lineage():
    """The pass sees every view in the catalog, so a SQL view must fall straight
    through -- the shared view-lineage path already owns those."""
    assert _edges(_extractor([(SCHEMA, "orders_view", SQL_VIEW_DEFINITION)])) == []


def test_a_catalog_whose_views_cannot_be_listed_does_not_stop_the_run():
    def exploding_query(_):
        raise RuntimeError("no permission on information_schema")

    extractor = UnitycatalogMetricViewLineage(
        service_name=SERVICE,
        source_config=FakeSourceConfig(),
        status=FakeStatus(),
        run_query=exploding_query,
        resolve_table_by_fqn=lambda _: None,
        resolve_metric_by_name=ALL_METRICS.get,
        list_databases=_databases(CATALOG, "other"),
    )

    assert list(extractor.iter_lineage()) == []


# ---------------------------------------------------------------------- edges


def test_table_and_column_lineage_from_every_source_relation():
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)])

    edges = _source_edges(extractor)
    by_source = {request.edge.fromEntity.id.root: request for request in edges}

    assert set(by_source) == {ORDERS_TABLE.id.root, CUSTOMER_TABLE.id.root}
    for request in edges:
        assert request.edge.toEntity.id.root == VIEW_TABLE.id.root

    assert _columns(by_source[ORDERS_TABLE.id.root]) == {
        f"{VIEW_TABLE.fullyQualifiedName.root}.Order Date": [f"{ORDERS_TABLE.fullyQualifiedName.root}.o_orderdate"],
        f"{VIEW_TABLE.fullyQualifiedName.root}.Total Revenue": [f"{ORDERS_TABLE.fullyQualifiedName.root}.o_totalprice"],
    }
    assert _columns(by_source[CUSTOMER_TABLE.id.root]) == {
        f"{VIEW_TABLE.fullyQualifiedName.root}.Customer Nation": [
            f"{CUSTOMER_TABLE.fullyQualifiedName.root}.c_nationkey"
        ]
    }


def _columns(request):
    return {
        entry.toColumn.root: sorted(column.root for column in entry.fromColumns)
        for entry in request.edge.lineageDetails.columnsLineage
    }


def test_a_source_with_no_resolvable_columns_still_gets_table_lineage():
    yaml_text = "source: samples.tpch.orders\nmeasures:\n  - name: Rows\n    expr: COUNT(1)\n"
    extractor = _extractor([(SCHEMA, VIEW, yaml_text)])

    edges = _edges(extractor)

    assert [request.edge.fromEntity.id.root for request in edges] == [ORDERS_TABLE.id.root]
    assert edges[0].edge.lineageDetails.columnsLineage is None


def test_an_unresolvable_source_warns_and_keeps_the_other_edges():
    status = FakeStatus()
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)], tables=(VIEW_TABLE, CUSTOMER_TABLE), status=status)

    edges = _source_edges(extractor)

    assert [request.edge.fromEntity.id.root for request in edges] == [CUSTOMER_TABLE.id.root]
    assert any("samples.tpch.orders" in reason for _, reason in status.warnings)


def test_a_metric_view_missing_from_openmetadata_warns_and_emits_nothing():
    status = FakeStatus()
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)], tables=(ORDERS_TABLE, CUSTOMER_TABLE), status=status)

    assert _edges(extractor) == []
    assert any("not in OpenMetadata" in reason for _, reason in status.warnings)


def test_unreadable_metric_view_yaml_warns_without_stopping_the_others():
    status = FakeStatus()
    extractor = _extractor(
        [
            (SCHEMA, "broken", "measures:\n  - name: Revenue\n    synonyms: {not: a list}\n"),
            (SCHEMA, VIEW, ORDERS_YAML),
        ],
        status=status,
    )

    edges = _source_edges(extractor)

    assert {request.edge.fromEntity.id.root for request in edges} == {
        ORDERS_TABLE.id.root,
        CUSTOMER_TABLE.id.root,
    }
    assert any("unrecognized metric view YAML" in reason for _, reason in status.warnings)


def test_the_run_filters_apply_to_the_metric_view():
    status = FakeStatus()
    extractor = _extractor(
        [(SCHEMA, VIEW, ORDERS_YAML)],
        source_config=FakeSourceConfig(table_filter=_deny(VIEW)),
        status=status,
    )

    assert _edges(extractor) == []
    assert status.filtered == [(f"{CATALOG}.{SCHEMA}.{VIEW}", "Table Filtered Out")]


def _deny(name: str):
    from metadata.generated.schema.type.filterPattern import FilterPattern

    return FilterPattern(excludes=[f"^{name}$"])


def test_a_source_table_is_resolved_once_per_catalog():
    """Two metric views over the same relation must not cost two API lookups."""
    lookups = []

    def resolve(table_fqn):
        lookups.append(table_fqn)
        return {table.fullyQualifiedName.root: table for table in ALL_TABLES}.get(table_fqn)

    extractor = UnitycatalogMetricViewLineage(
        service_name=SERVICE,
        source_config=FakeSourceConfig(),
        status=FakeStatus(),
        run_query=lambda _: [(SCHEMA, VIEW, ORDERS_YAML), (SCHEMA, VIEW, ORDERS_YAML)],
        resolve_table_by_fqn=resolve,
        resolve_metric_by_name=ALL_METRICS.get,
        list_databases=_databases(CATALOG),
    )
    list(extractor.iter_lineage())

    assert len(lookups) == len(set(lookups)) == 3


# ----------------------------------------------------------------- the wiring


def _composed(process_view_lineage=True, databases=(CATALOG,), rows=((SCHEMA, VIEW, ORDERS_YAML),)):
    """The collaborator wired the way ``UnitycatalogLineageSource`` wires it."""
    source_config = FakeSourceConfig()
    source_config.processViewLineage = process_view_lineage
    by_fqn = {table.fullyQualifiedName.root: table for table in ALL_TABLES}
    return UnitycatalogMetricViewLineage(
        service_name=SERVICE,
        source_config=source_config,
        status=FakeStatus(),
        run_query=lambda _: list(rows),
        resolve_table_by_fqn=by_fqn.get,
        resolve_metric_by_name=ALL_METRICS.get,
        list_databases=_databases(*databases),
    )


def test_the_pass_is_gated_on_process_view_lineage():
    """A metric view is a view, so the flag that turns off view lineage has to turn
    this off too -- otherwise the pass runs a query per catalog for nothing."""
    assert list(_composed(process_view_lineage=False).iter_lineage()) == []


def test_the_pass_emits_edges_for_the_services_catalogs():
    edges = _source_edges(_composed())

    assert {request.edge.fromEntity.id.root for request in edges} == {
        ORDERS_TABLE.id.root,
        CUSTOMER_TABLE.id.root,
    }


def test_a_filtered_out_catalog_is_never_queried():
    extractor = _composed()
    extractor.source_config.databaseFilterPattern = _deny(CATALOG)

    assert list(extractor.iter_lineage()) == []
    assert extractor.status.filtered == [(f"{SERVICE}.{CATALOG}", "Catalog Filtered Out")]


def test_the_source_composes_the_collaborator_rather_than_inheriting_it():
    """The seam this refactor bought: the source owns the pass as a collaborator, so
    nothing about metric views appears in its own method namespace."""
    assert not hasattr(UnitycatalogLineageSource, "yield_metric_view_lineage")
    assert UnitycatalogMetricViewLineage not in UnitycatalogLineageSource.__mro__


def test_a_failing_catalog_listing_costs_only_the_metric_views():
    """This pass runs after the source's own lineage has already yielded edges, so a
    failure listing catalogs must not take the run down with it."""
    status = FakeStatus()
    extractor = UnitycatalogMetricViewLineage(
        service_name=SERVICE,
        source_config=FakeSourceConfig(),
        status=status,
        run_query=lambda _: [],
        resolve_table_by_fqn=lambda _: None,
        resolve_metric_by_name=ALL_METRICS.get,
        list_databases=_explode,
    )

    assert list(extractor.iter_lineage()) == []


def _explode():
    raise RuntimeError("OpenMetadata is unreachable")


# ------------------------------------------------------- metric view -> Metric


def test_every_measure_gets_an_edge_from_its_metric_view():
    """Without these the graph stops at the view and "what feeds Total Revenue" has no
    answer, even though every edge behind the view is already there."""
    edges = _metric_edges(_extractor([(SCHEMA, VIEW, ORDERS_YAML)]))

    assert [request.edge.fromEntity.id.root for request in edges] == [VIEW_TABLE.id.root] * 2
    assert {request.edge.toEntity.id.root for request in edges} == {metric.id for metric in ALL_METRICS.values()}
    assert {request.edge.toEntity.type for request in edges} == {"metric"}


def test_a_measure_whose_metric_is_absent_is_skipped_quietly():
    """The metadata workflow may not have run yet. That is not a lineage fault, and it
    must not cost the measures whose metrics do exist."""
    status = FakeStatus()
    only_revenue = {name: m for name, m in ALL_METRICS.items() if m.displayName == "Total Revenue"}
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)], status=status, metrics=only_revenue)

    edges = _metric_edges(extractor)

    assert [request.edge.toEntity.id.root for request in edges] == [next(iter(only_revenue.values())).id]
    assert status.warnings == []


def test_metric_edges_do_not_displace_the_source_edges():
    """Both kinds come out of the same pass; adding one must not cost the other."""
    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)])

    all_edges = _edges(extractor)

    assert len(all_edges) == len(_source_edges(_extractor([(SCHEMA, VIEW, ORDERS_YAML)]))) + len(
        _metric_edges(_extractor([(SCHEMA, VIEW, ORDERS_YAML)]))
    )


def test_a_metric_is_resolved_once_even_when_two_views_share_a_measure_name():
    """The resolver is a network call; the cache is what keeps it off the hot path."""
    looked_up = []

    def resolve(name):
        looked_up.append(name)
        return ALL_METRICS.get(name)

    extractor = _extractor([(SCHEMA, VIEW, ORDERS_YAML)])
    extractor.resolve_metric_by_name = resolve
    _edges(extractor)
    _edges(extractor)

    assert len(looked_up) == len(set(looked_up)) == 2
