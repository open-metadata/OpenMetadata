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
Both ``impala`` and ``impala4`` schemes must register the same overrides (impyla 0.24
exposes ``dialect.name == "impala4"`` for that URL).
"""

import pytest
from sqlalchemy import create_engine, text

from metadata.profiler.orm.functions.datetime import (
    DateAddFn,
    DatetimeAddFn,
    TimestampAddFn,
)
from metadata.profiler.orm.registry import Dialects

IMPALA_SCHEMES = (
    pytest.param(("impala", Dialects.Impala), id="impala"),
    pytest.param(("impala4", Dialects.Impala4), id="impala4"),
)


@pytest.fixture(params=IMPALA_SCHEMES)
def impala_dialect(request):
    """Compile against the real impyla dialect for each supported scheme."""
    pytest.importorskip("impala.sqlalchemy")
    scheme, expected_name = request.param
    dialect = create_engine(f"{scheme}://").dialect
    assert dialect.name == expected_name
    return dialect


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


def test_impala4_is_a_registered_dialect():
    """Without this entry the @compiles(..., Dialects.Impala4) hooks cannot register."""
    assert Dialects.Impala4 == "impala4"
