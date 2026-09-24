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
Unit tests for the Snowflake stored-procedure lineage query.

The statement reads ACCOUNT_USAGE.QUERY_HISTORY twice and joins the two halves by
session and time overlap. Without an upper bound it scans the whole lookback window,
which Snowflake cancels on long windows with
`000604 (57014): SQL execution was cancelled by the client due to a timeout`.

The read stays a single bounded statement and is only split when the engine actually
cancels it, because every ACCOUNT_USAGE statement carries a large fixed cost: measured
against a real account, reading a 365-day window in fixed 2-day chunks took 1737s
across 183 statements versus 29s for the single statement, for byte-identical results.
These tests pin the bounds, the overlap slack that keeps a CALL's child queries
joinable across a split boundary, and when a cancelled statement is retried.
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock

from sqlalchemy.exc import ProgrammingError

from metadata.ingestion.source.database.snowflake.lineage import (
    STORED_PROCEDURE_MAX_SPLIT_DEPTH,
    STORED_PROCEDURE_MIN_WINDOW,
    STORED_PROCEDURE_OVERLAP_DAYS,
    SnowflakeLineageSource,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES,
)


def _make_lineage_source(
    start: datetime,
    end: datetime,
    account_usage: str = "SNOWFLAKE.ACCOUNT_USAGE",
) -> SnowflakeLineageSource:
    """Instantiate the source without its heavy parent __init__, as the sibling
    ACCESS_HISTORY tests do."""
    src = SnowflakeLineageSource.__new__(SnowflakeLineageSource)
    src.service_connection = MagicMock()
    src.service_connection.accountUsageSchema = account_usage
    src.source_config = MagicMock()
    src.start = start
    src.end = end
    src._stored_procedure_windows = {}
    return src


def _cancelled(message: str = "000604 (57014): SQL execution was cancelled by the client due to a timeout"):
    """A SQLAlchemy-wrapped driver error the way the Snowflake driver raises a cancel."""
    driver_error = type("_DriverError", (Exception,), {"sqlstate": "57014"})(message)
    return ProgrammingError("statement", {}, driver_error)


def _rejected(message: str = "002003 (02000): SQL compilation error: Object does not exist"):
    driver_error = type("_DriverError", (Exception,), {"sqlstate": "02000"})(message)
    return ProgrammingError("statement", {}, driver_error)


def _sp_window_bounds(statement: str) -> tuple[str, str]:
    """The SP_HISTORY (CALL) half's lower and upper bound, as rendered."""
    call_half = statement.partition("Q_HISTORY AS")[0]
    lower = call_half.partition("START_TIME >= '")[2].partition("'")[0]
    upper = call_half.partition("START_TIME < '")[2].partition("'")[0]
    return lower, upper


def _query_window_bounds(statement: str) -> tuple[str, str]:
    """The Q_HISTORY (non-CALL) half's lower and upper bound, as rendered."""
    query_half = statement.partition("Q_HISTORY AS")[2]
    lower = query_half.partition("START_TIME >= '")[2].partition("'")[0]
    upper = query_half.partition("START_TIME < '")[2].partition("'")[0]
    return lower, upper


# ---------------------------------------------------------------------------
# SQL rendering
# ---------------------------------------------------------------------------


def test_stored_procedure_sql_bounds_both_halves_of_the_scan():
    """Both QUERY_HISTORY reads carry an upper bound, so neither scans to `now`."""
    rendered = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_date="2025-01-01 00:00:00",
        end_date="2025-01-03 00:00:00",
        query_end_date="2025-01-05 00:00:00",
    )
    assert _sp_window_bounds(rendered) == ("2025-01-01 00:00:00", "2025-01-03 00:00:00")
    assert _query_window_bounds(rendered) == ("2025-01-01 00:00:00", "2025-01-05 00:00:00")


def test_stored_procedure_sql_does_not_sort_the_whole_join():
    """A global ORDER BY sorts the entire join output for no benefit: chunks are
    processed concurrently, so nothing downstream can rely on the order."""
    rendered = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_date="2025-01-01 00:00:00",
        end_date="2025-01-03 00:00:00",
        query_end_date="2025-01-05 00:00:00",
    )
    assert "ORDER BY" not in rendered.upper()


