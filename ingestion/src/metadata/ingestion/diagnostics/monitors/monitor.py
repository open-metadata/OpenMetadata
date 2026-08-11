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
Monitor — runs a diagnostic check on a fixed interval.

Composition over inheritance: a Monitor *owns* a daemon thread rather than
being one, so the check logic (watchdog/heartbeat/time-accounting) stays a
plain object that can be unit-tested without any threading. The Monitor owns
the cadence, the stop signal, and the never-crash guard: a check that raises
is logged as `diag.<label>.error` and the loop continues, so diagnostics
never takes down the workflow it monitors.
"""

import logging
import threading
from collections.abc import Callable

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import emit_log


class Monitor:
    """Runs `check` every `interval` seconds in a daemon thread until stopped."""

    def __init__(self, name: str, interval: float, check: Callable[[], None]) -> None:
        self._interval = interval
        self._check = check
        self._label = name.removeprefix("diag-")
        self._stop_event = threading.Event()
        self._thread = threading.Thread(name=name, daemon=True, target=self._run)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def join(self, timeout: float | None = None) -> None:
        self._thread.join(timeout)

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def _run(self) -> None:
        while not self._stop_event.wait(self._interval):
            try:
                self._check()
            except Exception as exc:
                emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.{self._label}.error err={exc!r}")
