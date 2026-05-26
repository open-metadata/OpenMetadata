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
"""Composition root for the diagnostics subsystem.

`DiagnosticsContext.build(workflow)` is the single place that wires the
collectors, seams, monitors and reporters together. The package facade's
`install()` / `shutdown()` delegate to `build()` + `start()` and `stop()`,
so reading `build()` is reading the whole dependency graph.
"""

from __future__ import annotations

from contextlib import suppress
from dataclasses import dataclass
from typing import Any


@dataclass
class DiagnosticsContext:
    registry: Any
    http_tracker: Any
    memory_tracker: Any
    db_introspector: Any
    time_sampler: Any
    monitors: list[Any]
    reporters: list[Any]
    signals_installed: bool

    @classmethod
    def build(cls, workflow: Any) -> DiagnosticsContext:
        from metadata.ingestion.diagnostics.collectors import stage_progress  # noqa: PLC0415
        from metadata.ingestion.diagnostics.collectors.http import HttpTracker  # noqa: PLC0415
        from metadata.ingestion.diagnostics.collectors.memory import MemoryTracker  # noqa: PLC0415
        from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry  # noqa: PLC0415
        from metadata.ingestion.diagnostics.config import DiagnosticsConfig  # noqa: PLC0415
        from metadata.ingestion.diagnostics.monitors.heartbeat import Heartbeat  # noqa: PLC0415
        from metadata.ingestion.diagnostics.monitors.monitor import Monitor  # noqa: PLC0415
        from metadata.ingestion.diagnostics.monitors.time_accounting import TimeAccountingSampler  # noqa: PLC0415
        from metadata.ingestion.diagnostics.monitors.watchdog import Watchdog  # noqa: PLC0415
        from metadata.ingestion.diagnostics.seams.db_introspect import DbIntrospector  # noqa: PLC0415
        from metadata.ingestion.diagnostics.signals import install_signal_handlers  # noqa: PLC0415

        config = DiagnosticsConfig()
        registry = OperationRegistry()
        http_tracker = HttpTracker()
        memory_tracker = MemoryTracker()
        stage_collector = stage_progress.StageProgressCollector()
        stage_progress.install(stage_collector)
        db_introspector = DbIntrospector(registry)
        db_introspector.install()
        time_sampler = TimeAccountingSampler(registry)

        signals_installed = install_signal_handlers(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            workflow=workflow,
        )

        monitors = [
            Monitor("diag-time-accounting", config.time_accounting_interval_seconds, time_sampler.tick),
            Monitor(
                "diag-watchdog",
                config.watchdog_tick_seconds,
                Watchdog(registry, http_tracker, memory_tracker, workflow, config).tick,
            ),
            Monitor(
                "diag-heartbeat",
                config.heartbeat_interval_seconds,
                Heartbeat(registry, http_tracker, memory_tracker, workflow).tick,
            ),
        ]
        return cls(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            db_introspector=db_introspector,
            time_sampler=time_sampler,
            monitors=monitors,
            reporters=[time_sampler, registry, memory_tracker, stage_collector],
            signals_installed=signals_installed,
        )

    def start(self) -> None:
        for monitor in self.monitors:
            monitor.start()

    def stop(self) -> None:
        from metadata.ingestion.diagnostics.collectors import stage_progress  # noqa: PLC0415
        from metadata.ingestion.diagnostics.reporting.summary import emit_report  # noqa: PLC0415

        with suppress(Exception):
            emit_report(self.reporters)
        for monitor in self.monitors:
            with suppress(Exception):
                monitor.stop()
        with suppress(Exception):
            self.db_introspector.uninstall()
        with suppress(Exception):
            stage_progress.uninstall()
