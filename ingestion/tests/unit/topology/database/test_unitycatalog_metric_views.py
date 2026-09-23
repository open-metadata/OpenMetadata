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
"""Unit tests for Unity Catalog metric-view ingestion."""

import json
import textwrap
import uuid
from types import SimpleNamespace

import pytest

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricType,
    Type,
    UnitOfMeasurement,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table, TableType
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.database.semantic_metrics import (
    SERVICE_PREFIX_MAX_LEN,
)
from metadata.ingestion.source.database.unitycatalog import metric_view_mixin
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource
from metadata.ingestion.source.database.unitycatalog.metric_view_mixin import (
    UnitycatalogMetricViewMixin,
)
from metadata.ingestion.source.database.unitycatalog.metric_views import (
    build_metric_name,
    build_metric_request,
    infer_metric_type,
    parse_metric_view,
)

SERVICE = "databricks_svc"
CATALOG = "samples"
SCHEMA = "tpch"
VIEW = "orders_metrics"

ORDERS_YAML = textwrap.dedent(
    """
    version: 1.1
    comment: Order performance metrics
    source: samples.tpch.orders
    filter: o_orderstatus = 'F'
    joins:
      - name: customer
        source: samples.tpch.customer
        'on': source.o_custkey = customer.c_custkey
    dimensions:
      - name: Order Date
        expr: o_orderdate
        comment: Date the order was placed
      - name: Customer Nation
        expr: customer.c_nationkey
        synonyms:
          - nation
    measures:
      - name: Total Revenue
        expr: SUM(o_totalprice)
        display_name: Total Revenue (USD)
        comment: Sum of order totals
        format:
          type: currency
          currency_code: USD
      - name: Order Count
        expr: COUNT(1)
    """
)

# The same YAML written against version 1.0, which spells dimensions ``fields``.
FIELDS_YAML = textwrap.dedent(
    """
    version: 1.0
    source: samples.tpch.orders
    fields:
      - name: Order Date
        expr: o_orderdate
    measures:
      - name: Order Count
        expr: COUNT(1)
    """
)


def _table(catalog: str, schema: str, name: str, columns: list[str]) -> Table:
    table_fqn = f"{SERVICE}.{catalog}.{schema}.{name}"
    return Table(
        id=uuid.uuid5(uuid.NAMESPACE_DNS, table_fqn),
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(
                name=column,
                dataType=DataType.STRING,
                fullyQualifiedName=f"{table_fqn}.{column}",
            )
            for column in columns
        ],
    )


ORDERS_TABLE = _table(CATALOG, SCHEMA, "orders", ["o_orderdate", "o_totalprice", "o_custkey", "o_orderstatus"])
CUSTOMER_TABLE = _table(CATALOG, SCHEMA, "customer", ["c_custkey", "c_nationkey"])
VIEW_TABLE = _table(CATALOG, SCHEMA, VIEW, ["Order Date", "Customer Nation", "Total Revenue", "Order Count"])


class FakeStatus:
    def __init__(self):
        self.warnings = []

    def warning(self, key, reason):
        self.warnings.append((key, reason))


class FakeMetadata:
    """Resolves only the tables it was seeded with, like a partially-ingested run."""

    def __init__(self, tables):
        self.tables = {table.fullyQualifiedName.root: table for table in tables}

    def get_by_name(self, entity, fqn, **_):
        return self.tables.get(fqn)


class FakeContext:
    def __init__(self):
        self.database_service = SERVICE
        self.database = CATALOG
        self.database_schema = SCHEMA

    def get(self):
        return self


class FakeSource(UnitycatalogMetricViewMixin):
    """A metric-view source with the two connector-supplied readers stubbed."""

    def __init__(
        self,
        view_text,
        column_types=None,
        tables=(ORDERS_TABLE, CUSTOMER_TABLE, VIEW_TABLE),
        include_metric_views=True,
    ):
        self.view_text = view_text
        self.column_types = column_types or {}
        self.metadata = FakeMetadata(tables)
        self.status = FakeStatus()
        self.context = FakeContext()
        self.service_connection = SimpleNamespace(includeMetricViews=include_metric_views)

    def get_metric_view_text(self, table_name):
        return self.view_text

    def get_metric_view_column_types(self, table_name):
        return self.column_types


