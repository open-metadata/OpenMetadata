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

from metadata.generated.schema.type.basic import Uuid
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
    ("CUSTOMERS", "CUSTOMER_NAME"): {"logical_table": "CUSTOMERS", "expression": "customers.c_name"},
    ("ORDERS", "LINE_AMOUNT"): {"logical_table": "ORDERS", "expression": "orders.o_totalprice"},
    ("ORDERS", "TOTAL_REVENUE"): {"logical_table": "ORDERS", "expression": "SUM(orders.line_amount)"},
}


def test_extract_column_refs():
    assert extract_column_refs("customers.c_name") == [("customers", "c_name")]
    assert extract_column_refs("SUM(orders.o_totalprice) + t.x") == [
        ("orders", "o_totalprice"),
        ("t", "x"),
    ]
    assert extract_column_refs(None) == []
    assert extract_column_refs("count(*)") == []


def test_extract_column_refs_handles_quoted_and_qualified():
    # double-quoted identifiers (incl. spaces) are unquoted
    assert extract_column_refs('"orders"."o totalprice"') == [("orders", "o totalprice")]
    # database/schema-qualified references collapse to the last two segments
    assert extract_column_refs("db.public.orders.o_totalprice") == [("orders", "o_totalprice")]
    # mixed quoting
    assert extract_column_refs('SUM("orders".amount)') == [("orders", "amount")]


def test_match_semantic_name_is_case_insensitive():
    assert match_semantic_name("orders", "line_amount", COLUMNS) == ("ORDERS", "LINE_AMOUNT")
    assert match_semantic_name("orders", "NOT_THERE", COLUMNS) is None
    # right name, wrong logical table -- must not match
    assert match_semantic_name("customers", "line_amount", COLUMNS) is None


def test_lookup_base_table_is_case_insensitive():
    assert lookup_base_table("orders", TABLE_MAP) == ORDERS_TBL
    assert lookup_base_table("missing", TABLE_MAP) is None


def test_resolve_base_columns_direct_dimension():
    assert resolve_base_columns(("CUSTOMERS", "CUSTOMER_NAME"), COLUMNS, TABLE_MAP) == [(CUSTOMERS_TBL, "c_name")]


def test_resolve_base_columns_follows_metric_to_fact_to_physical():
    # TOTAL_REVENUE = SUM(orders.line_amount); line_amount is a fact -> o_totalprice
    assert resolve_base_columns(("ORDERS", "TOTAL_REVENUE"), COLUMNS, TABLE_MAP) == [(ORDERS_TBL, "o_totalprice")]


def test_resolve_base_columns_stops_on_cycles():
    cyclic = {
        ("T", "A"): {"logical_table": "T", "expression": "t.b"},
        ("T", "B"): {"logical_table": "T", "expression": "t.a"},
    }
    # A -> B -> A -> ... never reaches a physical column; must terminate, not hang
    assert resolve_base_columns(("T", "A"), cyclic, {"T": ("DB", "S", "T_TBL")}) == []


def test_resolve_base_columns_unknown_column():
    assert resolve_base_columns(("ORDERS", "NOPE"), COLUMNS, TABLE_MAP) == []


RETURNS_TBL = ("DB", "PUBLIC", "RETURNS_TBL")
DUP_TABLE_MAP = {"ORDERS": ORDERS_TBL, "RETURNS": RETURNS_TBL}
# Snowflake scopes a semantic object's name to its logical table, so one view may
# define both orders.status and returns.status (see CREATE SEMANTIC VIEW: every
# object is declared as `<table_alias>.<name> AS <expr>`).
DUP_COLUMNS = {
    ("ORDERS", "STATUS"): {"logical_table": "ORDERS", "expression": "orders.o_orderstatus"},
    ("RETURNS", "STATUS"): {"logical_table": "RETURNS", "expression": "returns.r_status"},
}


