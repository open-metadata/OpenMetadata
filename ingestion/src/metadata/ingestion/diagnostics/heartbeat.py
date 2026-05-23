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
Heartbeat daemon thread.

Every HEARTBEAT_INTERVAL_SECONDS, emit one structured line to stderr:

  diag.heartbeat rss=412M rss_delta_30s=+2M threads=8 active_http=1 main_op=...

This line answers, on its own, in `kubectl logs`:
  - Is the process alive? (next heartbeat arrives)
  - Is it making progress? (compare counters across heartbeats)
  - Is memory growing? (rss_delta_30s)
  - What is the main thread doing right now? (main_op)
"""

import logging
import os
import threading
from typing import Any

from metadata.ingestion.diagnostics import (
    DIAG_LOG_PREFIX,
    HEARTBEAT_INTERVAL_SECONDS,
    emit_log,
)
from metadata.ingestion.diagnostics.memory import (
    MemoryTracker,
    format_bytes,
    format_signed_bytes,
)
from metadata.ingestion.diagnostics.registry import OperationRegistry
from metadata.ingestion.diagnostics.stage_progress import format_for_heartbeat


class HeartbeatThread(threading.Thread):
    """Background thread emitting one line per `HEARTBEAT_INTERVAL_SECONDS`."""

    def __init__(
        self,
        registry: OperationRegistry,
        http_tracker: Any,
        memory_tracker: MemoryTracker,
        workflow: Any,
    ) -> None:
        super().__init__(name="diag-heartbeat", daemon=True)
        self._registry = registry
        self._http_tracker = http_tracker
        self._memory_tracker = memory_tracker
        self._workflow = workflow
        self._stop_event = threading.Event()
        self._ticks = 0

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(HEARTBEAT_INTERVAL_SECONDS):
            try:
                self._emit()
            except Exception as exc:
                emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.heartbeat.error err={exc!r}")

    def _emit(self) -> None:
        self._ticks += 1
        sample = self._memory_tracker.sample()
        delta_30s = self._memory_tracker.rss_delta_bytes_since(30.0)
        main_op = self._format_main_op()
        steps_summary = self._format_steps()
        stage_queues = format_for_heartbeat()

        emit_log(
            logging.INFO,
            f"{DIAG_LOG_PREFIX}.heartbeat "
            f"tick={self._ticks} "
            f"pid={os.getpid()} "
            f"threads={threading.active_count()} "
            f"rss={format_bytes(sample.rss)} "
            f"rss_delta_30s={format_signed_bytes(delta_30s)} "
            f"cgroup={format_bytes(sample.cgroup_current)}/{format_bytes(sample.cgroup_max)} "
            f"oom_kills={sample.oom_kill_count if sample.oom_kill_count is not None else '?'} "
            f"active_http={self._http_tracker.active_count()} "
            f"main_op={main_op}"
            f"{steps_summary}"
            f"{stage_queues}",
        )

    def _format_main_op(self) -> str:
        """Render the main-thread's deepest op as `name(age)` or `-`."""
        main_ident = threading.main_thread().ident
        if main_ident is None:
            return "-"
        deepest = self._registry.deepest_per_thread().get(main_ident)
        if not deepest:
            return "-"
        op_name, _kwargs, age = deepest
        return f"{op_name}({_fmt_age(age)})"

    def _format_steps(self) -> str:
        if self._workflow is None:
            return ""
        try:
            steps = self._workflow.workflow_steps()
        except Exception:
            return ""
        if not steps:
            return ""
        parts = []
        for step in steps:
            try:
                status = step.get_status()
                rec = getattr(status, "record_count", None)
                if rec is None or rec == 0:
                    records = getattr(status, "records", None)
                    rec = len(records) if records is not None else 0
                failures = len(getattr(status, "failures", []) or [])
                parts.append(f"{step.name}={rec}/{failures}err")
            except Exception:
                continue
        if not parts:
            return ""
        return " steps=[" + ",".join(parts) + "]"


def _fmt_age(seconds: float | None) -> str:
    if seconds is None:
        return "?"
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m{s:02d}s"
    h, rem = divmod(int(seconds), 3600)
    m, _ = divmod(rem, 60)
    return f"{h}h{m:02d}m"
