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
from uuid import NAMESPACE_DNS, UUID, uuid5

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.source.database import semantic_metric_lineage as sml
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


def test_extract_column_refs_returns_unqualified_names_without_a_table():
    assert extract_column_refs("CUSTOMER_ID") == [(None, "CUSTOMER_ID")]
    assert extract_column_refs("SUM(amount)") == [(None, "amount")]
    assert extract_column_refs("orders.a + b") == [("orders", "a"), (None, "b")]
    # keywords, function names and string literals are not column references
    assert extract_column_refs("CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END") == [(None, "status")]
    assert extract_column_refs("DATE_TRUNC('MONTH', event_at)") == [(None, "event_at")]
    # a quoted identifier is a column even when it spells a keyword
    assert extract_column_refs('"end"') == [(None, "end")]
    assert extract_column_refs('"a""b"') == [(None, 'a"b')]
    # a function name is skipped only where it is called
    assert extract_column_refs("DATE(date)") == [(None, "date")]
    # cast targets, path steps and exponents are not columns
    assert extract_column_refs("amount::NUMBER(10, 2) * 1e5") == [(None, "amount")]
    assert extract_column_refs("payload:region::string") == [(None, "payload")]
    assert extract_column_refs("src:customer.name[0]::string") == [(None, "src")]
    assert extract_column_refs("TRY_CAST(created_at AS DATE) + CAST(x AS NUMBER(10, 2))") == [
        (None, "created_at"),
        (None, "x"),
    ]
    # punctuation inside a quoted identifier is part of the name
    assert extract_column_refs('orders."amount (USD)" + orders."a:b"') == [
        ("orders", "amount (USD)"),
        ("orders", "a:b"),
    ]
    assert extract_column_refs('"it\'s" || \'a "b"\'') == [(None, "it's")]
    # backslash-escaped and dollar-quoted strings are literals too
    assert extract_column_refs(r"IFF(customers.last_name = 'O\'Reilly', customers.first_name, 'x')") == [
        ("customers", "last_name"),
        ("customers", "first_name"),
    ]
    assert extract_column_refs("REGEXP_LIKE(STATUS, $$^(OPEN|CLOSED)$$)") == [(None, "STATUS")]
    # a schema-qualified function name is not a column
    assert extract_column_refs("analytics.normalize(amount)") == [(None, "amount")]
    # a date part is not a column, but a column called year still is
    assert extract_column_refs(
        "EXTRACT(year FROM event_at) + DATE_PART(year, event_at) + DATEADD(day, 1, d) + year"
    ) == [
        (None, "event_at"),
        (None, "event_at"),
        (None, "d"),
        (None, "year"),
    ]
    # $$ inside a name, multi-word type names and comments
    assert extract_column_refs("o.A$$B + o.C$$D") == [("o", "A$$B"), ("o", "C$$D")]
    assert extract_column_refs("CAST(o.AMOUNT AS DOUBLE PRECISION) + x::TIMESTAMP WITH LOCAL TIME ZONE") == [
        ("o", "AMOUNT"),
        (None, "x"),
    ]
    assert extract_column_refs("o.AMOUNT /* COMMENTCOL */ + 1 -- COMMENTCOL\n + '--keep' || o.B") == [
        ("o", "AMOUNT"),
        ("o", "B"),
    ]
    assert extract_column_refs("o.AMOUNT // COMMENTCOL\n + o.B || 'http://x'") == [("o", "AMOUNT"), ("o", "B")]
    # a typed literal's type is not a column, but a column with that name still is
    assert extract_column_refs(
        "CASE WHEN o.SHIP_DATE >= DATE '2026-01-01' AND TIMESTAMP_NTZ '2026-01-01 00:00' < ts THEN o.DATE END"
    ) == [("o", "SHIP_DATE"), ("o", "DATE"), (None, "ts")]


# Snowflake's normal form: each object's expression is relative to its own logical table.
BARE_COLUMNS = {
    ("CUSTOMERS", "CUSTOMER_NAME"): {"logical_table": "CUSTOMERS", "expression": "C_NAME"},
    ("ORDERS", "LINE_AMOUNT"): {"logical_table": "ORDERS", "expression": "O_TOTALPRICE"},
    ("ORDERS", "O_ORDERSTATUS"): {"logical_table": "ORDERS", "expression": "O_ORDERSTATUS"},
    ("ORDERS", "TOTAL_REVENUE"): {"logical_table": "ORDERS", "expression": "SUM(LINE_AMOUNT)"},
}


