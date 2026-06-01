#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Meta-tests: verify retry_until and EventuallyRunner polling primitives behave correctly."""

from __future__ import annotations

import pytest

from ..core.fluent.eventually import EventuallyRunner, retry_until


def _attempt_counter():
    """Return an empty list; tests append to it on each check call and inspect its length."""
    return []


# --------------------------------------------------------------------------- #
# retry_until — the low-level primitive                                       #
# --------------------------------------------------------------------------- #


def test_retry_until_returns_value_on_first_success() -> None:
    attempts = _attempt_counter()

    def _check() -> str:
        attempts.append(None)
        return "ok"

    assert retry_until(_check, timeout=2, poll_interval=0.01, name="t") == "ok"
    assert len(attempts) == 1


def test_retry_until_retries_until_success() -> None:
    attempts = _attempt_counter()

    def _check() -> int:
        attempts.append(None)
        if len(attempts) < 3:
            raise AssertionError("not yet")
        return 42

    assert retry_until(_check, timeout=2, poll_interval=0.01, name="converge") == 42
    assert len(attempts) == 3


def test_retry_until_times_out_with_last_failure() -> None:
    def _check() -> None:
        raise AssertionError("specific failure text")

    with pytest.raises(AssertionError, match="specific failure text") as exc_info:
        retry_until(_check, timeout=0, poll_interval=0.01, name="never")

    msg = str(exc_info.value)
    assert "timed out" in msg
    assert "never" in msg


def test_retry_until_propagates_non_assertion_errors() -> None:
    def _check() -> None:
        raise RuntimeError("hard error")

    with pytest.raises(RuntimeError, match="hard error"):
        retry_until(_check, timeout=2, poll_interval=0.01, name="t")


# --------------------------------------------------------------------------- #
# EventuallyRunner — the per-assert dispatcher                                #
# --------------------------------------------------------------------------- #


def test_runner_unarmed_runs_sync() -> None:
    runner = EventuallyRunner()
    attempts = _attempt_counter()

    def _check() -> str:
        attempts.append(None)
        return "value"

    assert runner.run(_check, name="sync") == "value"
    assert len(attempts) == 1


def test_runner_unarmed_propagates_assertion_error_without_retry() -> None:
    runner = EventuallyRunner()
    attempts = _attempt_counter()

    def _check() -> None:
        attempts.append(None)
        raise AssertionError("immediate")

    with pytest.raises(AssertionError, match="immediate"):
        runner.run(_check, name="sync")
    assert len(attempts) == 1


def test_runner_armed_retries_until_success() -> None:
    runner = EventuallyRunner()
    runner.arm(timeout=2)
    attempts = _attempt_counter()

    def _check() -> str:
        attempts.append(None)
        if len(attempts) < 2:
            raise AssertionError("not yet")
        return "done"

    assert runner.run(_check, name="armed") == "done"
    assert len(attempts) == 2


def test_runner_arming_is_one_shot() -> None:
    """After one armed run succeeds, the next call is sync — the timeout is consumed, not sticky."""
    runner = EventuallyRunner()
    runner.arm(timeout=2)

    def _ok() -> str:
        return "ok"

    runner.run(_ok, name="first")  # consumes the arm

    attempts = _attempt_counter()

    def _fail_once() -> None:
        attempts.append(None)
        raise AssertionError("immediate")

    with pytest.raises(AssertionError, match="immediate"):
        runner.run(_fail_once, name="second")
    assert len(attempts) == 1, "second run should have been sync, not retried"