def _run(source) -> list:
    return [either.right for either in source.yield_table_metrics((VIEW, TableType.View))]


def _metrics(records) -> list[CreateMetricRequest]:
    return [record for record in records if isinstance(record, CreateMetricRequest)]


# ------------------------------------------------------------------ discovery


def test_parse_metric_view_reads_the_yaml_body():
    definition = parse_metric_view(ORDERS_YAML)

    assert definition is not None
    assert definition.source == "samples.tpch.orders"
    assert definition.filter == "o_orderstatus = 'F'"
    assert [join.name for join in definition.joins] == ["customer"]
    assert [column.name for column in definition.all_dimensions] == ["Order Date", "Customer Nation"]
    assert [column.name for column in definition.measures] == ["Total Revenue", "Order Count"]


def test_parse_metric_view_accepts_the_1_0_fields_spelling():
    """``dimensions`` was renamed ``fields`` in YAML 1.1; a view written against
    either version has to ingest the same dimensions."""
    definition = parse_metric_view(FIELDS_YAML)

    assert definition is not None
    assert [column.name for column in definition.all_dimensions] == ["Order Date"]


@pytest.mark.parametrize(
    "view_text",
    [
        None,
        "",
        "   ",
        "SELECT o_orderdate, SUM(o_totalprice) FROM samples.tpch.orders GROUP BY 1",
        "CREATE VIEW v AS SELECT 1",
        # Valid YAML, but not a metric view: no measures.
        "version: 1.1\nsource: samples.tpch.orders\n",
        # Unparseable YAML must not raise out of the discriminator.
        "version: 1.1\n  bad: [indent",
    ],
)
def test_parse_metric_view_rejects_everything_that_is_not_one(view_text):
    """The YAML body is the discriminator, so anything a *SQL* view could store has
    to come back as ``None`` rather than a half-populated definition."""
    assert parse_metric_view(view_text) is None


# ---------------------------------------------------------------------- names


def test_build_metric_name_is_stable():
    first = build_metric_name(SERVICE, CATALOG, SCHEMA, VIEW, "Total Revenue")
    second = build_metric_name(SERVICE, CATALOG, SCHEMA, VIEW, "Total Revenue")

    assert first == second
    assert first.startswith(f"{SERVICE}-")


def test_build_metric_name_is_a_single_fqn_segment():
    name = build_metric_name('"prod.databricks eu::1"', "cat", "sch", "v.1", "Total Revenue")

    assert name.startswith("prod-databricks-eu--1-")
    assert "." not in name
    assert "::" not in name


def test_build_metric_name_is_unique_per_identity_element():
    base = (SERVICE, CATALOG, SCHEMA, VIEW, "Total Revenue")
    variants = [build_metric_name(*(base[:index] + ("other",) + base[index + 1 :])) for index in range(len(base))]

    assert len(set(variants)) == len(base)
    assert build_metric_name(*base) not in variants


def test_build_metric_name_separates_duplicate_display_names():
    """Two views may each declare a ``Total Revenue``; the Metric namespace is global,
    so the derived names must not collide."""
    orders = build_metric_name(SERVICE, CATALOG, SCHEMA, "orders_metrics", "Total Revenue")
    returns = build_metric_name(SERVICE, CATALOG, SCHEMA, "returns_metrics", "Total Revenue")

    assert orders != returns


def test_build_metric_name_has_fixed_length_for_long_identifiers():
    long_name = build_metric_name("s" * 80, "c" * 80, "d" * 80, "v" * 80, "m" * 80)

    assert len(long_name) == SERVICE_PREFIX_MAX_LEN + 1 + 64


# -------------------------------------------------------------------- mapping


def test_infer_metric_type_covers_the_spark_aggregations():
    assert infer_metric_type("SUM(x)") == MetricType.SUM
    assert infer_metric_type("count(x)") == MetricType.COUNT
    assert infer_metric_type("APPROX_COUNT_DISTINCT(x)") == MetricType.COUNT
    assert infer_metric_type("AVG(x)") == MetricType.AVERAGE
    assert infer_metric_type("MEDIAN(x)") == MetricType.MEDIAN
    assert infer_metric_type("STDDEV_SAMP(x)") == MetricType.STANDARD_DEVIATION
    assert infer_metric_type("MEASURE(a) / MEASURE(b)") == MetricType.OTHER
    assert infer_metric_type(None) == MetricType.OTHER