def test_resolve_base_columns_resolves_unqualified_names_on_the_owning_logical_table():
    assert resolve_base_columns(("CUSTOMERS", "CUSTOMER_NAME"), BARE_COLUMNS, TABLE_MAP) == [(CUSTOMERS_TBL, "C_NAME")]
    # an object named after the column it reads resolves to that column, not to itself
    assert resolve_base_columns(("ORDERS", "O_ORDERSTATUS"), BARE_COLUMNS, TABLE_MAP) == [(ORDERS_TBL, "O_ORDERSTATUS")]
    # a metric over a fact follows the fact to its physical column
    assert resolve_base_columns(("ORDERS", "TOTAL_REVENUE"), BARE_COLUMNS, TABLE_MAP) == [(ORDERS_TBL, "O_TOTALPRICE")]


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

    with patch.object(sml, "get_column_fqn", side_effect=lambda entity, column: f"{id(entity)}.{column}"):
        requests = list(extractor._iter_database_lineage("DB"))

    # one edge per base table (ORDERS + CUSTOMERS) -> semantic view
    to_ids = {r.right.edge.toEntity.id.root for r in requests}
    from_ids = {r.right.edge.fromEntity.id.root for r in requests}
    assert to_ids == {view_id}
    assert from_ids == {orders_id, customers_id}
    assert len(requests) == 2
    # column lineage is attached (every base table here has resolvable columns)
    assert all(r.right.edge.lineageDetails.columnsLineage for r in requests)


def test_iter_database_lineage_attaches_column_lineage_for_unqualified_expressions():
    extractor = _extractor()
    view_entity, orders_entity, customers_entity = MagicMock(), MagicMock(), MagicMock()
    view_entity.id = Uuid(root=UUID("11111111-1111-1111-1111-111111111111"))
    orders_entity.id = Uuid(root=UUID("22222222-2222-2222-2222-222222222222"))
    customers_entity.id = Uuid(root=UUID("33333333-3333-3333-3333-333333333333"))
    entities = {"SALES_ANALYSIS": view_entity, "ORDERS_TBL": orders_entity, "CUSTOMERS_TBL": customers_entity}

    extractor.resolve_table_by_fqn = MagicMock(
        side_effect=lambda table_fqn: next((e for name, e in entities.items() if name in table_fqn), None)
    )
    extractor._fetch_table_maps = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): TABLE_MAP})
    extractor._fetch_columns = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): BARE_COLUMNS})

    with patch.object(sml, "get_column_fqn", side_effect=lambda entity, column: f"{id(entity)}.{column}"):
        requests = list(extractor._iter_database_lineage("DB"))

    lineage = {
        r.right.edge.fromEntity.id.root: {
            (c.toColumn.root.split(".")[-1], tuple(f.root.split(".")[-1] for f in c.fromColumns))
            for c in r.right.edge.lineageDetails.columnsLineage
        }
        for r in requests
    }
    assert lineage[orders_entity.id.root] == {
        ("LINE_AMOUNT", ("O_TOTALPRICE",)),
        ("O_ORDERSTATUS", ("O_ORDERSTATUS",)),
        ("TOTAL_REVENUE", ("O_TOTALPRICE",)),
    }
    assert lineage[customers_entity.id.root] == {("CUSTOMER_NAME", ("C_NAME",))}


def _table(name: str, columns: list[str]) -> Table:
    table_fqn = f"snow.DB.PUBLIC.{name}"
    return Table(
        id=uuid5(NAMESPACE_DNS, table_fqn),
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(name=column, dataType=DataType.STRING, fullyQualifiedName=f"{table_fqn}.{column}")
            for column in columns
        ],
    )


