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
"""Poll fresh observations, retrying only checker mismatches.

The polling budget cannot cancel synchronous reads; SDK transport timeouts still apply.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Generic, TypeVar

from tenacity import Retrying, retry_if_exception_type, wait_fixed

if TYPE_CHECKING:
    from collections.abc import Callable

T = TypeVar("T")
_MAX_MISMATCH_LENGTH = 2000


@dataclass(frozen=True)
class Query(Generic[T]):
    label: str
    read: Callable[[], T]


class _MismatchError(AssertionError):
    pass


@dataclass(frozen=True)
class Poll(Generic[T]):
    query: Query[T]
    timeout: float
    interval: float

    def __post_init__(self) -> None:
        if any(not math.isfinite(value) or value <= 0 for value in (self.timeout, self.interval)):
            raise ValueError("timeout and interval must be finite and positive")

    def satisfies(self, check: Callable[[T], None]) -> T:
        """Return the first observation satisfying the entire checker within a fresh budget."""
        attempts = 0
        started = time.monotonic()

        def evaluate() -> T:
            nonlocal attempts
            attempts += 1
            value = self.query.read()
            try:
                check(value)
            except AssertionError as error:
                raise _MismatchError(str(error)) from error
            return value

        retry = Retrying(
            retry=retry_if_exception_type(_MismatchError),
            stop=lambda retry_state: time.monotonic() - started + self.interval >= self.timeout,
            wait=wait_fixed(self.interval),
            sleep=time.sleep,
            reraise=True,
        )
        try:
            return retry(evaluate)
        except _MismatchError as error:
            elapsed = time.monotonic() - started
            mismatch = str(error)
            if len(mismatch) > _MAX_MISMATCH_LENGTH:
                mismatch = mismatch[: _MAX_MISMATCH_LENGTH - 3] + "..."
            raise AssertionError(
                f"{self.query.label}: no match after {attempts} attempts "
                f"in {elapsed:.3f}s (budget {self.timeout}s). Last mismatch: {mismatch}"
            ) from error.__cause__


def poll(query: Query[T], *, timeout: float = 30, interval: float = 0.1) -> Poll[T]:
    return Poll(query, timeout, interval)