def test_build_metric_request_maps_every_field():
    definition = parse_metric_view(ORDERS_YAML)
    request = build_metric_request(
        SERVICE,
        CATALOG,
        SCHEMA,
        VIEW,
        definition,
        definition.measures[0],
        {"Order Date": "date", "Customer Nation": "int"},
        None,
    )

    assert request.name.root == build_metric_name(SERVICE, CATALOG, SCHEMA, VIEW, "Total Revenue")
    assert request.displayName == "Total Revenue (USD)"
    assert request.description.root == "Sum of order totals"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.language == Language.SQL
    assert request.metricExpression.code == "SUM(o_totalprice)"
    assert request.unitOfMeasurement == UnitOfMeasurement.DOLLARS
    assert [filter_.where for filter_ in request.filters] == ["o_orderstatus = 'F'"]
    assert [(d.name, d.type) for d in request.dimensions] == [
        ("Order Date", Type.TIME),
        ("Customer Nation", Type.CATEGORICAL),
    ]
    assert [(m.name, m.aggregation) for m in request.measures] == [
        ("Total Revenue", "SUM"),
        ("Order Count", "COUNT"),
    ]


def test_build_metric_request_falls_back_to_the_view_comment():
    definition = parse_metric_view(ORDERS_YAML)
    request = build_metric_request(SERVICE, CATALOG, SCHEMA, VIEW, definition, definition.measures[1], {}, None)

    assert request.displayName == "Order Count"
    assert request.description.root == "Order performance metrics"


def test_dimension_synonyms_reach_the_description():
    definition = parse_metric_view(ORDERS_YAML)
    request = build_metric_request(SERVICE, CATALOG, SCHEMA, VIEW, definition, definition.measures[0], {}, None)

    assert request.dimensions[1].description == "Synonyms: nation."


def test_a_non_usd_currency_keeps_its_iso_code():
    """DOLLARS would silently relabel the amount; OTHER plus the code does not."""
    definition = parse_metric_view(
        "source: t\nmeasures:\n  - name: Revenue\n    expr: SUM(x)\n    format:\n"
        "      type: currency\n      currency_code: EUR\n"
    )
    request = build_metric_request(SERVICE, CATALOG, SCHEMA, VIEW, definition, definition.measures[0], {}, None)

    assert request.unitOfMeasurement == UnitOfMeasurement.OTHER
    assert request.customUnitOfMeasurement == "EUR"


def test_a_percentage_measure_is_labelled_as_one():
    definition = parse_metric_view(
        "source: t\nmeasures:\n  - name: Fill Rate\n    expr: AVG(x)\n    format:\n      type: percentage\n"
    )
    request = build_metric_request(SERVICE, CATALOG, SCHEMA, VIEW, definition, definition.measures[0], {}, None)

    assert request.unitOfMeasurement == UnitOfMeasurement.PERCENTAGE


def test_a_nameless_measure_is_skipped_not_fatal():
    definition = parse_metric_view("source: t\nmeasures:\n  - expr: SUM(x)\n")

    assert build_metric_request(SERVICE, CATALOG, SCHEMA, VIEW, definition, definition.measures[0], {}, None) is None


# ------------------------------------------------------------------ the stage


def test_a_plain_view_yields_nothing():
    """The stage runs for every table, so a SQL view must cost nothing and emit
    nothing -- not even the sink flush."""
    source = FakeSource("SELECT o_orderdate FROM samples.tpch.orders")

    assert _run(source) == []


def test_the_stage_emits_a_barrier_before_looking_the_view_up():
    """The metric view's own CreateTableRequest is still in the sink's bulk buffer;
    without the flush the assets[] back-reference is lost on every first run."""
    records = _run(FakeSource(ORDERS_YAML))

    assert isinstance(records[0], Barrier)


def test_the_stage_emits_one_metric_per_measure_linked_to_its_view():
    metrics = _metrics(_run(FakeSource(ORDERS_YAML)))

    assert [metric.displayName for metric in metrics] == ["Total Revenue (USD)", "Order Count"]
    for metric in metrics:
        assert [asset.id.root for asset in metric.assets.root] == [VIEW_TABLE.id.root]