@pytest.mark.parametrize(
    "expression, source_columns",
    [
        ("{'customer': o.AMOUNT}", ["AMOUNT"]),
        ("{'customer': AMOUNT}", ["AMOUNT"]),
        ("{'customer': o.AMOUNT + o.TAX}", ["AMOUNT", "TAX"]),
        ("{'customer': AMOUNT + TAX}", ["AMOUNT", "TAX"]),
        ("{'customer': SUM(o.AMOUNT)}", ["AMOUNT"]),
        ("{'customer': {'name': o.AMOUNT}}", ["AMOUNT"]),
        ("{'customer': o.PAYLOAD:customer.name[0]::string, 'name': o.AMOUNT}", ["PAYLOAD", "AMOUNT"]),
        ("({'customer': o.AMOUNT}):customer::number", ["AMOUNT"]),
        ("OBJECT_CONSTRUCT('customer', o.AMOUNT)", ["AMOUNT"]),
        ("o.PAYLOAD:customer.name[0]::string", ["PAYLOAD"]),
        ('"PAYLOAD" :customer.name[0]::string', ["PAYLOAD"]),
        ("(o.PAYLOAD) :customer.name[0]::string", ["PAYLOAD"]),
        ("o.PAYLOAD[0] :customer.name::string", ["PAYLOAD"]),
        ("o.PAYLOAD:customer:name::string", ["PAYLOAD"]),
        ("{'customer': o.\"amount:USD\"::number}", ["amount:USD"]),
        ("{'customer': 'o.TAX', 'name': o.AMOUNT /* customer */}", ["AMOUNT"]),
    ],
)
def test_build_view_lineage_preserves_object_values_and_excludes_path_members(expression, source_columns):
    """Collision columns make object keys and path members observable false dependencies."""
    base = _table("ORDERS_TBL", ["AMOUNT", "TAX", "PAYLOAD", "customer", "name", "amount:USD"])
    for column in base.columns:
        column.dataType = {"AMOUNT": DataType.INT, "TAX": DataType.INT, "PAYLOAD": DataType.VARIANT}.get(
            column.name.root, DataType.STRING
        )
    view = _table("SALES_ANALYSIS", ["OBJECT_VALUE"])
    view.columns[0].dataType = DataType.VARIANT
    entities = {table.fullyQualifiedName.root: table for table in (base, view)}
    extractor = SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=None,
        database_filter_pattern=None,
        resolve_table_by_fqn=entities.get,
        resolve_metric_by_name=lambda _name: None,
    )
    columns = {("O", "OBJECT_VALUE"): {"logical_table": "O", "expression": expression}}

    (request,) = extractor._build_view_lineage("DB", "PUBLIC", "SALES_ANALYSIS", {"O": ORDERS_TBL}, columns)

    edge = request.right.edge
    assert edge.fromEntity.id == base.id
    assert edge.toEntity.id == view.id
    assert [
        (entry.toColumn.root, [source.root for source in entry.fromColumns])
        for entry in edge.lineageDetails.columnsLineage or []
    ] == [
        (
            "snow.DB.PUBLIC.SALES_ANALYSIS.OBJECT_VALUE",
            [f"snow.DB.PUBLIC.ORDERS_TBL.{column}" for column in source_columns],
        )
    ]


