"""Offline tests for the opt-in ClickZetta data-diff adapter."""

import pytest

pytest.importorskip("data_diff")

from data_diff.abcs.database_types import Date, Text
from data_diff.schema import RawColumnInfo

from metadata.ingestion.source.database.clickzetta.data_diff.data_diff import (
    ClickzettaDatabase,
    ClickzettaDialect,
    register_clickzetta_data_diff,
)


def test_clickzetta_data_diff_dialect_quotes_identifiers_and_parses_paths():
    dialect = ClickzettaDialect()

    assert dialect.quote("order_id") == "`order_id`"
    assert dialect.parse_table_name("seller_center.orders") == ("seller_center", "orders")


def test_clickzetta_data_diff_schema_sql_uses_describe():
    database = object.__new__(ClickzettaDatabase)

    sql = database.select_table_schema(("seller_center", "orders"))

    assert sql == "DESCRIBE `seller_center`.`orders`"


def test_clickzetta_data_diff_allows_describe_without_full_scan_opt_in():
    class Cursor:
        def execute(self, sql):
            self.sql = sql

        def fetchall(self):
            return [("id", "BIGINT", "")]

    class Connection:
        def cursor(self):
            return Cursor()

    database = object.__new__(ClickzettaDatabase)
    database.allow_full_table_scan = False
    database._conn = Connection()

    assert database._query("DESCRIBE `seller_center`.`orders`") == [("id", "BIGINT", "")]


def test_clickzetta_data_diff_describe_schema_normalizes_clickzetta_types():
    class Cursor:
        def execute(self, sql):
            self.sql = sql

        def fetchall(self):
            return [
                ("id", "bigint", ""),
                ("event_date", "date", ""),
                ("label", "varchar(32)", ""),
            ]

    class Connection:
        def cursor(self):
            return Cursor()

    database = object.__new__(ClickzettaDatabase)
    database.allow_full_table_scan = False
    database._conn = Connection()

    schema = database.query_table_schema(("seller_center", "orders"))

    assert schema["id"].data_type == "BIGINT"
    assert schema["event_date"].data_type == "DATE"
    assert schema["label"].data_type == "VARCHAR"


def test_clickzetta_data_diff_dialect_parses_describe_type_names():
    dialect = ClickzettaDialect()

    assert isinstance(dialect.parse_type((), RawColumnInfo(column_name="event_date", data_type="date")), Date)
    assert isinstance(dialect.parse_type((), RawColumnInfo(column_name="label", data_type="varchar(32)")), Text)


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
