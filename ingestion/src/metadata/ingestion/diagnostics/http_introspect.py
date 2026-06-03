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
Track in-flight HTTP requests so a dump shows exactly which call is hung.
"""

import itertools
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any


class HttpTracker:
    """In-memory registry of currently-in-flight HTTP requests."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # (thread_id, request_id) -> (method, url, started_monotonic)
        self._active: dict[tuple[int, int], tuple[str, str, float]] = {}
        self._ids = itertools.count(1)

    @contextmanager
    def request(self, method: str, url: str) -> Iterator[None]:
        """Register an HTTP request for the duration of the with-block."""
        request_id = next(self._ids)
        tid = threading.get_ident()
        key = (tid, request_id)
        started = time.monotonic()
        with self._lock:
            self._active[key] = (str(method).upper(), str(url), started)
        try:
            yield
        finally:
            with self._lock:
                self._active.pop(key, None)

    def snapshot(self) -> list[tuple[int, str, str, float]]:
        """List of `(thread_id, method, url, age_seconds)` for all active requests."""
        now = time.monotonic()
        with self._lock:
            return [(tid, method, url, now - started) for (tid, _rid), (method, url, started) in self._active.items()]

    def active_count(self) -> int:
        with self._lock:
            return len(self._active)


def get_global_tracker() -> Any:
    """Return the diagnostics tracker if installed, else None.

    The OMetaClient calls this on every request, so the cost when
    diagnostics is off is a single attribute read.
    """
    from metadata.ingestion.diagnostics import _get_state  # noqa: PLC0415  avoid circular import

    state = _get_state()
    return state.http_tracker if state is not None else None