def test_stored_procedure_query_window_extends_past_the_call_window():
    """A CALL starting just before the window closes keeps running past it, so the
    non-CALL half must reach beyond the CALL window or those child queries are
    lost from lineage."""
    start = datetime(2025, 1, 1)
    src = _make_lineage_source(start=start, end=start + timedelta(days=2))

    statement = next(iter(src.get_stored_procedure_sql_statements()))

    _, call_upper = _sp_window_bounds(statement)
    _, query_upper = _query_window_bounds(statement)
    assert query_upper == str(datetime.fromisoformat(call_upper) + timedelta(days=STORED_PROCEDURE_OVERLAP_DAYS))


# ---------------------------------------------------------------------------
# Splitting a cancelled statement
# ---------------------------------------------------------------------------


def test_whole_window_is_read_in_one_statement():
    """Splitting up front costs far more than it saves, so a year-long lookback is still
    a single statement until something actually cancels it."""
    start = datetime(2025, 9, 15)
    src = _make_lineage_source(start=start, end=start + timedelta(days=365))

    statements = list(src.get_stored_procedure_sql_statements())

    assert len(statements) == 1
    assert _sp_window_bounds(statements[0]) == (str(start), str(start + timedelta(days=365)))


def test_cancelled_statement_is_retried_over_both_halves():
    """The halves have to tile the original window exactly: the CALL bound is half open,
    so the midpoint belongs to the second half only and no CALL is read twice or lost."""
    start = datetime(2025, 1, 1)
    end = start + timedelta(days=8)
    src = _make_lineage_source(start=start, end=end)
    statement = next(iter(src.get_stored_procedure_sql_statements()))

    halves = list(src.narrow_stored_procedure_statement(statement, _cancelled()))

    midpoint = start + timedelta(days=4)
    assert [_sp_window_bounds(half) for half in halves] == [
        (str(start), str(midpoint)),
        (str(midpoint), str(end)),
    ]


def test_halves_are_split_again_when_they_are_cancelled_too():
    """One split is rarely enough on an account that cannot scan the window at all."""
    start = datetime(2025, 1, 1)
    src = _make_lineage_source(start=start, end=start + timedelta(days=8))
    statement = next(iter(src.get_stored_procedure_sql_statements()))

    first_half = next(iter(src.narrow_stored_procedure_statement(statement, _cancelled())))
    quarters = list(src.narrow_stored_procedure_statement(first_half, _cancelled()))

    assert [_sp_window_bounds(quarter) for quarter in quarters] == [
        (str(start), str(start + timedelta(days=2))),
        (str(start + timedelta(days=2)), str(start + timedelta(days=4))),
    ]


def test_splitting_stops_at_the_depth_cap():
    """Without a cap, a window that always fails would fan one error out into hundreds of
    statements, each paying the full ACCOUNT_USAGE cost before failing again."""
    start = datetime(2025, 1, 1)
    src = _make_lineage_source(start=start, end=start + timedelta(days=365))
    statement = next(iter(src.get_stored_procedure_sql_statements()))

    depth = 0
    while True:
        narrowed = list(src.narrow_stored_procedure_statement(statement, _cancelled()))
        if not narrowed:
            break
        statement = narrowed[0]
        depth += 1

    assert depth == STORED_PROCEDURE_MAX_SPLIT_DEPTH


def test_a_window_at_the_floor_is_not_split_further():
    """Below a day the window stops being the problem, so narrowing it just burns
    statements."""
    start = datetime(2025, 1, 1)
    src = _make_lineage_source(start=start, end=start + STORED_PROCEDURE_MIN_WINDOW)
    statement = next(iter(src.get_stored_procedure_sql_statements()))

    assert list(src.narrow_stored_procedure_statement(statement, _cancelled())) == []


def test_a_rejected_statement_is_not_retried():
    """A permission or compilation error fails identically on every half, so retrying
    would turn one reported failure into sixteen."""
    start = datetime(2025, 1, 1)
    src = _make_lineage_source(start=start, end=start + timedelta(days=365))
    statement = next(iter(src.get_stored_procedure_sql_statements()))

    assert list(src.narrow_stored_procedure_statement(statement, _rejected())) == []


def test_an_unknown_statement_is_not_retried():
    """Only statements this source rendered can be narrowed, since only those have a
    known window."""
    src = _make_lineage_source(start=datetime(2025, 1, 1), end=datetime(2025, 1, 9))

    assert list(src.narrow_stored_procedure_statement("SELECT 1", _cancelled())) == []
