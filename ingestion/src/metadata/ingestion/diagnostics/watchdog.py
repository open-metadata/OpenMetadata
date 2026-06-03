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
    PRESSURE_DUMP_THROTTLE_SECONDS,
    PRESSURE_PSI_AVG10_THRESHOLD,
    REDUMP_THROTTLE_SECONDS,
    STUCK_WARN_SECONDS,
    WATCHDOG_TICK_SECONDS,
    emit_log,
)
from metadata.ingestion.diagnostics.memory import MemorySample
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
        # reason -> monotonic timestamp of last pressure-triggered dump.
        # Reasons live in their own throttle map so a PSI trip and a
        # cgroup-events.high trip can each fire once per window.
        self._last_pressure_dumped: dict[str, float] = {}
        # Last seen cgroup `memory.events.high` counter — used to detect
        # deltas (the kernel monotonically increments it on throttling).
        self._last_events_high: int | None = None
        self._last_events_oom: int | None = None

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

        # Pre-OOM tripwire — read pressure signals on the same tick.
        self._check_pressure_tripwires(now)

    def _check_pressure_tripwires(self, now: float) -> None:
        """Sample memory pressure and dump if any tripwire fires.

        Three signals (in order of reliability):
          1. PSI `some avg10` > threshold — kernel reports the cgroup
             stalled on memory for >N% of the last 10 seconds.
          2. cgroup `memory.events.high` counter incremented since
             the previous tick — kernel started throttling the cgroup
             for crossing the `memory.high` soft limit.
          3. cgroup `memory.events.oom` counter incremented — kernel
             attempted an OOM resolution inside the cgroup.

        Each signal has its own throttle so a sustained pressure event
        doesn't loop on dumps.
        """
        try:
            sample = self._memory_tracker.sample()
        except Exception as exc:
            emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.watchdog.sample_error err={exc!r}")
            return

        self._check_psi_tripwire(sample, now)
        self._check_events_high_tripwire(sample, now)
        self._check_events_oom_tripwire(sample, now)

    def _check_psi_tripwire(self, sample: MemorySample, now: float) -> None:
        psi = sample.psi_some_avg10
        if psi is None or psi < PRESSURE_PSI_AVG10_THRESHOLD:
            return
        if not self._should_fire_pressure("psi", now):
            return
        self._fire_pressure_dump(
            reason=f"memory-pressure-psi:avg10={psi:.1f}",
            sample=sample,
            now=now,
            throttle_key="psi",
        )

    def _check_events_high_tripwire(self, sample: MemorySample, now: float) -> None:
        current = sample.cgroup_events_high
        if current is None:
            return
        previous = self._last_events_high
        self._last_events_high = current
        if previous is None or current <= previous:
            return
        if not self._should_fire_pressure("events.high", now):
            return
        self._fire_pressure_dump(
            reason=f"memory-pressure-cgroup-high:delta={current - previous}",
            sample=sample,
            now=now,
            throttle_key="events.high",
        )

    def _check_events_oom_tripwire(self, sample: MemorySample, now: float) -> None:
        current = sample.cgroup_events_oom
        if current is None:
            return
        previous = self._last_events_oom
        self._last_events_oom = current
        if previous is None or current <= previous:
            return
        if not self._should_fire_pressure("events.oom", now):
            return
        self._fire_pressure_dump(
            reason=f"memory-pressure-cgroup-oom:delta={current - previous}",
            sample=sample,
            now=now,
            throttle_key="events.oom",
        )

    def _should_fire_pressure(self, key: str, now: float) -> bool:
        previous = self._last_pressure_dumped.get(key)
        return previous is None or (now - previous) >= PRESSURE_DUMP_THROTTLE_SECONDS

    def _fire_pressure_dump(self, reason: str, sample: MemorySample, now: float, throttle_key: str) -> None:
        self._last_pressure_dumped[throttle_key] = now
        emit_log(
            logging.WARNING,
            f"{DIAG_LOG_PREFIX}.warn.memory_pressure reason={reason} "
            f"rss={sample.rss} cgroup_current={sample.cgroup_current} "
            f"cgroup_max={sample.cgroup_max} psi_avg10={sample.psi_some_avg10}",
        )
        emit_full_dump(
            reason=reason,
            registry=self._registry,
            http_tracker=self._http_tracker,
            memory_tracker=self._memory_tracker,
            workflow=self._workflow,
        )

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
