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
The diagnostics composition root and reporting orchestrator.

Holds the `aspects` bag and exposes three reporting occasions:

  * ``emit_heartbeat()``  — fans ``render_instant()`` over `HasInstant` aspects.
  * ``emit_dump(reason)`` — fans ``render_dump()`` over `HasDump` aspects.
  * ``emit_summary()``    — fans ``render_summary()`` over `HasSummary` aspects.

Typed access to a specific aspect goes through ``aspect(cls)``.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import suppress
from typing import Any, TypeVar

from metadata.ingestion.diagnostics.collectors.http import HttpTracker
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.collectors.stage_progress import StageProgressCollector
from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX, DiagnosticsConfig
from metadata.ingestion.diagnostics.kernel import emit_log
from metadata.ingestion.diagnostics.monitors.monitor import Monitor
from metadata.ingestion.diagnostics.monitors.watchdog import Watchdog
from metadata.ingestion.diagnostics.protocols import HasDump, HasInstant, HasSummary
from metadata.ingestion.diagnostics.reporting.dump import emit_full_dump, emit_incremental_dump
from metadata.ingestion.diagnostics.reporting.summary import emit_report
from metadata.ingestion.diagnostics.samplers.memory import MemoryTracker
from metadata.ingestion.diagnostics.samplers.time_accounting import TimeAccountingSampler
from metadata.ingestion.diagnostics.seams.db_introspect import DbIntrospector
from metadata.ingestion.diagnostics.signals import install_signal_handlers

T = TypeVar("T")


class DiagnosticsHandler:
    """Composition root + reporting orchestrator for the diagnostics subsystem."""

    def __init__(
        self,
        *,
        config: DiagnosticsConfig,
        aspects: list[Any],
        watchdog: Watchdog,
        db_introspector: DbIntrospector | None,
        workflow: Any,
    ) -> None:
        self.config = config
        self.workflow = workflow
        self._watchdog = watchdog
        self._db_introspector = db_introspector
        self._monitors: list[Monitor] = []
        self._ticks = 0
        self.signals_installed = False

        self.aspects: list[Any] = list(aspects)
        self.heartbeat_fields: list[HasInstant] = [a for a in self.aspects if isinstance(a, HasInstant)]
        self.dump_sections: list[HasDump] = [a for a in self.aspects if isinstance(a, HasDump)]
        self.summary_lines: list[HasSummary] = [a for a in self.aspects if isinstance(a, HasSummary)]
        self._by_type: dict[type, Any] = {type(a): a for a in self.aspects}

    def aspect(self, cls: type[T]) -> T:
        """Typed lookup into the aspects bag. Raises KeyError if absent."""
        return self._by_type[cls]

    @classmethod
    def build(cls, workflow: Any) -> DiagnosticsHandler:
        config = DiagnosticsConfig()
        registry = OperationRegistry()
        http_tracker = HttpTracker()
        memory = MemoryTracker()
        time_sampler = TimeAccountingSampler(registry)
        stage = StageProgressCollector()

        db_introspector = DbIntrospector(registry)
        db_introspector.install()
        watchdog = Watchdog(registry, memory, config)

        handler = cls(
            config=config,
            aspects=[registry, http_tracker, memory, time_sampler, stage],
            watchdog=watchdog,
            db_introspector=db_introspector,
            workflow=workflow,
        )
        handler.signals_installed = install_signal_handlers(handler)
        handler._monitors = [
            Monitor("diag-time-accounting", config.time_accounting_interval_seconds, time_sampler.tick),
            Monitor("diag-watchdog", config.watchdog_tick_seconds, handler.run_watchdog),
            Monitor("diag-heartbeat", config.heartbeat_interval_seconds, handler.emit_heartbeat),
        ]
        return handler

    def start(self) -> None:
        for monitor in self._monitors:
            monitor.start()

    def stop(self) -> None:
        for monitor in self._monitors:
            with suppress(Exception):
                monitor.stop()
        if self._db_introspector is not None:
            with suppress(Exception):
                self._db_introspector.uninstall()

    def emit_summary(self) -> None:
        """End-of-run: fan `render_summary()` over the summary participants."""
        with suppress(Exception):
            emit_report(self.summary_lines)

    def emit_dump(self, reason: str, signal_safe: bool = False) -> None:
        """On-demand full dump: threads + each section's `render_dump` + workflow."""
        emit_full_dump(reason, self.dump_sections, self.workflow, signal_safe=signal_safe)

    def emit_incremental_dump(self, signal_safe: bool = False) -> None:
        """On-demand incremental dump (no thread tracebacks)."""
        emit_incremental_dump(self.dump_sections, signal_safe=signal_safe)

    def emit_heartbeat(self) -> None:
        """One progress line: fixed prefix + each heartbeat field's instant value.

        Drives memory sampling first (so its instant reflects this tick), then
        fans `render_instant()` over the heartbeat participants.
        """
        self._ticks += 1
        memory = self.aspect(MemoryTracker)
        sample = memory.sample()
        memory.note_sample(sample, self._main_op_name())
        instants = "".join(field.render_instant() for field in self.heartbeat_fields)
        emit_log(
            logging.INFO,
            f"{DIAG_LOG_PREFIX}.heartbeat "
            f"tick={self._ticks} "
            f"pid={os.getpid()} "
            f"threads={threading.active_count()}"
            f"{instants}"
            f"{self._format_steps()}",
        )

    def run_watchdog(self) -> None:
        """Drive the detector, log each verdict, dump when a verdict carries a reason."""
        for verdict in self._watchdog.check(time.monotonic()):
            emit_log(verdict.severity, verdict.message)
            if verdict.dump_reason is not None:
                self.emit_dump(verdict.dump_reason)

    def _main_op_name(self) -> str:
        main_ident = threading.main_thread().ident
        registry = self.aspect(OperationRegistry)
        deepest = registry.deepest_per_thread().get(main_ident) if main_ident is not None else None
        return deepest[0] if deepest else ""

    def _format_steps(self) -> str:
        if self.workflow is None:
            return ""
        try:
            steps = self.workflow.workflow_steps()
        except Exception:
            return ""
        parts = []
        for step in steps or []:
            with suppress(Exception):
                status = step.get_status()
                rec = getattr(status, "record_count", None)
                if not rec:
                    records = getattr(status, "records", None)
                    rec = len(records) if records is not None else 0
                failures = len(getattr(status, "failures", []) or [])
                parts.append(f"{step.name}={rec}/{failures}err")
        return " steps=[" + ",".join(parts) + "]" if parts else ""
