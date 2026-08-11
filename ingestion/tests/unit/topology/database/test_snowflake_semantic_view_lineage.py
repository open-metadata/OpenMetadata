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
"""Snowflake semantic-view → base-table column-level lineage builder."""

from __future__ import annotations

from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.snowflake.semantic_view.catalog import (
    SemanticViewCatalog,
)
from metadata.ingestion.source.database.snowflake.semantic_view.lineage import (
    build_view_lineage,
    to_metric_lineage_request,
    to_view_lineage_request,
)


def _row(logical_table: str, name: str, expression: str) -> tuple:
    return (logical_table, name, "NUMBER", expression, "", None)


def test_direct_column_lineage_from_dimension_expression():
    catalog = SemanticViewCatalog(
        dimensions=[_row("customers", "region", "customers.c_region")],
        facts=[],
        metrics=[],
        base_tables={"customers": ("MY_CATALOG", "MY_SCHEMA", "CUSTOMERS")},
    )
    edges = build_view_lineage(
        catalog=catalog,
        base_table_fqns_by_logical={"customers": "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS"},
    )
    assert len(edges) == 1
    assert edges[0].base_table_fqn == "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS"
    assert len(edges[0].columns) == 1
    col = edges[0].columns[0]
    assert col.from_column == "c_region"
    assert col.to_column == "region"


def test_metric_that_wraps_a_fact_resolves_through_the_intra_view_chain():
    catalog = SemanticViewCatalog(
        dimensions=[],
        facts=[_row("orders", "line_amount", "orders.o_totalprice")],
        metrics=[_row("orders", "total_revenue", "SUM(orders.line_amount)")],
        base_tables={"orders": ("MY_CATALOG", "MY_SCHEMA", "ORDERS")},
    )
    edges = build_view_lineage(
        catalog=catalog,
        base_table_fqns_by_logical={"orders": "snow.MY_CATALOG.MY_SCHEMA.ORDERS"},
    )
    revenue_pairs = [c for e in edges for c in e.columns if c.to_column == "total_revenue"]
    assert any(c.from_column == "o_totalprice" for c in revenue_pairs)


def test_no_lineage_when_base_tables_map_empty():
    catalog = SemanticViewCatalog(
        dimensions=[_row("customers", "region", "customers.c_region")],
        facts=[],
        metrics=[],
        base_tables={},
    )
    edges = build_view_lineage(catalog=catalog, base_table_fqns_by_logical={})
    assert edges == []


def test_multiple_base_tables_produce_separate_edges():
    catalog = SemanticViewCatalog(
        dimensions=[
            _row("customers", "region", "customers.c_region"),
            _row("orders", "order_date", "orders.o_orderdate"),
        ],
        facts=[],
        metrics=[],
        base_tables={
            "customers": ("MY_CATALOG", "MY_SCHEMA", "CUSTOMERS"),
            "orders": ("MY_CATALOG", "MY_SCHEMA", "ORDERS"),
        },
    )
    edges = build_view_lineage(
        catalog=catalog,
        base_table_fqns_by_logical={
            "customers": "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS",
            "orders": "snow.MY_CATALOG.MY_SCHEMA.ORDERS",
        },
    )
    fqns = {e.base_table_fqn for e in edges}
    assert fqns == {"snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS", "snow.MY_CATALOG.MY_SCHEMA.ORDERS"}


def test_edges_store_bare_column_names_not_qualified_fqns():
    """Buffered edges stay cheap because the table prefixes are not repeated
    per column pair — the request builder joins them at emission."""
    catalog = SemanticViewCatalog(
        dimensions=[_row("customers", "region", "customers.c_region")],
        facts=[],
        metrics=[],
        base_tables={"customers": ("MY_CATALOG", "MY_SCHEMA", "CUSTOMERS")},
    )
    edges = build_view_lineage(
        catalog=catalog,
        base_table_fqns_by_logical={"customers": "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS"},
    )
    col = edges[0].columns[0]
    assert "." not in col.from_column
    assert "." not in col.to_column


def test_view_lineage_request_qualifies_columns_against_both_tables():
    catalog = SemanticViewCatalog(
        dimensions=[_row("customers", "region", "customers.c_region")],
        facts=[],
        metrics=[],
        base_tables={"customers": ("MY_CATALOG", "MY_SCHEMA", "CUSTOMERS")},
    )
    edge = build_view_lineage(
        catalog=catalog,
        base_table_fqns_by_logical={"customers": "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS"},
    )[0]
    request = to_view_lineage_request("snow.MY_CATALOG.MY_SCHEMA.MY_VIEW", edge)
    assert request.from_entity_fqn == "snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS"
    assert request.from_entity_type == "table"
    assert request.to_entity_fqn == "snow.MY_CATALOG.MY_SCHEMA.MY_VIEW"
    assert request.to_entity_type == "table"
    column_lineage = request.lineage_details.columnsLineage
    assert len(column_lineage) == 1
    assert [model_str(c) for c in column_lineage[0].fromColumns] == ["snow.MY_CATALOG.MY_SCHEMA.CUSTOMERS.c_region"]
    assert model_str(column_lineage[0].toColumn) == "snow.MY_CATALOG.MY_SCHEMA.MY_VIEW.region"


def test_metric_lineage_request_targets_the_flat_metric_namespace():
    request = to_metric_lineage_request(
        "snow.MY_CATALOG.MY_SCHEMA.MY_VIEW", "snow-MY_CATALOG-MY_SCHEMA-MY_VIEW-total_revenue"
    )
    assert request.from_entity_fqn == "snow.MY_CATALOG.MY_SCHEMA.MY_VIEW"
    assert request.from_entity_type == "table"
    assert request.to_entity_fqn == "snow-MY_CATALOG-MY_SCHEMA-MY_VIEW-total_revenue"
    assert request.to_entity_type == "metric"
    assert request.lineage_details.columnsLineage is None
