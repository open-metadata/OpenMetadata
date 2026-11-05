#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Offline behavior checks for independent observation polling."""

from itertools import cycle

import pytest

from ..runtime import expect
from ..runtime.expect import Poll, Query


def check_pair(value):
    assert value is not None, "profile missing"
    assert value[0] == 5, f"rowCount: expected 5, got {value[0]}"
    assert value[1] == 2, f"columnCount: expected 2, got {value[1]}"


def test_refetches_missing_then_stale_then_current(polling_clock):
    observations = iter([None, (4, 2), (5, 2)])

    result = expect.poll(Query("my_table.profile", lambda: next(observations))).satisfies(check_pair)

    assert result == (5, 2)
    assert polling_clock.monotonic() == pytest.approx(0.2)


def test_first_matching_observation_returns_without_waiting(polling_clock):
    observations = iter([(5, 2)])

    assert expect.poll(Query("profile", lambda: next(observations))).satisfies(check_pair) == (5, 2)
    assert polling_clock.monotonic() == 0


def test_rechecks_whole_observation(polling_clock):
    observations = iter([(5, 0), (4, 2), (5, 2)])

    result = expect.poll(Query("profile", lambda: next(observations))).satisfies(check_pair)

    assert result == (5, 2)
    assert polling_clock.monotonic() == pytest.approx(0.2)


def test_alternating_partial_matches_time_out(polling_clock):
    observations = cycle([(5, 0), (4, 2)])

    with pytest.raises(AssertionError, match=r"profile.*no match.*Last mismatch"):
        expect.poll(Query("profile", lambda: next(observations)), timeout=0.35).satisfies(check_pair)

    assert polling_clock.monotonic() == pytest.approx(0.3)


@pytest.mark.parametrize("error_type", [PermissionError, ValueError, ConnectionError, TimeoutError, AssertionError])
def test_query_errors_propagate_unchanged_without_retry(error_type, polling_clock):
    error = error_type("read failed")
    reads = 0

    def read():
        nonlocal reads
        reads += 1
        raise error

    with pytest.raises(error_type) as failure:
        expect.poll(Query("my_table", read)).satisfies(check_pair)

    assert failure.value is error
    assert reads == 1
    assert polling_clock.monotonic() == 0


@pytest.mark.parametrize("error_type", [ValueError, TypeError, AttributeError])
def test_checker_programming_errors_propagate_without_retry(error_type, polling_clock):
    error = error_type("invalid checker")
    observations = iter([(5, 2)])

    def invalid_check(value):
        raise error

    with pytest.raises(error_type) as failure:
        expect.poll(Query("profile", lambda: next(observations))).satisfies(invalid_check)

    assert failure.value is error
    assert polling_clock.monotonic() == 0


@pytest.mark.parametrize(
    "timeout,interval",
    [(0, 1), (-1, 1), (1, 0), (1, -1), (float("inf"), 1), (1, float("inf")), (float("nan"), 1), (1, float("nan"))],
)
@pytest.mark.parametrize("make_poll", [expect.poll, Poll])
def test_invalid_policy_fails_before_fetch(make_poll, timeout, interval):
    def read():
        pytest.fail("invalid policy must not fetch")

    with pytest.raises(ValueError, match="finite and positive"):
        make_poll(Query("profile", read), timeout=timeout, interval=interval)


def test_reused_policy_grants_each_terminal_a_fresh_budget(polling_clock):
    observations = iter([(4, 2), (4, 2), (5, 2), (3, 2), (3, 2), (5, 2)])
    polling = expect.poll(Query("profile", lambda: next(observations)), timeout=0.25)

    assert polling.satisfies(check_pair) == (5, 2)
    assert polling.satisfies(check_pair) == (5, 2)
    assert polling_clock.monotonic() == pytest.approx(0.4)


def test_policy_is_reusable_after_timeout(polling_clock):
    observations = iter([(4, 2), (4, 2), (4, 2), (3, 2), (3, 2), (5, 2)])
    polling = expect.poll(Query("profile", lambda: next(observations)), timeout=0.25)

    with pytest.raises(AssertionError, match="no match after 3 attempts"):
        polling.satisfies(check_pair)
    assert polling.satisfies(check_pair) == (5, 2)
    assert polling_clock.monotonic() == pytest.approx(0.4)


def test_timeout_reports_label_attempts_elapsed_budget_and_final_cause(polling_clock):
    observations = iter([(5, 0), (4, 2), (3, 2)])

    with pytest.raises(AssertionError) as failure:
        expect.poll(Query("my_service.my_table", lambda: next(observations)), timeout=0.25).satisfies(check_pair)

    message = str(failure.value)
    assert "my_service.my_table" in message
    assert "3 attempts" in message
    assert "0.200s" in message
    assert "budget 0.25s" in message
    assert "rowCount: expected 5, got 3" in message
    assert "columnCount" not in message
    assert isinstance(failure.value.__cause__, AssertionError)
    assert "rowCount: expected 5, got 3" in str(failure.value.__cause__)


def test_timeout_bounds_final_mismatch_and_preserves_original_cause(polling_clock):
    mismatch = AssertionError("expected rows: " + "x" * 10000)

    def check(value):
        raise mismatch

    with pytest.raises(AssertionError) as failure:
        expect.poll(Query("profile", lambda: None), timeout=0.25).satisfies(check)

    assert len(str(failure.value)) < 2200
    assert "expected rows: " in str(failure.value)
    assert str(failure.value).endswith("...")
    assert failure.value.__cause__ is mismatch


def test_query_time_counts_toward_polling_budget(polling_clock):
    observations = iter([(4, 2), (5, 2)])

    def read():
        polling_clock.sleep(0.2)
        return next(observations)

    with pytest.raises(AssertionError, match=r"1 attempts.*0\.200s.*budget 0\.25s"):
        expect.poll(Query("profile", read), timeout=0.25).satisfies(check_pair)

    assert polling_clock.monotonic() == pytest.approx(0.2)


def test_transport_timeout_survives_a_read_exceeding_polling_budget(polling_clock):
    timeout = TimeoutError("SDK read timed out")

    def read():
        polling_clock.sleep(5)
        raise timeout

    with pytest.raises(TimeoutError) as failure:
        expect.poll(Query("profile", read), timeout=0.25).satisfies(check_pair)

    assert failure.value is timeout
    assert polling_clock.monotonic() == 5
