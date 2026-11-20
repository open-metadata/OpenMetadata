"""Trino SHOW STATS models must coerce raw Trino values"""

from datetime import datetime

from metadata.ingestion.source.database.trino.profiler.system_tables_profiler import (
    ColumnStats,
    TableStats,
)


def test_boolean_bounds():
    stats = ColumnStats(column_name="c", low_value="false", high_value="true")
    assert stats.low_value == 0
    assert stats.high_value == 1


def test_timestamptz_bounds():
    stats = ColumnStats(
        column_name="c",
        low_value="2014-03-06 08:00:00.000 UTC",
        high_value="2030-07-12 08:00:00.000 UTC",
    )
    assert stats.low_value == datetime(2014, 3, 6, 8)
    assert stats.high_value == datetime(2030, 7, 12, 8)


def test_unparseable_bound_is_dropped():
    assert ColumnStats(column_name="c", low_value="not a value").low_value is None


def test_regular_bounds_unchanged():
    stats = ColumnStats(column_name="c", low_value="1.5", high_value=7)
    assert stats.low_value == 1.5
    assert stats.high_value == 7


def test_fractional_row_count():
    assert TableStats(row_count=250949295.8).row_count == 250949296
    assert TableStats(row_count=None).row_count is None