def test_duplicate_names_on_different_logical_tables_resolve_independently():
    """Keying columns by bare name collapsed these two onto one entry, so the
    survivor's expression resolved lineage for both and returns.status was
    silently attributed to the ORDERS base table."""
    assert resolve_base_columns(("ORDERS", "STATUS"), DUP_COLUMNS, DUP_TABLE_MAP) == [(ORDERS_TBL, "o_orderstatus")]
    assert resolve_base_columns(("RETURNS", "STATUS"), DUP_COLUMNS, DUP_TABLE_MAP) == [(RETURNS_TBL, "r_status")]


def test_intra_view_reference_matches_on_the_owning_logical_table():
    """A metric over a fact must follow the fact on *its own* table. Matching the
    bare name could otherwise jump to a same-named object on another table."""
    columns = {
        ("ORDERS", "AMOUNT"): {"logical_table": "ORDERS", "expression": "orders.o_totalprice"},
        ("RETURNS", "AMOUNT"): {"logical_table": "RETURNS", "expression": "returns.r_refundamount"},
        ("RETURNS", "TOTAL"): {"logical_table": "RETURNS", "expression": "SUM(returns.amount)"},
    }

    assert resolve_base_columns(("RETURNS", "TOTAL"), columns, DUP_TABLE_MAP) == [(RETURNS_TBL, "r_refundamount")]


def test_fetch_columns_keeps_the_logical_table():
    """The resolver cannot preserve TABLE_NAME if the fetch throws it away."""
    extractor = _extractor()
    # SEMANTIC_VIEW_SCHEMA, SEMANTIC_VIEW_NAME, TABLE_NAME, NAME, EXPRESSION
    rows = [
        ("SALES", "SALES_ANALYSIS", "ORDERS", "STATUS", "orders.o_orderstatus"),
        ("SALES", "SALES_ANALYSIS", "RETURNS", "STATUS", "returns.r_status"),
    ]
    with patch.object(SnowflakeSemanticViewLineage, "_run", return_value=rows):
        columns_by_view = extractor._fetch_columns("DB")

    columns = columns_by_view[("SALES", "SALES_ANALYSIS")]
    assert set(columns) == {("ORDERS", "STATUS"), ("RETURNS", "STATUS")}
    assert columns[("RETURNS", "STATUS")]["expression"] == "returns.r_status"


def test_fetch_view_metrics_keeps_the_logical_table():
    """The metric name is derived from (view, logical table, name); dropping the
    table here would make the lineage pass look up a name nothing was written under."""
    extractor = _extractor()
    rows = [
        ("SALES", "SALES_ANALYSIS", "ORDERS", "TOTAL", "SUM(orders.amount)"),
        ("SALES", "SALES_ANALYSIS", "RETURNS", "TOTAL", "SUM(returns.amount)"),
    ]
    with patch.object(SnowflakeSemanticViewLineage, "_run", return_value=rows):
        metrics_by_view = extractor._fetch_view_metrics("DB")

    assert metrics_by_view[("SALES", "SALES_ANALYSIS")] == [("ORDERS", "TOTAL"), ("RETURNS", "TOTAL")]


def _extractor():
    return SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=MagicMock(),
        database_filter_pattern=None,
        resolve_table_by_fqn=MagicMock(),
        resolve_metric_by_name=lambda _n: None,
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
    # ``id`` must be a real Uuid, matching Table.id: the production code passes the
    # whole field to EntityReference, not its unwrapped ``root``.
    view_entity = MagicMock()
    view_entity.id = Uuid(root=view_id)
    orders_entity = MagicMock()
    orders_entity.id = Uuid(root=orders_id)
    customers_entity = MagicMock()
    customers_entity.id = Uuid(root=customers_id)

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
    view_entity.id = Uuid(root=view_id)
    base_entity = MagicMock()
    base_entity.id = Uuid(root=base_id)

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


def test_semantic_view_lineage_is_gated_by_include_flag():
    from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource

    def enabled(process_view, include_semantic):
        self_mock = MagicMock()
        self_mock.source_config.processViewLineage = process_view
        self_mock.service_connection.includeSemanticViews = include_semantic
        return SnowflakeLineageSource._is_semantic_view_lineage_enabled(self_mock)

    assert enabled(True, True) is True
    assert enabled(True, False) is False
    assert enabled(False, True) is False
    assert enabled(False, False) is False


