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
"""Unit tests for the primitives every semantic-layer connector maps through."""

import uuid

import pytest

from metadata.generated.schema.entity.data.metric import MetricType, Type
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.ingestion.source.database.semantic_metric_lineage import (
    column_lineage,
    table_reference,
    view_lineage_request,
)
from metadata.ingestion.source.database.semantic_metrics import (
    aggregation_name,
    describe,
    dimension_type,
    infer_metric_type,
)


def _table(name: str, columns: list[str]) -> Table:
    table_fqn = f"svc.db.sch.{name}"
    return Table(
        id=uuid.uuid5(uuid.NAMESPACE_DNS, table_fqn),
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(name=column, dataType=DataType.STRING, fullyQualifiedName=f"{table_fqn}.{column}")
            for column in columns
        ],
    )


ORDERS = _table("orders", ["o_totalprice", "o_orderdate"])
VIEW = _table("orders_metrics", ["Total Revenue", "Line Amount", "Order Date"])


# ---------------------------------------------------------------- metric type


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("SUM(x)", MetricType.SUM),
        ("count(x)", MetricType.COUNT),
        ("  COUNT_IF(x > 1) ", MetricType.COUNT),
        ("APPROX_COUNT_DISTINCT(x)", MetricType.COUNT),
        ("AVG(x)", MetricType.AVERAGE),
        ("MEDIAN(x)", MetricType.MEDIAN),
        ("STDDEV_SAMP(x)", MetricType.STANDARD_DEVIATION),
        ("VAR_POP(x)", MetricType.VARIANCE),
        # Composed and derived measures are what OTHER is for.
        ("MEASURE(a) / MEASURE(b)", MetricType.OTHER),
        ("x / y", MetricType.OTHER),
        (None, MetricType.OTHER),
        ("", MetricType.OTHER),
    ],
)
def test_infer_metric_type(expression, expected):
    assert infer_metric_type(expression) == expected


def test_aggregation_name_reports_only_modelled_aggregations():
    """A composed measure opens with a function too; reporting ``MEASURE`` as its
    aggregation would be worse than reporting none."""
    assert aggregation_name("SUM(o_totalprice)") == "SUM"
    assert aggregation_name("median(x)") == "MEDIAN"
    assert aggregation_name("MEASURE(a) / MEASURE(b)") is None
    assert aggregation_name(None) is None


# ------------------------------------------------------------- dimension type


@pytest.mark.parametrize(
    ("data_type", "expected"),
    [
        ("DATE", Type.TIME),
        ("timestamp", Type.TIME),
        # Both warehouses' spellings resolve through the same substring match.
        ("TIMESTAMP_NTZ", Type.TIME),
        ("timestamp_ltz", Type.TIME),
        ("VARCHAR", Type.CATEGORICAL),
        ("int", Type.CATEGORICAL),
        # No declared type means no type -- never a guess.
        (None, None),
        ("", None),
    ],
)
def test_dimension_type(data_type, expected):
    assert dimension_type(data_type) == expected


# -------------------------------------------------------------- descriptions


def test_describe_carries_synonyms_that_have_nowhere_else_to_land():
    assert describe("Total order value", "revenue, sales") == "Total order value Synonyms: revenue, sales."
    assert describe("Total order value", None) == "Total order value"
    assert describe(None, "revenue") == "Synonyms: revenue."
    assert describe(None, None) is None


# ------------------------------------------------------------------- lineage


def test_column_lineage_groups_by_destination_column():
    """A semantic layer routinely derives two view columns from one source column."""
    result = column_lineage(ORDERS, VIEW, [("o_totalprice", "Total Revenue"), ("o_totalprice", "Line Amount")])

    assert {entry.toColumn.root: [c.root for c in entry.fromColumns] for entry in result} == {
        f"{VIEW.fullyQualifiedName.root}.Total Revenue": [f"{ORDERS.fullyQualifiedName.root}.o_totalprice"],
        f"{VIEW.fullyQualifiedName.root}.Line Amount": [f"{ORDERS.fullyQualifiedName.root}.o_totalprice"],
    }


def test_column_lineage_merges_several_sources_into_one_destination():
    result = column_lineage(ORDERS, VIEW, [("o_totalprice", "Total Revenue"), ("o_orderdate", "Total Revenue")])

    assert len(result) == 1
    assert sorted(c.root for c in result[0].fromColumns) == [
        f"{ORDERS.fullyQualifiedName.root}.o_orderdate",
        f"{ORDERS.fullyQualifiedName.root}.o_totalprice",
    ]


def test_column_lineage_deduplicates_a_repeated_pair():
    result = column_lineage(ORDERS, VIEW, [("o_totalprice", "Total Revenue")] * 3)

    assert [c.root for c in result[0].fromColumns] == [f"{ORDERS.fullyQualifiedName.root}.o_totalprice"]


def test_column_lineage_drops_a_pair_that_does_not_resolve():
    """Connectors propose candidates parsed out of expressions; resolution against the
    ingested entity is what separates a column from a function name or a literal."""
    result = column_lineage(
        ORDERS, VIEW, [("MONTH", "Order Date"), ("o_orderdate", "Nonexistent"), ("o_orderdate", "Order Date")]
    )

    assert {entry.toColumn.root for entry in result} == {f"{VIEW.fullyQualifiedName.root}.Order Date"}
    assert [c.root for c in result[0].fromColumns] == [f"{ORDERS.fullyQualifiedName.root}.o_orderdate"]


def test_table_reference_points_at_the_entity():
    reference = table_reference(ORDERS)

    assert reference.id.root == ORDERS.id.root
    assert reference.type == "table"


def test_view_lineage_request_is_a_view_edge():
    """The edge is declared by the object's own definition, not observed in a query
    log, so it must not be attributed to query lineage."""
    request = view_lineage_request(ORDERS, VIEW, column_lineage(ORDERS, VIEW, [("o_orderdate", "Order Date")]))

    assert request.right.edge.fromEntity.id.root == ORDERS.id.root
    assert request.right.edge.toEntity.id.root == VIEW.id.root
    assert request.right.edge.lineageDetails.source.value == "ViewLineage"
    assert len(request.right.edge.lineageDetails.columnsLineage) == 1


def test_view_lineage_request_without_columns_is_table_level():
    """An empty list would serialize as "we checked and there are none"; the edge
    should simply carry no column lineage."""
    request = view_lineage_request(ORDERS, VIEW, [])

    assert request.right.edge.lineageDetails.columnsLineage is None