def test_the_opt_out_yields_nothing_not_even_the_barrier():
    """``includeMetricViews`` off has to cost nothing: the Barrier flushes the sink's
    bulk buffer, so emitting one for a run that wants no metrics would negate the
    bulk sink for every metric view in the catalog."""
    assert _run(FakeSource(ORDERS_YAML, include_metric_views=False)) == []


def test_the_stage_is_idempotent():
    """A second unchanged run has to produce byte-identical requests, or every run
    rewrites every metric."""
    first = _metrics(_run(FakeSource(ORDERS_YAML)))
    second = _metrics(_run(FakeSource(ORDERS_YAML)))

    assert [metric.model_dump_json() for metric in first] == [metric.model_dump_json() for metric in second]


def test_an_unresolvable_metric_view_table_warns_and_still_emits_the_metrics():
    source = FakeSource(ORDERS_YAML, tables=())

    records = _run(source)

    assert len(_metrics(records)) == 2
    assert all(metric.assets is None for metric in _metrics(records))
    assert any("Table entity could not be resolved" in reason for _, reason in source.status.warnings)


def test_an_unreadable_view_definition_warns_instead_of_failing_the_table():
    class ExplodingSource(FakeSource):
        def get_metric_view_text(self, table_name):
            raise RuntimeError("permission denied on DESCRIBE")

    source = ExplodingSource(ORDERS_YAML)

    assert _run(source) == []
    assert any("permission denied" in reason for _, reason in source.status.warnings)


def test_one_unmappable_measure_does_not_cost_the_others(monkeypatch):
    """Per-metric isolation: a measure the mapper chokes on warns and the rest of the
    view still ingests."""
    original = metric_view_mixin.build_metric_request

    def explode_on_first(*args, **kwargs):
        measure = args[5]
        if measure.name == "Total Revenue":
            raise ValueError("unsupported measure shape")
        return original(*args, **kwargs)

    monkeypatch.setattr(metric_view_mixin, "build_metric_request", explode_on_first)
    source = FakeSource(ORDERS_YAML)

    records = _run(source)

    assert [metric.displayName for metric in _metrics(records)] == ["Order Count"]
    assert any("could not be mapped" in reason for _, reason in source.status.warnings)


def test_metric_view_yaml_we_cannot_model_warns_instead_of_vanishing():
    """The text says metric view, so silently emitting nothing would hide a real gap."""
    source = FakeSource("source: t\nmeasures:\n  - name: Revenue\n    synonyms: {not: a list}\n")

    assert _run(source) == []
    assert any("unrecognized metric view YAML" in reason for _, reason in source.status.warnings)


def test_column_types_classify_dimensions_and_a_missing_type_is_left_unset():
    typed = _metrics(_run(FakeSource(ORDERS_YAML, column_types={"Order Date": "timestamp"})))[0]
    untyped = _metrics(_run(FakeSource(ORDERS_YAML)))[0]

    assert typed.dimensions[0].type == Type.TIME
    assert untyped.dimensions[0].type is None


def test_renaming_a_measure_produces_a_new_metric():
    """The name is a digest of the measure's identity, so a rename creates a new
    Metric and leaves the old one behind. Metrics carry no delete tracking in the
    topology, matching the Snowflake semantic-view stage; the stale entity is removed
    by the usual soft-delete tooling, not by this run.
    """
    before = _metrics(_run(FakeSource(ORDERS_YAML)))
    after = _metrics(_run(FakeSource(ORDERS_YAML.replace("Total Revenue", "Gross Revenue"))))

    assert {metric.name.root for metric in before} & {metric.name.root for metric in after} == {
        build_metric_name(SERVICE, CATALOG, SCHEMA, VIEW, "Order Count")
    }


def test_a_metric_view_with_no_source_still_emits_its_metrics():
    """``source`` is required by Databricks, but a view we cannot read it from must
    still contribute its metrics rather than nothing."""
    source = FakeSource("measures:\n  - name: Rows\n    expr: COUNT(1)\n")

    assert [metric.displayName for metric in _metrics(_run(source))] == ["Rows"]


# ------------------------------------------------- reading the body from the source

# What the SDK's ``TableInfo.view_definition`` hands back: the same view, stripped of
# every ``comment``, ``synonyms`` and ``format`` entry it was written with.
REDUCED_YAML = textwrap.dedent(
    """
    version: 1.1
    source: samples.tpch.orders
    dimensions:
      - name: Order Date
        expr: o_orderdate
    measures:
      - name: Total Revenue
        expr: SUM(o_totalprice)
    """
)

