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
Impala datetime SQL generation for DQ / profiler interval filters.

#35590: Impala has no bare CURRENT_TIMESTAMP; the generic compiler emitted that and
the table_row_inserted_count_to_be_between test aborted with a column-reference error.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.engine.default import DefaultDialect

from metadata.profiler.orm.functions.datetime import (
    DateAddFn,
    DatetimeAddFn,
    TimestampAddFn,
)
from metadata.profiler.orm.registry import Dialects


@pytest.fixture(name="impala_dialect")
def impala_dialect_fixture():
    """Compile-only dialect; no Impala connection is required."""

    class _ImpalaDialect(DefaultDialect):
        name = Dialects.Impala

    return _ImpalaDialect()


@pytest.mark.parametrize(
    "fn,expected",
    [
        (DateAddFn(1, text("DAY")), "CAST(NOW() - INTERVAL 1 DAY AS DATE)"),
        (DatetimeAddFn(1, text("DAY")), "(NOW() - INTERVAL 1 DAY)"),
        (TimestampAddFn(1, text("DAY")), "(NOW() - INTERVAL 1 DAY)"),
    ],
    ids=["date", "datetime", "timestamp"],
)
def test_impala_interval_uses_now_not_bare_current_timestamp(impala_dialect, fn, expected):
    sql = str(fn.compile(dialect=impala_dialect, compile_kwargs={"literal_binds": True}))

    assert sql == expected
    assert "CURRENT_TIMESTAMP" not in sql
