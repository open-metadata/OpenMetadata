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
Watchdog — a pure detector. `check(now)` returns Verdicts; the caller logs and
dumps. No I/O is performed inside the detector.

Tripwires:
  * Hang: a thread on the same op for >stuck_warn_seconds (warn) or
    >auto_dump_seconds (warn + dump_reason).
  * Memory pressure: PSI avg10 over threshold; cgroup `memory.events.high`
    or `.events.oom` incremented since the previous tick.
"""

import logging
import threading
from dataclasses import dataclass

from metadata.ingestion.diagnostics.collectors.operation_registry import (
    OperationRegistry,
    format_op_frame,
)
from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX, DiagnosticsConfig
from metadata.ingestion.diagnostics.samplers.memory import MemorySample, MemoryTracker


@dataclass(frozen=True)
class Verdict:
    """One line to log at `severity`. When `dump_reason` is set, also fire a dump."""

    severity: int
    message: str
    dump_reason: str | None = None


class Watchdog:
    """Detects hangs and memory pressure. Pure: reads inputs, returns Verdicts."""

    def __init__(
        self,
        registry: OperationRegistry,
        memory: MemoryTracker,
        config: DiagnosticsConfig,
    ) -> None:
        self._registry = registry
        self._memory_tracker = memory
        self._config = config
        self._last_warned: dict[tuple[int, str], float] = {}
        self._last_dumped: dict[tuple[int, str], float] = {}
        self._last_pressure_dumped: dict[str, float] = {}
        self._last_events_high: int | None = None
        self._last_events_oom: int | None = None

    def check(self, now: float) -> list[Verdict]:
        """Read inputs, apply thresholds + throttles, return verdicts (0..N)."""
        verdicts: list[Verdict] = []
        verdicts.extend(self._check_hangs(now))
        verdicts.extend(self._check_pressure(now))
        return verdicts

    def _check_hangs(self, now: float) -> list[Verdict]:
        threads = threading.enumerate()
        alive_idents = {t.ident for t in threads if t.ident is not None}
        self._registry.gc_dead_threads(alive_idents)
        name_by_ident = {t.ident: t.name for t in threads if t.ident}
        verdicts: list[Verdict] = []
        for tid, (op_name, kwargs, age) in self._registry.deepest_per_thread().items():
            verdict = self._judge_thread(tid, op_name, kwargs, age, name_by_ident, now)
            if verdict is not None:
                verdicts.append(verdict)
        return verdicts

    def _judge_thread(
        self,
        tid: int,
        op_name: str,
        kwargs: dict,
        age: float,
        name_by_ident: dict[int, str],
        now: float,
    ) -> Verdict | None:
        if age < self._config.stuck_warn_seconds:
            return None
        key = (tid, op_name)
        thread_name = name_by_ident.get(tid, f"tid-{tid}")
        if age >= self._config.auto_dump_seconds and self._should_fire(self._last_dumped, key, now):
            self._last_dumped[key] = now
            self._last_warned[key] = now
            return self._auto_dump_verdict(thread_name, op_name, age)
        if self._should_fire(self._last_warned, key, now):
            self._last_warned[key] = now
            return self._stuck_verdict(thread_name, op_name, kwargs, age)
        return None

    def _stuck_verdict(self, thread_name: str, op_name: str, kwargs: dict, age: float) -> Verdict:
        frame = format_op_frame(op_name, kwargs, age)
        return Verdict(
            logging.WARNING,
            f"{DIAG_LOG_PREFIX}.warn.stuck thread={thread_name} op={op_name} duration={age:.0f}s frame={frame}",
        )

    def _auto_dump_verdict(self, thread_name: str, op_name: str, age: float) -> Verdict:
        return Verdict(
            logging.WARNING,
            f"{DIAG_LOG_PREFIX}.watchdog.auto_dump thread={thread_name} op={op_name} duration={age:.0f}s",
            dump_reason=f"watchdog:{op_name}@{thread_name}:{age:.0f}s",
        )

    def _check_pressure(self, now: float) -> list[Verdict]:
        try:
            sample = self._memory_tracker.sample()
        except Exception as exc:
            return [Verdict(logging.WARNING, f"{DIAG_LOG_PREFIX}.watchdog.sample_error err={exc!r}")]
        return [
            verdict
            for verdict in (
                self._psi_verdict(sample, now),
                self._events_high_verdict(sample, now),
                self._events_oom_verdict(sample, now),
            )
            if verdict is not None
        ]

    def _psi_verdict(self, sample: MemorySample, now: float) -> Verdict | None:
        psi = sample.psi_some_avg10
        if psi is None or psi < self._config.pressure_psi_avg10_threshold:
            return None
        if not self._should_fire_pressure("psi", now):
            return None
        self._last_pressure_dumped["psi"] = now
        return self._pressure_verdict(f"memory-pressure-psi:avg10={psi:.1f}", sample)

    def _events_high_verdict(self, sample: MemorySample, now: float) -> Verdict | None:
        current = sample.cgroup_events_high
        if current is None:
            return None
        previous = self._last_events_high
        self._last_events_high = current
        if previous is None or current <= previous:
            return None
        if not self._should_fire_pressure("events.high", now):
            return None
        self._last_pressure_dumped["events.high"] = now
        return self._pressure_verdict(f"memory-pressure-cgroup-high:delta={current - previous}", sample)

    def _events_oom_verdict(self, sample: MemorySample, now: float) -> Verdict | None:
        current = sample.cgroup_events_oom
        if current is None:
            return None
        previous = self._last_events_oom
        self._last_events_oom = current
        if previous is None or current <= previous:
            return None
        if not self._should_fire_pressure("events.oom", now):
            return None
        self._last_pressure_dumped["events.oom"] = now
        return self._pressure_verdict(f"memory-pressure-cgroup-oom:delta={current - previous}", sample)

    def _pressure_verdict(self, reason: str, sample: MemorySample) -> Verdict:
        message = (
            f"{DIAG_LOG_PREFIX}.warn.memory_pressure reason={reason} "
            f"rss={sample.rss} cgroup_current={sample.cgroup_current} "
            f"cgroup_max={sample.cgroup_max} psi_avg10={sample.psi_some_avg10}"
        )
        return Verdict(logging.WARNING, message, dump_reason=reason)

    def _should_fire(self, last_map: dict[tuple[int, str], float], key: tuple[int, str], now: float) -> bool:
        previous = last_map.get(key)
        return previous is None or (now - previous) >= self._config.redump_throttle_seconds

    def _should_fire_pressure(self, key: str, now: float) -> bool:
        previous = self._last_pressure_dumped.get(key)
        return previous is None or (now - previous) >= self._config.pressure_dump_throttle_seconds