@pytest.mark.parametrize(
    "expression, source_columns",
    [
        ("o.DATE_KEY + INTERVAL '1' MONTH", ["DATE_KEY"]),
        ("o.DATE_KEY + INTERVAL '3' DAYS", ["DATE_KEY"]),
        ("o.DATE_KEY + INTERVAL '1-1' YEAR TO MONTH", ["DATE_KEY"]),
        ("CAST(o.DURATION AS INTERVAL DAY TO SECOND)", ["DURATION"]),
        ("o.DURATION::INTERVAL YEAR TO MONTH", ["DURATION"]),
        ("o.DATE_KEY + INTERVAL '1-08' YEAR(3) TO MONTH", ["DATE_KEY"]),
        ("o.DATE_KEY + INTERVAL '1 02:03' DAY(2) TO MINUTE", ["DATE_KEY"]),
        ("o.DATE_KEY + INTERVAL '1 02:03:04.123' DAY(2) TO SECOND(3)", ["DATE_KEY"]),
        ("CAST(o.DURATION AS INTERVAL YEAR(2) TO MONTH)", ["DURATION"]),
        ("o.DURATION::INTERVAL DAY(2) TO HOUR", ["DURATION"]),
        ("DATE_KEY + INTERVAL '1' MONTH + MONTH", ["DATE_KEY", "MONTH"]),
        ("DATE_KEY + INTERVAL '1' MONTH + YEAR", ["DATE_KEY", "YEAR"]),
    ]
    + [
        (f"o.DATE_KEY + {reference}", ["DATE_KEY", unit])
        for unit in ("YEAR", "MONTH", "DAY", "DAYS", "HOUR", "MINUTE", "SECOND", "TO")
        for reference in (unit, f'"{unit}"', f"o.{unit}")
    ]
    + [
        (f"{reference} {negation}{operator} 'OPEN.*'", ["STATUS"])
        for operator in ("RLIKE", "REGEXP", "ILIKE")
        for negation in ("", "NOT ")
        for reference in ("o.STATUS", "STATUS")
    ]
    + [
        (reference, [operator])
        for operator in ("RLIKE", "REGEXP", "ILIKE")
        for reference in (f'"{operator}"', f"o.{operator}", f'o."{operator}"')
    ],
)
def test_build_view_lineage_excludes_interval_qualifiers_and_infix_operators(expression, source_columns):
    """Real collision columns expose syntax tokens that would otherwise resolve as sources."""
    base = _table(
        "ORDERS_TBL",
        [
            "DATE_KEY",
            "DURATION",
            "STATUS",
            "YEAR",
            "MONTH",
            "DAY",
            "DAYS",
            "HOUR",
            "MINUTE",
            "SECOND",
            "TO",
            "RLIKE",
            "REGEXP",
            "ILIKE",
        ],
    )
    base.columns[0].dataType = DataType.DATE
    view = _table("SALES_ANALYSIS", ["NEXT_VALUE"])
    entities = {table.fullyQualifiedName.root: table for table in (base, view)}
    extractor = SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=None,
        database_filter_pattern=None,
        resolve_table_by_fqn=entities.get,
        resolve_metric_by_name=lambda _name: None,
    )
    columns = {("O", "NEXT_VALUE"): {"logical_table": "O", "expression": expression}}

    (request,) = extractor._build_view_lineage("DB", "PUBLIC", "SALES_ANALYSIS", {"O": ORDERS_TBL}, columns)

    edge = request.right.edge
    assert edge.fromEntity.id == base.id
    assert edge.fromEntity.type == "table"
    assert edge.toEntity.id == view.id
    assert edge.toEntity.type == "table"
    assert [
        (entry.toColumn.root, [source.root for source in entry.fromColumns])
        for entry in edge.lineageDetails.columnsLineage or []
    ] == [
        (
            "snow.DB.PUBLIC.SALES_ANALYSIS.NEXT_VALUE",
            [f"snow.DB.PUBLIC.ORDERS_TBL.{column}" for column in source_columns],
        )
    ]


