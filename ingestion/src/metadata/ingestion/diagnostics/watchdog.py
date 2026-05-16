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
Watchdog daemon thread.

Every WATCHDOG_TICK_SECONDS:
  - Look at the deepest active operation for each thread.
  - If a thread has been on the same op for > STUCK_WARN_SECONDS:
      emit `diag.warn.stuck` (once per (thread, op) per REDUMP_THROTTLE_SECONDS).
  - If a thread has been on the same op for > AUTO_DUMP_SECONDS:
      trigger a full dump (once per (thread, op) per REDUMP_THROTTLE_SECONDS).

This is the component that makes hung processes self-diagnose. No human
needs to be watching the pod for the data to be captured.
"""

import logging
import threading
import time
from typing import Any

from metadata.ingestion.diagnostics import (
    AUTO_DUMP_SECONDS,
    DIAG_LOG_PREFIX,
    REDUMP_THROTTLE_SECONDS,
    STUCK_WARN_SECONDS,
    WATCHDOG_TICK_SECONDS,
    emit_log,
)
from metadata.ingestion.diagnostics.registry import OperationRegistry, format_op_frame
from metadata.ingestion.diagnostics.signals import emit_full_dump


class WatchdogThread(threading.Thread):
    """Background thread that auto-warns and auto-dumps on hangs."""

    def __init__(
        self,
        registry: OperationRegistry,
        http_tracker: Any,
        memory_tracker: Any,
        workflow: Any,
    ) -> None:
        super().__init__(name="diag-watchdog", daemon=True)
        self._registry = registry
        self._http_tracker = http_tracker
        self._memory_tracker = memory_tracker
        self._workflow = workflow
        self._stop_event = threading.Event()
        # (thread_id, op_name) -> monotonic timestamp of last action
        self._last_warned: dict[tuple[int, str], float] = {}
        self._last_dumped: dict[tuple[int, str], float] = {}

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(WATCHDOG_TICK_SECONDS):
            try:
                self._tick()
            except Exception as exc:
                emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.watchdog.error err={exc!r}")

    def _tick(self) -> None:
        alive_idents = {t.ident for t in threading.enumerate() if t.ident is not None}
        self._registry.gc_dead_threads(alive_idents)
        name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
        now = time.monotonic()

        for tid, (op_name, kwargs, age) in self._registry.deepest_per_thread().items():
            if age < STUCK_WARN_SECONDS:
                continue

            key = (tid, op_name)
            thread_name = name_by_ident.get(tid, f"tid-{tid}")

            if age >= AUTO_DUMP_SECONDS and self._should_fire(self._last_dumped, key, now):
                self._last_dumped[key] = now
                # A dump implies a warn — track the warn timestamp too so
                # we don't double-log.
                self._last_warned[key] = now
                self._emit_auto_dump(thread_name, op_name, kwargs, age)
                continue

            if self._should_fire(self._last_warned, key, now):
                self._last_warned[key] = now
                self._emit_stuck_warn(thread_name, op_name, kwargs, age)

    @staticmethod
    def _should_fire(last_map: dict[tuple[int, str], float], key: tuple[int, str], now: float) -> bool:
        previous = last_map.get(key)
        return previous is None or (now - previous) >= REDUMP_THROTTLE_SECONDS

    def _emit_stuck_warn(self, thread_name: str, op_name: str, kwargs: dict, age: float) -> None:
        frame = format_op_frame(op_name, kwargs, age)
        emit_log(
            logging.WARNING,
            f"{DIAG_LOG_PREFIX}.warn.stuck thread={thread_name} op={op_name} duration={age:.0f}s frame={frame}",
        )

    def _emit_auto_dump(self, thread_name: str, op_name: str, kwargs: dict, age: float) -> None:
        emit_log(
            logging.WARNING,
            f"{DIAG_LOG_PREFIX}.watchdog.auto_dump thread={thread_name} op={op_name} duration={age:.0f}s",
        )
        emit_full_dump(
            reason=f"watchdog:{op_name}@{thread_name}:{age:.0f}s",
            registry=self._registry,
            http_tracker=self._http_tracker,
            memory_tracker=self._memory_tracker,
            workflow=self._workflow,
        )
