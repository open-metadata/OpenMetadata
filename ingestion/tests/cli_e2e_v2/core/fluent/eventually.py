#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Polling helper for fluent assertion chains.

Replaces v1's time.sleep-in-a-while-loop polling with a single deadline-based
retry on AssertionError. Used by LineageAssert.eventually(), ProfileAssert.eventually(),
and similar fluent namespaces added in Task 14.

Logging contract:
  - first attempt failure → DEBUG (low noise when tests flakily need one retry)
  - final failure         → ERROR with attempt count + elapsed time
  - middle attempts       → silent

Usage:
    retry_until(lambda: assert_something(), timeout=60, name="has_upstream")
"""

from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

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
    """Retry `check` until it returns without raising AssertionError, or timeout elapses.

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