@pytest.mark.parametrize(
    "function_name",
    ["CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "CURRENT_USER", "LOCALTIME", "LOCALTIMESTAMP"],
)
@pytest.mark.parametrize(
    "reference, is_column",
    [
        ("{name}", False),
        ("{lower_name}", False),
        ("{name}()", False),
        ('"{name}"', True),
        ("o.{name}", True),
        ('o."{name}"', True),
    ],
)
def test_build_view_lineage_excludes_bare_context_functions(function_name, reference, is_column):
    """A context function must not resolve to a real same-named physical column."""
    base = _table("ORDERS_TBL", ["STATUS", function_name])
    view = _table("SALES_ANALYSIS", ["NEXT_VALUE"])
    entities = {table.fullyQualifiedName.root: table for table in (base, view)}
    extractor = SnowflakeSemanticViewLineage(
        service_name="snow",
        engine=None,
        database_filter_pattern=None,
        resolve_table_by_fqn=entities.get,
        resolve_metric_by_name=lambda _name: None,
    )
    reference = reference.format(name=function_name, lower_name=function_name.lower())
    columns = {("O", "NEXT_VALUE"): {"logical_table": "O", "expression": f"o.STATUS || TO_VARCHAR({reference})"}}

    (request,) = extractor._build_view_lineage("DB", "PUBLIC", "SALES_ANALYSIS", {"O": ORDERS_TBL}, columns)

    edge = request.right.edge
    assert edge.fromEntity.id == base.id
    assert edge.fromEntity.type == "table"
    assert edge.toEntity.id == view.id
    assert edge.toEntity.type == "table"
    source_columns = ["STATUS", function_name] if is_column else ["STATUS"]
    assert [
        (entry.toColumn.root, [source.root for source in entry.fromColumns])
        for entry in edge.lineageDetails.columnsLineage or []
    ] == [
        (
            "snow.DB.PUBLIC.SALES_ANALYSIS.NEXT_VALUE",
            [f"snow.DB.PUBLIC.ORDERS_TBL.{column}" for column in source_columns],
        )
    ]


@pytest.mark.parametrize("type_name", ["DATE", "TIME", "TIMESTAMP"])
@pytest.mark.parametrize("reference", ["{type_name}", "o.{type_name}", '"{type_name}"', "TO_CHAR({type_name})"])
def test_extract_column_refs_preserves_type_named_columns(type_name, reference):
    expression = reference.format(type_name=type_name)
    qualifier = "o" if expression.startswith("o.") else None
    assert extract_column_refs(expression) == [(qualifier, type_name)]


@pytest.mark.parametrize(
    "literal",
    ["DATE '2026-01-01'", "TIME '12:00:00'", "TIMESTAMP '2026-01-01 12:00:00'", "TIMESTAMP_NTZ '2026-01-01'"],
)
def test_extract_column_refs_excludes_typed_literals_in_object_values(literal):
    assert extract_column_refs("{'customer': " + literal + ", 'name': o.AMOUNT}") == [("o", "AMOUNT")]


def test_column_lineage_ignores_names_that_are_not_column_references():
    """Each trap names a column that really exists on the base table, so only the
    extractor stands between it and a wrong lineage entry."""
    base = _table(
        "ORDERS_TBL",
        ["AMOUNT", "A$$B", "C$$D", "A", "D", "PRECISION", "COMMENTCOL", "SHIP_DATE", "DATE", "TIMESTAMP"],
    )
    view = _table("SALES_ANALYSIS", ["DOLLAR_NAMES", "AMOUNT_DP", "COMMENTED", "SHIPPED_THIS_YEAR", "ORDER_DATE"])
    columns = {
        ("O", "DOLLAR_NAMES"): {"logical_table": "O", "expression": "o.A$$B + o.C$$D"},
        ("O", "AMOUNT_DP"): {"logical_table": "O", "expression": "CAST(o.AMOUNT AS DOUBLE PRECISION)"},
        ("O", "COMMENTED"): {
            "logical_table": "O",
            "expression": "o.AMOUNT /* COMMENTCOL */ -- COMMENTCOL\n // COMMENTCOL",
        },
        ("O", "SHIPPED_THIS_YEAR"): {
            "logical_table": "O",
            "expression": "CASE WHEN o.SHIP_DATE >= DATE '2026-01-01' AND TIMESTAMP '2026-01-01' < NOW() THEN 1 END",
        },
        ("O", "ORDER_DATE"): {"logical_table": "O", "expression": "o.DATE"},
    }
    extractor = _extractor()
    extractor.resolve_table_by_fqn = MagicMock(
        side_effect=lambda table_fqn: next((t for t in (base, view) if table_fqn.endswith(t.name.root)), None)
    )
    extractor._fetch_table_maps = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): {"O": ORDERS_TBL}})
    extractor._fetch_columns = MagicMock(return_value={("PUBLIC", "SALES_ANALYSIS"): columns})

    (request,) = extractor._iter_database_lineage("DB")

    lineage = {
        c.toColumn.root.split(".")[-1]: sorted(f.root.split(".")[-1] for f in c.fromColumns)
        for c in request.right.edge.lineageDetails.columnsLineage
    }
    assert lineage == {
        "DOLLAR_NAMES": ["A$$B", "C$$D"],
        "AMOUNT_DP": ["AMOUNT"],
        "COMMENTED": ["AMOUNT"],
        "SHIPPED_THIS_YEAR": ["SHIP_DATE"],
        "ORDER_DATE": ["DATE"],
    }


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