FULL_YAML = textwrap.dedent(
    """
    version: 1.1
    comment: Order performance metrics
    source: samples.tpch.orders
    dimensions:
      - name: Order Date
        expr: o_orderdate
        comment: Date the order was placed
    measures:
      - name: Total Revenue
        expr: SUM(o_totalprice)
        comment: Gross revenue
        format:
          type: currency
          currency_code: USD
    """
)


class FakeSqlConnection:
    """The SQL warehouse boundary: records what was asked and answers with a payload."""

    def __init__(self, result):
        self.result = result
        self.queries = []

    def execute(self, statement):
        self.queries.append(str(statement))
        if isinstance(self.result, Exception):
            raise self.result
        return SimpleNamespace(fetchone=lambda: (self.result,))


class StubbedUnityCatalogSource(UnitycatalogSource):
    """The real reader methods, with only the Unity Catalog boundary stubbed."""

    def __init__(self, view_definition, describe_result=None):  # pylint: disable=super-init-not-called
        self.context = FakeContext()
        self.context.table_data = SimpleNamespace(name=VIEW, view_definition=view_definition, columns=[])
        self._stub_connection = FakeSqlConnection(describe_result)

    @property
    def sql_connection(self):
        return self._stub_connection


def _describe_queries(source) -> list[str]:
    return [query for query in source._stub_connection.queries if query.startswith("DESCRIBE")]


def test_a_metric_view_body_is_read_in_full_not_from_the_reduced_copy():
    """The reduced copy the SDK returns has no comments and no formats, so metrics
    built from it lose every description and unit. Only ``DESCRIBE ... AS JSON``
    returns the body as written."""
    source = StubbedUnityCatalogSource(REDUCED_YAML, json.dumps({"view_text": FULL_YAML}))

    definition = parse_metric_view(source.get_metric_view_text(VIEW))

    assert definition.measures[0].comment == "Gross revenue"
    assert definition.measures[0].format.currency_code == "USD"
    assert _describe_queries(source) == [f"DESCRIBE TABLE EXTENDED `{CATALOG}`.`{SCHEMA}`.`{VIEW}` AS JSON"]


def test_a_view_that_is_not_a_metric_view_is_never_described():
    """The round-trip is the whole cost of this path, and every ordinary table and SQL
    view in the run would otherwise pay it."""
    source = StubbedUnityCatalogSource("SELECT o_orderdate FROM samples.tpch.orders")

    assert source.get_metric_view_text(VIEW) == "SELECT o_orderdate FROM samples.tpch.orders"
    assert _describe_queries(source) == []


def test_a_table_with_no_definition_at_all_is_never_described():
    source = StubbedUnityCatalogSource(None)

    assert source.get_metric_view_text(VIEW) is None
    assert _describe_queries(source) == []


def test_a_failed_describe_falls_back_to_the_reduced_copy():
    """A metric with no description still beats no metric: losing the warehouse must
    cost the trimmings, not the metric view."""
    source = StubbedUnityCatalogSource(REDUCED_YAML, RuntimeError("warehouse is stopped"))

    definition = parse_metric_view(source.get_metric_view_text(VIEW))

    assert [measure.name for measure in definition.measures] == ["Total Revenue"]
    assert definition.measures[0].comment is None


def test_a_backtick_in_a_name_is_escaped_rather_than_closing_the_quoting():
    """A raw backtick would end the quoted identifier and leave a malformed DESCRIBE,
    costing the full body of every metric view under such a name."""
    source = StubbedUnityCatalogSource(REDUCED_YAML, json.dumps({"view_text": FULL_YAML}))
    source.context.database = "odd`catalog"

    source.get_metric_view_text(VIEW)

    assert _describe_queries(source) == [f"DESCRIBE TABLE EXTENDED `odd``catalog`.`{SCHEMA}`.`{VIEW}` AS JSON"]


def test_an_empty_describe_result_falls_back_to_the_reduced_copy():
    source = StubbedUnityCatalogSource(REDUCED_YAML, json.dumps({"view_text": None}))

    assert parse_metric_view(source.get_metric_view_text(VIEW)) is not None
