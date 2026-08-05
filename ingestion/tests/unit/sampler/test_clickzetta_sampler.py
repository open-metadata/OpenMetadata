"""Offline safety and SQL compilation tests for ClickZetta sampling."""

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table

from metadata.sampler.sqlalchemy.clickzetta.sampler import (
    ClickzettaSampler,
    build_bounded_sample_query,
    validate_bounded_select,
)


def test_bounded_select_requires_a_positive_limit():
    assert validate_bounded_select("SELECT id FROM seller_center.orders LIMIT 25") == 25

    for query in (
        "SELECT id FROM seller_center.orders",
        "SELECT id FROM seller_center.orders LIMIT 0",
        "SELECT id FROM seller_center.orders LIMIT 1001",
        "INSERT INTO seller_center.orders VALUES (1) LIMIT 1",
    ):
        with pytest.raises(ValueError):
            validate_bounded_select(query)


def test_clickzetta_sampler_rejects_unbounded_sampling_modes():
    assert ClickzettaSampler.validate_profile_sample(profile_sample=25, profile_sample_type="ROWS") == 25

    with pytest.raises(ValueError, match="percentage"):
        ClickzettaSampler.validate_profile_sample(profile_sample=10, profile_sample_type="PERCENTAGE")

    with pytest.raises(ValueError, match="positive"):
        ClickzettaSampler.validate_profile_sample(profile_sample=0, profile_sample_type="ROWS")


def test_bounded_sample_query_preserves_identifiers_and_limit():
    table = Table(
        "orders",
        MetaData(),
        Column("order_id", Integer),
        Column("customer_name", String),
        schema="seller_center",
    )

    statement = build_bounded_sample_query(table, ["order_id", "customer_name"], 25)
    sql = str(statement.compile(compile_kwargs={"literal_binds": True}))

    assert "seller_center.orders" in sql
    assert "order_id" in sql
    assert "customer_name" in sql
    assert "LIMIT 25" in sql


def test_clickzetta_sqlalchemy_dialect_compiles_bounded_query():
    sqlalchemy_clickzetta = pytest.importorskip("sqlalchemy_clickzetta")
    from sqlalchemy.engine import make_url

    table = Table("orders", MetaData(), Column("order_id", Integer), schema="seller_center")
    statement = build_bounded_sample_query(table, ["order_id"], 5)
    dialect = make_url("clickzetta://").get_dialect()()
    sql = str(statement.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))

    assert sqlalchemy_clickzetta
    assert "LIMIT 5" in sql
    assert "seller_center" in sql
