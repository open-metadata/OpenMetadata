#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Polling helpers for fluent assertion chains.

Two pieces:

  retry_until(check, timeout, poll_interval, name) -> T
      Low-level polling. Calls `check()` until it returns without raising
      AssertionError, or the timeout elapses.

  EventuallyRunner
      Small collaborator held by each fluent assert class. Arming it via
      `.arm(timeout)` from the public `.eventually()` method makes the next
      terminal check poll via `retry_until`. One-shot: first `.run()` after
      arming consumes the timeout. Encapsulates the arm/consume/fallback
      state in a single object so each assert class carries only one line
      of state and one line of dispatch.

Logging contract:
  - first attempt failure → DEBUG (low noise when tests flakily need one retry)
  - final failure         → ERROR with attempt count + elapsed time
  - middle attempts       → silent
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_POLL_INTERVAL_SECONDS = 2.0

T = TypeVar("T")


def retry_until(
    check: Callable[[], T],
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    poll_interval: float = DEFAULT_POLL_INTERVAL_SECONDS,
    name: str = "check",
) -> T:
    """Retry `check` until it returns without raising AssertionError.

    Args:
        check: zero-argument callable. Should raise AssertionError to signal
            "not ready yet"; any other exception propagates immediately.
        timeout: maximum total wait in seconds (default 60).
        poll_interval: seconds to sleep between failed attempts (default 2).
        name: label used in log messages to identify the retry site.

    Returns:
        The return value of the first successful `check()` call.

    Raises:
        AssertionError: the final attempt's error, after timeout elapses.
    """
    start = time.monotonic()
    deadline = start + timeout
    attempts = 0

    while True:
        attempts += 1
        try:
            return check()
        except AssertionError as exc:
            if attempts == 1:
                logger.debug(
                    "[eventually:%s] attempt %d failed: %s (retrying for up to %ds)",
                    name, attempts, exc, timeout,
                )
            if time.monotonic() >= deadline:
                elapsed = time.monotonic() - start
                logger.error(
                    "[eventually:%s] gave up after %d attempts in %.1fs: %s",
                    name, attempts, elapsed, exc,
                )
                raise
            time.sleep(poll_interval)


@dataclass
class EventuallyRunner:
    """Per-fluent-chain dispatcher that runs terminal checks sync or polled.

    Each assert class (TableAssert, LineageAssert, ProfileAssert, ...) holds
    one of these. Calling `.arm(timeout)` from the class's `.eventually()`
    method makes the NEXT `.run(check, name=...)` go through `retry_until`;
    any further calls revert to synchronous until re-armed. The one-shot
    reset keeps the existing eventually semantics intact while eliminating
    the five copies of `_apply_maybe_eventually` across fluent modules.

    Replacement for the old per-class `_apply_maybe_eventually` pattern.
    When sticky-`eventually` semantics are wanted (Bucket D), add a `sticky`
    flag to `arm()`/`run()` in one place rather than patching five classes.
    """

    _timeout: int | None = None

    def arm(self, timeout: int) -> None:
        """Queue polling for the next terminal check."""
        self._timeout = timeout

    def run(self, check: Callable[[], Any], *, name: str) -> None:
        """Dispatch a terminal check.

        If armed, polls via `retry_until` and disarms. Otherwise calls `check`
        directly and lets AssertionError propagate on the first attempt.
        """
        if self._timeout is not None:
            timeout = self._timeout
            self._timeout = None
            retry_until(check, timeout=timeout, name=name)
        else:
            check()
