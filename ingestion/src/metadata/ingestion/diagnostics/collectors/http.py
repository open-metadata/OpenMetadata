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
import logging
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, TextIO

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import emit_log, get_handler


class HttpTracker:
    """In-memory registry of currently-in-flight HTTP requests (a Collector)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # (thread_id, request_id) -> (method, url, started_monotonic)
        self._active: dict[tuple[int, int], tuple[str, str, float]] = {}
        self._ids = itertools.count(1)

    @contextmanager
    def request(self, method: str, url: str) -> Iterator[None]:
        """Register an HTTP request for the duration of the `with`-block.

        Safe from the hot path: the `yield` runs even if registration fails.
        """
        key = self._safe_register(method, url)
        try:
            yield
        finally:
            self._safe_unregister(key)

    def _safe_register(self, method: str, url: str) -> tuple[int, int] | None:
        try:
            request_id = next(self._ids)
            tid = threading.get_ident()
            key = (tid, request_id)
            started = time.monotonic()
            with self._lock:
                self._active[key] = (str(method).upper(), str(url), started)
        except Exception as exc:
            _emit_seam_error("http.request.register", exc)
            return None
        else:
            return key

    def _safe_unregister(self, key: tuple[int, int] | None) -> None:
        if key is None:
            return
        try:
            with self._lock:
                self._active.pop(key, None)
        except Exception as exc:
            _emit_seam_error("http.request.unregister", exc)

    def snapshot(self) -> list[tuple[int, str, str, float]]:
        """List of `(thread_id, method, url, age_seconds)` for all active requests."""
        now = time.monotonic()
        with self._lock:
            return [(tid, method, url, now - started) for (tid, _rid), (method, url, started) in self._active.items()]

    def active_count(self) -> int:
        with self._lock:
            return len(self._active)

    def render_instant(self) -> str:
        return f" active_http={self.active_count()}"

    def render_dump(self, out: TextIO) -> None:
        out.write(f"{DIAG_LOG_PREFIX}.dump.http\n")
        active = self.snapshot()
        if not active:
            out.write("  (no in-flight requests)\n")
            return
        name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
        for tid, method, url, age in sorted(active, key=lambda r: -r[3]):
            thread_name = name_by_ident.get(tid, f"tid-{tid}")
            out.write(f"  thread={thread_name} method={method} url={url} age={age:.1f}s\n")


def get_global_tracker() -> Any:
    """Return the diagnostics tracker if installed, else None.

    The OMetaClient calls this on every request, so the cost when
    diagnostics is off is a single attribute read.
    """
    handler = get_handler()
    if handler is None:
        return None
    try:
        return handler.aspect(HttpTracker)
    except KeyError:
        return None


def _emit_seam_error(seam: str, exc: BaseException) -> None:
    """Audit log for seam-side defensive wraps."""
    emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.{seam}.error err={exc!r}")
