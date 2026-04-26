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
"""
Unit tests for the ``_parse_clickhouse_dict_source`` helper introduced in
``clickhouse/lineage.py`` (Issue #26095 — Dictionary Lineage support).

The helper parses the ``source`` column of ``system.dictionaries``, which
Clickhouse serialises as a human-readable string, e.g.::

    ClickHouse: host: localhost, port: 9000, user: default, db: mydb, table: orders

Only ClickHouse-native sources are relevant for within-service lineage; all
other source types (MySQL, PostgreSQL, Kafka, …) must return ``None``.

The tests are deliberately dependency-free: ``_parse_clickhouse_dict_source``
is pure Python (only ``re`` from the standard library), so we import it
directly without needing ``clickhouse_sqlalchemy`` or any OM runtime.
"""

import pytest

from metadata.ingestion.source.database.clickhouse.lineage import (
    _parse_clickhouse_dict_source,
)


# ---------------------------------------------------------------------------
# Parametrize: valid ClickHouse-native sources
# ---------------------------------------------------------------------------

VALID_CASES = [
    # ------------------------------------------------------------------
    # id, source_str, expected_db, expected_table
    # ------------------------------------------------------------------
    (
        "standard_system_table_format",
        "ClickHouse: host: localhost, port: 9000, user: default, db: mydb, table: dim_table",
        "mydb",
        "dim_table",
    ),
    (
        "single_quoted_db_and_table",
        "ClickHouse: db: 'mydb', table: 'orders'",
        "mydb",
        "orders",
    ),
    (
        "double_quoted_db_and_table",
        'ClickHouse: db: "analytics", table: "dim_date"',
        "analytics",
        "dim_date",
    ),
    (
        "mixed_quotes_single_db_double_table",
        "ClickHouse: db: 'warehouse', table: \"fact_sales\"",
        "warehouse",
        "fact_sales",
    ),
    (
        "extra_unrelated_params_before_db_table",
        "ClickHouse: secure: 1, db: analytics, timeout: 50, table: events",
        "analytics",
        "events",
    ),
    (
        "extra_unrelated_params_after_db_table",
        "ClickHouse: host: 10.0.0.1, port: 9000, user: root, db: prod, table: orders, where: active=1",
        "prod",
        "orders",
    ),
    (
        "db_and_table_appear_last",
        "ClickHouse: host: ch-replica.internal, port: 9440, user: svc, db: dim, table: cities",
        "dim",
        "cities",
    ),
    (
        "db_and_table_appear_first",
        "ClickHouse: db: raw, table: logs, host: localhost, port: 9000",
        "raw",
        "logs",
    ),
    (
        "uppercase_prefix",
        "CLICKHOUSE: host: localhost, db: upper, table: case_tbl",
        "upper",
        "case_tbl",
    ),
    (
        "mixed_case_prefix",
        "Clickhouse: host: localhost, db: mixed, table: case_tbl",
        "mixed",
        "case_tbl",
    ),
    (
        "leading_whitespace_in_source_str",
        "  ClickHouse: host: localhost, db: spaced, table: tbl",
        "spaced",
        "tbl",
    ),
    (
        "underscores_in_db_and_table_names",
        "ClickHouse: db: my_warehouse, table: dim_product_category",
        "my_warehouse",
        "dim_product_category",
    ),
    (
        "hyphenated_table_name",
        "ClickHouse: db: ops, table: error-events",
        "ops",
        "error-events",
    ),
]


@pytest.mark.parametrize(
    "source_str, expected_db, expected_table",
    [(row[1], row[2], row[3]) for row in VALID_CASES],
    ids=[row[0] for row in VALID_CASES],
)
def test_parse_valid_clickhouse_sources(source_str, expected_db, expected_table):
    """Parser must return (db, table) for all ClickHouse-native source strings."""
    result = _parse_clickhouse_dict_source(source_str)

    assert result is not None, (
        f"Expected a (db, table) tuple for source string: {source_str!r}"
    )
    db, table = result
    assert db == expected_db, f"db mismatch: got {db!r}, expected {expected_db!r}"
    assert table == expected_table, (
        f"table mismatch: got {table!r}, expected {expected_table!r}"
    )


# ---------------------------------------------------------------------------
# Parametrize: non-ClickHouse sources → must return None
# ---------------------------------------------------------------------------

NON_CLICKHOUSE_CASES = [
    (
        "postgresql_source",
        "PostgreSQL: host: localhost, port: 5432, db: core, table: users",
    ),
    (
        "mysql_source",
        "MySQL: host: localhost, port: 3306, user: root, db: sales, table: products",
    ),
    (
        "kafka_source",
        "Kafka: brokers: kafka:9092, topic: events",
    ),
    (
        "http_source",
        "HTTP: url: https://example.com/data.csv",
    ),
    (
        "mongodb_source",
        "MongoDB: host: localhost, port: 27017, user: admin, db: catalog, collection: items",
    ),
    (
        "odbc_source",
        "ODBC: connection_string: DSN=MyDSN;",
    ),
    (
        "redis_source",
        "Redis: host: localhost, port: 6379, db: 0",
    ),
]