def test_semantic_column_catalog_views_exclude_metrics():
    from metadata.ingestion.source.database.snowflake.semantic_view_lineage import (
        SEMANTIC_COLUMN_CATALOG_VIEWS,
    )

    assert "semantic_metrics" not in SEMANTIC_COLUMN_CATALOG_VIEWS
    assert set(SEMANTIC_COLUMN_CATALOG_VIEWS) == {"semantic_dimensions", "semantic_facts"}


def test_view_to_metric_edge_emitted():
    from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
    from metadata.ingestion.source.database.snowflake.semantic_view_lineage import (
        SnowflakeSemanticViewLineage,
    )

    view_entity = MagicMock()
    view_entity.id = Uuid(root=UUID("11111111-1111-1111-1111-111111111111"))
    metric_entity = MagicMock()
    metric_entity.id = Uuid(root=UUID("22222222-2222-2222-2222-222222222222"))

    extractor = SnowflakeSemanticViewLineage(
        service_name="snowflake_svc",
        engine=MagicMock(),
        database_filter_pattern=None,
        resolve_table_by_fqn=lambda _f: view_entity,
        resolve_metric_by_name=lambda _n: metric_entity,
    )

    requests = list(
        extractor._build_view_metric_edges(
            "TEST_DB", "SALES", "sales_analysis", view_entity, [("ORDERS", "total_revenue")]
        )
    )
    edges = [r.right for r in requests if r.right is not None]
    assert len(edges) == 1
    assert isinstance(edges[0], AddLineageRequest)
    assert str(edges[0].edge.fromEntity.id.root) == str(view_entity.id.root)
    assert str(edges[0].edge.toEntity.id.root) == str(metric_entity.id.root)
    assert edges[0].edge.toEntity.type == "metric"


class _RecordingEngine:
    """Engine stub recording how many connections are opened and every query run."""

    def __init__(self, show_databases_rows=()):
        self.connect_calls = 0
        self.close_calls = 0
        self.queries = []
        self._show_databases_rows = list(show_databases_rows)

    def connect(self):
        self.connect_calls += 1

        return self

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.close()

        return False

    def execute(self, clause):
        query = str(clause)
        self.queries.append(query)

        return list(self._show_databases_rows) if "SHOW DATABASES" in query else []

    def close(self):
        self.close_calls += 1


def _recording_extractor(engine, configured_database=None):
    return SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=engine,
        database_filter_pattern=None,
        resolve_table_by_fqn=lambda _f: None,
        resolve_metric_by_name=lambda _n: None,
        configured_database=configured_database,
    )


def test_configured_database_skips_account_wide_show_databases():
    engine = _RecordingEngine(show_databases_rows=[("ts", "TEST_DB"), ("ts", "OTHER_DB")])
    extractor = _recording_extractor(engine, configured_database="TEST_DB")

    assert extractor._get_databases() == ["TEST_DB"]
    assert engine.queries == []


def test_no_configured_database_enumerates_the_account():
    engine = _RecordingEngine(show_databases_rows=[("ts", "DB1"), ("ts", "DB2")])
    extractor = _recording_extractor(engine)

    assert extractor._get_databases() == ["DB1", "DB2"]
    assert len(engine.queries) == 1


def test_catalog_queries_share_a_single_connection():
    engine = _RecordingEngine()
    extractor = _recording_extractor(engine, configured_database="TEST_DB")

    list(extractor.iter_lineage())

    # semantic_tables + semantic_dimensions + semantic_facts + semantic_metrics
    assert len(engine.queries) == 4
    assert engine.connect_calls == 1
    assert engine.close_calls == 1


def test_connection_is_not_reopened_per_database():
    engine = _RecordingEngine(show_databases_rows=[("ts", "DB1"), ("ts", "DB2")])
    extractor = _recording_extractor(engine)

    list(extractor.iter_lineage())

    # 1 SHOW DATABASES + 4 catalog queries per database, all on one connection
    assert len(engine.queries) == 1 + 2 * 4
    assert engine.connect_calls == 1
    assert engine.close_calls == 1
