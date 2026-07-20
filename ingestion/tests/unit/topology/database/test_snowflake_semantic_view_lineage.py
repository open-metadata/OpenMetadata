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

"""Unit tests for Snowflake semantic view lineage (issue #23680)."""

from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.ingestion.source.database.snowflake import semantic_view_lineage as svl
from metadata.ingestion.source.database.snowflake.semantic_view_lineage import (
    SnowflakeSemanticViewLineage,
    extract_column_refs,
    lookup_base_table,
    match_semantic_name,
    resolve_base_columns,
)

CUSTOMERS_TBL = ("DB", "PUBLIC", "CUSTOMERS_TBL")
ORDERS_TBL = ("DB", "PUBLIC", "ORDERS_TBL")

TABLE_MAP = {"CUSTOMERS": CUSTOMERS_TBL, "ORDERS": ORDERS_TBL}

COLUMNS = {
    "CUSTOMER_NAME": {"logical_table": "CUSTOMERS", "expression": "customers.c_name"},
    "LINE_AMOUNT": {"logical_table": "ORDERS", "expression": "orders.o_totalprice"},
    "TOTAL_REVENUE": {"logical_table": "ORDERS", "expression": "SUM(orders.line_amount)"},
}


def test_extract_column_refs():
    assert extract_column_refs("customers.c_name") == [("customers", "c_name")]
    assert extract_column_refs("SUM(orders.o_totalprice) + t.x") == [
        ("orders", "o_totalprice"),
        ("t", "x"),
    ]
    assert extract_column_refs(None) == []
    assert extract_column_refs("count(*)") == []


def test_match_semantic_name_is_case_insensitive():
    assert match_semantic_name("line_amount", COLUMNS) == "LINE_AMOUNT"
    assert match_semantic_name("NOT_THERE", COLUMNS) is None


def test_lookup_base_table_is_case_insensitive():
    assert lookup_base_table("orders", TABLE_MAP) == ORDERS_TBL
    assert lookup_base_table("missing", TABLE_MAP) is None


def test_resolve_base_columns_direct_dimension():
    assert resolve_base_columns("CUSTOMER_NAME", COLUMNS, TABLE_MAP) == [(CUSTOMERS_TBL, "c_name")]


def test_resolve_base_columns_follows_metric_to_fact_to_physical():
    # TOTAL_REVENUE = SUM(orders.line_amount); line_amount is a fact -> o_totalprice
    assert resolve_base_columns("TOTAL_REVENUE", COLUMNS, TABLE_MAP) == [(ORDERS_TBL, "o_totalprice")]


def test_resolve_base_columns_stops_on_cycles():
    cyclic = {
        "A": {"logical_table": "T", "expression": "t.b"},
        "B": {"logical_table": "T", "expression": "t.a"},
    }
    # A -> B -> A -> ... never reaches a physical column; must terminate, not hang
    assert resolve_base_columns("A", cyclic, {"T": ("DB", "S", "T_TBL")}) == []


def test_resolve_base_columns_unknown_column():
    assert resolve_base_columns("NOPE", COLUMNS, TABLE_MAP) == []


def _extractor():
    return SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=MagicMock(),
        database_filter_pattern=None,
        resolve_table_by_fqn=MagicMock(),
    )


def test_group_pairs_by_base_table():
    grouped = SnowflakeSemanticViewLineage._group_pairs_by_base_table(COLUMNS, TABLE_MAP)
    assert grouped[CUSTOMERS_TBL] == [("c_name", "CUSTOMER_NAME")]
    # LINE_AMOUNT -> o_totalprice, TOTAL_REVENUE -> o_totalprice (both on ORDERS)
    assert sorted(grouped[ORDERS_TBL]) == [("o_totalprice", "LINE_AMOUNT"), ("o_totalprice", "TOTAL_REVENUE")]


def test_build_column_lineage_groups_by_destination():
    base_entity = MagicMock()
    view_entity = MagicMock()

    def fake_get_column_fqn(entity, column):
        prefix = "base" if entity is base_entity else "view"
        return f"{prefix}.{column}"

    with patch.object(svl, "get_column_fqn", side_effect=fake_get_column_fqn):
        result = SnowflakeSemanticViewLineage._build_column_lineage(
            base_entity,
            view_entity,
            [("o_totalprice", "LINE_AMOUNT"), ("o_totalprice", "TOTAL_REVENUE")],
        )

    by_to = {cl.toColumn.root: [c.root for c in cl.fromColumns] for cl in result}
    assert by_to == {"view.LINE_AMOUNT": ["base.o_totalprice"], "view.TOTAL_REVENUE": ["base.o_totalprice"]}


