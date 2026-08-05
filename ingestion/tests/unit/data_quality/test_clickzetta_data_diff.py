"""Offline tests for the opt-in ClickZetta data-diff adapter."""

import pytest

pytest.importorskip("data_diff")

from metadata.ingestion.source.database.clickzetta.data_diff.data_diff import (
    ClickzettaDatabase,
    ClickzettaDialect,
    register_clickzetta_data_diff,
)


def test_clickzetta_data_diff_dialect_quotes_identifiers_and_parses_paths():
    dialect = ClickzettaDialect()

    assert dialect.quote("order_id") == "`order_id`"
    assert dialect.parse_table_name("seller_center.orders") == ("seller_center", "orders")


def test_clickzetta_data_diff_schema_sql_is_metadata_only():
    database = object.__new__(ClickzettaDatabase)

    sql = database.select_table_schema(("seller_center", "orders"))

    assert "information_schema.columns" in sql.lower()
    assert "table_schema = 'seller_center'" in sql
    assert "table_name = 'orders'" in sql


def test_clickzetta_data_diff_registration_is_explicit():
    from data_diff.databases import _connect

    original = _connect.DATABASE_BY_SCHEME.get("clickzetta")
    _connect.DATABASE_BY_SCHEME.pop("clickzetta", None)
    try:
        register_clickzetta_data_diff()
        assert _connect.DATABASE_BY_SCHEME["clickzetta"] is ClickzettaDatabase
        assert _connect.connect.database_by_scheme["clickzetta"] is ClickzettaDatabase
    finally:
        if original is None:
            _connect.DATABASE_BY_SCHEME.pop("clickzetta", None)
            _connect.connect.database_by_scheme.pop("clickzetta", None)
        else:
            _connect.DATABASE_BY_SCHEME["clickzetta"] = original
            _connect.connect.database_by_scheme["clickzetta"] = original


def test_clickzetta_data_diff_rejects_data_queries_without_explicit_opt_in():
    database = object.__new__(ClickzettaDatabase)
    database.allow_full_table_scan = False
    database._conn = None

    with pytest.raises(RuntimeError, match="allowFullTableScan"):
        database._query("SELECT * FROM `seller_center`.`orders`")
