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
"""Snowflake semantic-view column builder — returns SQLAlchemy-shape dicts
that the standard ``sql_column_handler`` pipeline understands."""

from __future__ import annotations

from sqlalchemy.types import NullType

from metadata.ingestion.source.database.snowflake.semantic_view.columns import (
    build_columns,
)


def _row(table: str, name: str, dtype: str, expr: str = "", comment: str = "", synonyms: str = "") -> tuple:
    return (table, name, dtype, expr, comment, synonyms)


def test_dim_fact_metric_rows_become_sqlalchemy_dicts():
    cols = build_columns(
        dimensions=[_row("orders", "region", "VARCHAR")],
        facts=[_row("orders", "amount", "NUMBER(38,2)")],
        metrics=[_row("orders", "total_sales", "NUMBER", expr="SUM(amount)")],
    )
    by_name = {c["name"]: c for c in cols}
    assert set(by_name) == {"region", "amount", "total_sales"}
    assert by_name["region"]["type"] is not None
    assert by_name["amount"]["nullable"] is True
    assert "[Dimension]" in by_name["region"]["comment"]
    assert "[Metric]" in by_name["total_sales"]["comment"]
    assert "Expression: SUM(amount)" in by_name["total_sales"]["comment"]
    assert by_name["region"]["system_data_type"] == "VARCHAR"


def test_unknown_snowflake_type_maps_to_null_type():
    cols = build_columns(
        dimensions=[_row("t", "weird", "EXOTIC_TYPE")],
        facts=[],
        metrics=[],
    )
    assert isinstance(cols[0]["type"], NullType)
    assert cols[0]["system_data_type"] == "EXOTIC_TYPE"


def test_same_name_across_kinds_collapses_and_enumerates_kinds():
    cols = build_columns(
        dimensions=[_row("t", "revenue", "NUMBER")],
        facts=[_row("t", "revenue", "NUMBER")],
        metrics=[_row("t", "revenue", "NUMBER")],
    )
    assert len(cols) == 1
    assert "[Dimension, Fact, Metric]" in cols[0]["comment"]


def test_logical_table_synonyms_and_comment_flow_to_description():
    cols = build_columns(
        dimensions=[_row("orders", "region", "VARCHAR", comment="US regions only", synonyms="area,zone")],
        facts=[],
        metrics=[],
    )
    comment = cols[0]["comment"]
    assert "Logical table: orders" in comment
    assert "Synonyms: area,zone" in comment
    assert "US regions only" in comment


def test_empty_rows_yield_no_columns():
    assert build_columns(dimensions=[], facts=[], metrics=[]) == []


def test_varchar_length_carried_on_sqlalchemy_type():
    """dataLength defaults to 1 unless the type instance carries it — parse it."""
    from sqlalchemy.sql.sqltypes import VARCHAR

    cols = build_columns(
        dimensions=[_row("orders", "region", "VARCHAR(16777216)")],
        facts=[],
        metrics=[],
    )
    sa_type = cols[0]["type"]
    assert isinstance(sa_type, VARCHAR)
    assert sa_type.length == 16777216


def test_number_precision_scale_carried_on_sqlalchemy_type():
    from sqlalchemy.sql.sqltypes import Numeric

    cols = build_columns(
        dimensions=[],
        facts=[_row("orders", "amount", "NUMBER(18,2)")],
        metrics=[],
    )
    sa_type = cols[0]["type"]
    assert isinstance(sa_type, Numeric)
    assert sa_type.precision == 18
    assert sa_type.scale == 2


def test_logical_table_qualifier_stripped_from_expression_in_description():
    cols = build_columns(
        dimensions=[_row("customers", "c_region", "VARCHAR", expr="customers.c_region")],
        facts=[],
        metrics=[_row("customers", "cnt", "NUMBER", expr="COUNT(customers.c_custkey)")],
    )
    by = {c["name"]: c for c in cols}
    assert "Expression: c_region" in by["c_region"]["comment"]
    assert "customers.c_region" not in by["c_region"]["comment"]
    assert "Expression: COUNT(c_custkey)" in by["cnt"]["comment"]
