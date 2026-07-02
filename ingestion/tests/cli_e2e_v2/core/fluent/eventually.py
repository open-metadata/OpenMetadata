#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Polling primitives for fluent assertion chains.

`retry_until` is the low-level deadline-based retry. `EventuallyRunner` is
a one-shot arming wrapper that dispatches terminal checks either
synchronously or via `retry_until`.

Logging levels:
  - DEBUG   first-attempt failure
  - INFO    every attempt when E2E_POLL_VERBOSE=1
  - ERROR   final timeout
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_POLL_INTERVAL_SECONDS = 2.0

T = TypeVar("T")


def _verbose_polling() -> bool:
    return os.environ.get("E2E_POLL_VERBOSE", "").lower() in ("1", "true", "yes")


def retry_until(
    check: Callable[[], T],
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    poll_interval: float = DEFAULT_POLL_INTERVAL_SECONDS,
    name: str = "check",
) -> T:
    """Retry `check` until it returns without raising AssertionError.

    AssertionError signals "not ready yet"; any other exception propagates
    immediately. Returns the first successful check's return value.
    """
    start = time.monotonic()
    deadline = start + timeout
    attempts = 0
    verbose = _verbose_polling()

    while True:
        attempts += 1
        try:
            return check()
        except AssertionError as exc:
            if attempts == 1:
                logger.debug(
                    "[eventually:%s] attempt %d failed: %s (retrying for up to %ds)",
                    name,
                    attempts,
                    exc,
                    timeout,
                )
            if verbose:
                elapsed = time.monotonic() - start
                logger.info(
                    "[eventually:%s] attempt %d failed at %.1fs: %s",
                    name,
                    attempts,
                    elapsed,
                    exc,
                )
            if time.monotonic() >= deadline:
                elapsed = time.monotonic() - start
                logger.error(
                    "[eventually:%s] gave up after %d attempts in %.1fs: %s",
                    name,
                    attempts,
                    elapsed,
                    exc,
                )
                raise AssertionError(
                    f"eventually[{name}] timed out after {attempts} attempts "
                    f"over {elapsed:.1f}s (timeout={timeout}s, "
                    f"poll_interval={poll_interval}s).\n"
                    f"Last failure:\n{exc}"
                ) from exc
            time.sleep(poll_interval)


@dataclass
class EventuallyRunner:
    """One-shot arming dispatcher: arm() queues polling for the NEXT terminal; run() consumes it and reverts to sync."""

    _timeout: int | None = None

    def arm(self, timeout: int) -> None:
        self._timeout = timeout

    def run(self, check: Callable[[], T], *, name: str) -> T:
        if self._timeout is not None:
            timeout = self._timeout
            self._timeout = None
            return retry_until(check, timeout=timeout, name=name)
        return check()
