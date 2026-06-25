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
On-demand dump rendering.

`emit_full_dump` / `emit_incremental_dump` render a point-in-time snapshot — the
report produced when something is wrong: a hang, memory pressure, an OOM, or a
manual SIGUSR. The *triggers* live in the watchdog / signal handlers / facade.

The orchestrator fans `render_dump()` over the renderables, so it knows none of
their internals. Two things it renders directly because they aren't renderables:
`threads` (live execution state) and `workflow` (derived from the workflow object).

Routing: `signal_safe=True` writes synchronously to `sys.stderr` (safe from a
signal handler); the default buffers and ships the block as one log record.
"""

from __future__ import annotations

import faulthandler
import io
import logging
import os
import sys
import threading
import time
import traceback
from typing import TYPE_CHECKING, Any, TextIO

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import emit_log

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.diagnostics.protocols import HasDump


def emit_full_dump(
    reason: str,
    dump_sections: Iterable[HasDump],
    workflow: Any = None,
    signal_safe: bool = False,
) -> None:
    """Threads + each section's `render_dump` fragment + workflow steps."""
    buf: io.StringIO | None = None if signal_safe else io.StringIO()
    out = sys.stderr if buf is None else buf
    out.write(f"{DIAG_LOG_PREFIX}.dump.begin reason={reason} pid={os.getpid()} ts={time.time():.0f}\n")
    try:
        _emit_thread_dump(out, signal_safe=signal_safe)
        for section in dump_sections:
            section.render_dump(out)
        _emit_workflow_dump(out, workflow)
    except Exception as exc:
        out.write(f"{DIAG_LOG_PREFIX}.dump.error err={exc!r}\n")
    out.write(f"{DIAG_LOG_PREFIX}.dump.end reason={reason}\n")
    if buf is None:
        out.flush()
    else:
        emit_log(logging.WARNING, buf.getvalue().rstrip("\n"))


def emit_incremental_dump(dump_sections: Iterable[HasDump], signal_safe: bool = False) -> None:
    """Each section's `render_dump` fragment, without thread tracebacks."""
    buf: io.StringIO | None = None if signal_safe else io.StringIO()
    out = sys.stderr if buf is None else buf
    out.write(f"{DIAG_LOG_PREFIX}.dump.begin reason=sigusr2 pid={os.getpid()} ts={time.time():.0f}\n")
    for section in dump_sections:
        section.render_dump(out)
    out.write(f"{DIAG_LOG_PREFIX}.dump.end reason=sigusr2\n")
    if buf is None:
        out.flush()
    else:
        emit_log(logging.INFO, buf.getvalue().rstrip("\n"))


def _emit_thread_dump(out: TextIO, signal_safe: bool) -> None:
    """Render per-thread stack traces — live execution state, not a renderable.

    Signal-safe path uses `faulthandler.dump_traceback` (real fd, Python +
    native frames). The buffered path uses `sys._current_frames()` +
    `traceback.format_stack` (Python frames only, any file-like).
    """
    out.write(f"{DIAG_LOG_PREFIX}.dump.threads\n")
    if signal_safe:
        try:
            faulthandler.dump_traceback(file=out, all_threads=True)
        except Exception as exc:
            out.write(f"{DIAG_LOG_PREFIX}.dump.threads.error err={exc!r}\n")
        return
    try:
        name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
        for tid, frame in sys._current_frames().items():
            thread_name = name_by_ident.get(tid, f"tid-{tid}")
            out.write(f"  thread={thread_name}({tid})\n")
            for line in traceback.format_stack(frame):
                for sub in line.rstrip("\n").splitlines():
                    out.write(f"    {sub}\n")
    except Exception as exc:
        out.write(f"{DIAG_LOG_PREFIX}.dump.threads.error err={exc!r}\n")


def _emit_workflow_dump(out: TextIO, workflow: Any) -> None:
    if workflow is None:
        return
    out.write(f"{DIAG_LOG_PREFIX}.dump.workflow\n")
    try:
        steps = workflow.workflow_steps() if hasattr(workflow, "workflow_steps") else []
    except Exception as exc:
        out.write(f"  (could not enumerate steps: {exc!r})\n")
        return
    for step in steps:
        try:
            status = step.get_status()
            out.write(
                f"  step={step.name} records={getattr(status, 'record_count', '?')} "
                f"failures={len(getattr(status, 'failures', []))} "
                f"filtered={len(getattr(status, 'filtered', []))}\n"
            )
        except Exception as exc:
            out.write(f"  step={getattr(step, 'name', '?')} dump_error={exc!r}\n")
