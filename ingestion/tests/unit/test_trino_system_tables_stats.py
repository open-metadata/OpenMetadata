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
"""Trino SHOW STATS models must coerce raw Trino values"""

from collections import namedtuple
from datetime import datetime
from unittest.mock import Mock

import pytest

from metadata.ingestion.source.database.trino.profiler.system_tables_profiler import (
    ColumnStats,
    TableStats,
    TrinoStoredStatisticsSource,
)


@pytest.mark.parametrize("bounds", [("false", "true"), (False, True), (" FALSE ", " TRUE ")])
def test_boolean_bounds_are_skipped(bounds):
    stats = ColumnStats(column_name="c", low_value=bounds[0], high_value=bounds[1])
    assert stats.low_value is None
    assert stats.high_value is None


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


def test_show_stats_preserves_other_columns_when_a_bound_is_unsupported():
    row = namedtuple(
        "StatsRow", "column_name data_size distinct_values_count nulls_fraction row_count low_value high_value"
    )
    session = Mock()
    session.execute.return_value = [
        row("flag", None, 2, 0.1, None, "false", "true"),
        row("created_at", None, 2, 0, None, "2014-03-06 08:00:00.000 UTC", "2030-07-12 08:00:00.000 UTC"),
        row("value", 8.0, 2, 0, None, "1.5", "7"),
        row("unsupported", None, 2, 0, None, "not a value", None),
        row(None, None, None, None, 10.8, None, None),
    ]
    source = TrinoStoredStatisticsSource.__new__(TrinoStoredStatisticsSource)
    source.session = session

    stats = source._get_db_stats("schema", "table")

    assert stats.row_count == 11
    assert set(stats.columns) == {"flag", "created_at", "value", "unsupported"}
    assert stats.columns["flag"].low_value is None
    assert stats.columns["flag"].high_value is None
    assert stats.columns["flag"].distinct_values_count == 2
    assert stats.columns["flag"].nulls_fraction == 0.1
    assert stats.columns["created_at"].low_value == datetime(2014, 3, 6, 8)
    assert stats.columns["created_at"].high_value == datetime(2030, 7, 12, 8)
    assert stats.columns["value"].data_size == 8
    assert stats.columns["value"].low_value == 1.5
    assert stats.columns["value"].high_value == 7
    assert stats.columns["unsupported"].low_value is None