def test_get_databases_applies_filter():
    extractor = _extractor()
    extractor._run = MagicMock(return_value=[("t", "DB1"), ("t", "DB2"), ("t", "IGNORED")])

    with patch.object(svl, "filter_by_database", side_effect=lambda pattern, db: db == "IGNORED"):
        databases = extractor._get_databases()

    assert databases == ["DB1", "DB2"]


def test_get_databases_swallows_errors():
    extractor = _extractor()
    extractor._run = MagicMock(side_effect=Exception("no access"))
    assert extractor._get_databases() == []


def test_iter_database_lineage_emits_table_and_column_edges():
    extractor = _extractor()

    view_id = UUID("11111111-1111-1111-1111-111111111111")
    orders_id = UUID("22222222-2222-2222-2222-222222222222")
    customers_id = UUID("33333333-3333-3333-3333-333333333333")
    view_entity = MagicMock()
    view_entity.id = view_id
    orders_entity = MagicMock()
    orders_entity.id = orders_id
    customers_entity = MagicMock()
    customers_entity.id = customers_id

    def resolve(table_fqn):
        if "SALES_ANALYSIS" in table_fqn:
            return view_entity
        if "ORDERS_TBL" in table_fqn:
            return orders_entity
        if "CUSTOMERS_TBL" in table_fqn:
            return customers_entity
        return None

    extractor.resolve_table_by_fqn = MagicMock(side_effect=resolve)
    extractor._fetch_table_maps = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): TABLE_MAP})
    extractor._fetch_columns = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): COLUMNS})

    with patch.object(svl, "get_column_fqn", side_effect=lambda entity, column: f"{id(entity)}.{column}"):
        requests = list(extractor._iter_database_lineage("DB"))

    # one edge per base table (ORDERS + CUSTOMERS) -> semantic view
    to_ids = {r.right.edge.toEntity.id.root for r in requests}
    from_ids = {r.right.edge.fromEntity.id.root for r in requests}
    assert to_ids == {view_id}
    assert from_ids == {orders_id, customers_id}
    assert len(requests) == 2
    # column lineage is attached (every base table here has resolvable columns)
    assert all(r.right.edge.lineageDetails.columnsLineage for r in requests)


def test_iter_database_lineage_emits_table_level_edge_without_columns():
    extractor = _extractor()

    view_id = UUID("44444444-4444-4444-4444-444444444444")
    base_id = UUID("55555555-5555-5555-5555-555555555555")
    view_entity = MagicMock()
    view_entity.id = view_id
    base_entity = MagicMock()
    base_entity.id = base_id

    def resolve(table_fqn):
        if "SALES_ANALYSIS" in table_fqn:
            return view_entity
        if "ORPHAN_TBL" in table_fqn:
            return base_entity
        return None

    extractor.resolve_table_by_fqn = MagicMock(side_effect=resolve)
    # base table present in the map but referenced by no column expression
    extractor._fetch_table_maps = MagicMock(
        return_value={("PUBLIC", "SALES_ANALYSIS"): {"ORPHAN": ("DB", "PUBLIC", "ORPHAN_TBL")}}
    )
    extractor._fetch_columns = MagicMock(return_value={})

    requests = list(extractor._iter_database_lineage("DB"))

    assert len(requests) == 1
    edge = requests[0].right.edge
    assert edge.fromEntity.id.root == base_id
    assert edge.toEntity.id.root == view_id
    # table-level edge only -> no column lineage
    assert edge.lineageDetails.columnsLineage is None


def test_build_view_lineage_skips_when_view_entity_missing():
    extractor = _extractor()
    extractor.resolve_table_by_fqn = MagicMock(return_value=None)
    result = list(extractor._build_view_lineage("DB", "PUBLIC", "SALES_ANALYSIS", TABLE_MAP, COLUMNS))
    assert result == []