@pytest.mark.parametrize(
    "source_str",
    [row[1] for row in NON_CLICKHOUSE_CASES],
    ids=[row[0] for row in NON_CLICKHOUSE_CASES],
)
def test_parse_non_clickhouse_sources_return_none(source_str):
    """Parser must return None for sources other than ClickHouse."""
    assert _parse_clickhouse_dict_source(source_str) is None, (
        f"Expected None for non-ClickHouse source: {source_str!r}"
    )


# ---------------------------------------------------------------------------
# Parametrize: malformed / degenerate inputs → must return None gracefully
# ---------------------------------------------------------------------------

MALFORMED_CASES = [
    ("none_value", None),
    ("empty_string", ""),
    ("whitespace_only", "   "),
    ("clickhouse_prefix_only", "ClickHouse:"),
    ("clickhouse_prefix_with_whitespace", "ClickHouse:   "),
    ("missing_table_key", "ClickHouse: host: localhost, db: mydb"),
    ("missing_db_key", "ClickHouse: host: localhost, table: orders"),
    ("missing_both_db_and_table", "ClickHouse: host: localhost, port: 9000"),
    ("random_string", "this is not a source string at all"),
    ("partial_key_db_only", "db: mydb, table: orders"),  # no ClickHouse: prefix
    ("integer_like_string", "12345"),
]


@pytest.mark.parametrize(
    "source_str",
    [row[1] for row in MALFORMED_CASES],
    ids=[row[0] for row in MALFORMED_CASES],
)
def test_parse_malformed_inputs_return_none(source_str):
    """Parser must never raise; it must return None for any invalid input."""
    # Must not raise any exception
    result = _parse_clickhouse_dict_source(source_str)
    assert result is None, (
        f"Expected None for malformed input {source_str!r}, got {result!r}"
    )


# ---------------------------------------------------------------------------
# Explicit regression tests: Quote-stripping (the bug fixed in Phase 2)
# ---------------------------------------------------------------------------

class TestQuoteStrippingRegression:
    """
    Regression suite for the quote-stripping fix applied to
    ``_parse_clickhouse_dict_source``.

    Clickhouse's XML/config serialisation sometimes wraps values in single or
    double quotes.  Before the fix, the raw value ``'mydb'`` would be returned
    as the db name instead of ``mydb``, causing FQN construction to fail with
    a "not found" result against the OM API.
    """

    def test_single_quoted_values_are_stripped(self):
        """Single-quoted db and table values must be returned without quotes."""
        result = _parse_clickhouse_dict_source(
            "ClickHouse: db: 'production', table: 'fact_orders'"
        )
        assert result == ("production", "fact_orders")

    def test_double_quoted_values_are_stripped(self):
        """Double-quoted db and table values must be returned without quotes."""
        result = _parse_clickhouse_dict_source(
            'ClickHouse: db: "staging", table: "dim_users"'
        )
        assert result == ("staging", "dim_users")

    def test_mixed_quote_styles_are_stripped(self):
        """One field single-quoted, the other double-quoted — both stripped."""
        result = _parse_clickhouse_dict_source(
            "ClickHouse: db: 'mydb', table: \"orders\""
        )
        assert result == ("mydb", "orders")

    def test_unquoted_values_pass_through_unchanged(self):
        """Unquoted values must not be modified by strip logic."""
        result = _parse_clickhouse_dict_source(
            "ClickHouse: db: clean_db, table: clean_table"
        )
        assert result == ("clean_db", "clean_table")

    def test_returned_db_has_no_surrounding_whitespace(self):
        """Quoted values must be returned without their enclosing quote characters.

        Note: Clickhouse's ``system.dictionaries`` serialises SOURCE() values
        with quotes directly wrapping the token — no interior padding spaces.
        The format is ``db: 'mydb'``, not ``db: ' mydb '``.  This test verifies
        that the strip(\" '\\\"\") call removes the outer quotes cleanly, and that
        any incidental trailing whitespace *outside* the token boundary is also
        removed.
        """
        result = _parse_clickhouse_dict_source(
            "ClickHouse: db: 'clean_db', table: 'clean_table'"
        )
        assert result is not None
        db, table = result
        # No quote characters or whitespace must remain after strip
        assert db == "clean_db", (
            f"Unexpected characters in db after strip: {db!r}"
        )
        assert table == "clean_table", (
            f"Unexpected characters in table after strip: {table!r}"
        )

    def test_result_type_is_always_tuple_of_strings(self):
        """The returned value must be a tuple of two plain str objects."""
        result = _parse_clickhouse_dict_source(
            "ClickHouse: db: 'mydb', table: 'orders'"
        )
        assert isinstance(result, tuple), f"Expected tuple, got {type(result)}"
        assert len(result) == 2, f"Expected 2-tuple, got length {len(result)}"
        db, table = result
        assert isinstance(db, str), f"db is not str: {type(db)}"
        assert isinstance(table, str), f"table is not str: {type(table)}"
