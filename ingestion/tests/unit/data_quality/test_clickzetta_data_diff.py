"""Offline tests for the ClickZetta data-diff adapter."""

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


def test_clickzetta_data_diff_executes_describe_queries():
    class Cursor:
        def execute(self, sql):
            self.sql = sql

        def fetchall(self):
            return [("id", "BIGINT", "")]

    class Connection:
        def cursor(self):
            return Cursor()

    database = object.__new__(ClickzettaDatabase)
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


def test_clickzetta_data_diff_executes_generated_data_queries_without_a_private_opt_in():
    class Cursor:
        def execute(self, sql):
            self.sql = sql

        def fetchall(self):
            return [(1,)]

    class Connection:
        def cursor(self):
            return Cursor()

    database = object.__new__(ClickzettaDatabase)
    database._conn = Connection()

    assert database._query("SELECT * FROM `seller_center`.`orders`") == [(1,)]


def test_clickzetta_data_diff_executes_queries_containing_metadata_text():
    class Cursor:
        def execute(self, sql):
            self.sql = sql

        def fetchall(self):
            return [("sys.information_schema.columns",)]

    class Connection:
        def cursor(self):
            return Cursor()

    database = object.__new__(ClickzettaDatabase)
    database._conn = Connection()

    assert database._query("SELECT 'sys.information_schema.columns' AS marker") == [("sys.information_schema.columns",)]


@pytest.mark.parametrize(
    "legacy_option",
    ["allowFullTableScan", "clickzettaAllowFullTableScan"],
)
def test_clickzetta_data_diff_rejects_explicit_legacy_false(monkeypatch, legacy_option):
    from clickzetta.connector.v0 import dbapi

    monkeypatch.setattr(dbapi, "connect", lambda **_: object())

    with pytest.raises(ValueError, match=r"remove.*false"):
        ClickzettaDatabase(
            host="instance.service",
            workspace="workspace",
            virtualcluster="vcluster",
            **{legacy_option: "false"},
        )


def test_clickzetta_data_diff_rejects_conflicting_legacy_scan_options(monkeypatch):
    from clickzetta.connector.v0 import dbapi

    monkeypatch.setattr(dbapi, "connect", lambda **_: object())

    with pytest.raises(ValueError, match=r"remove.*false"):
        ClickzettaDatabase(
            host="instance.service",
            workspace="workspace",
            virtualcluster="vcluster",
            allowFullTableScan="true",
            clickzettaAllowFullTableScan="false",
        )


@pytest.mark.parametrize(
    "legacy_options",
    [
        {},
        {"allowFullTableScan": "true"},
        {"clickzettaAllowFullTableScan": True},
    ],
)
def test_clickzetta_data_diff_accepts_standard_or_legacy_true_configuration(monkeypatch, legacy_options):
    from clickzetta.connector.v0 import dbapi

    connection = object()
    monkeypatch.setattr(dbapi, "connect", lambda **_: connection)

    database = ClickzettaDatabase(
        host="instance.service",
        workspace="workspace",
        virtualcluster="vcluster",
        **legacy_options,
    )

    assert database._conn is connection
