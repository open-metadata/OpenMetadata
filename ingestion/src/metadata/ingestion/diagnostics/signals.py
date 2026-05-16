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
Signal-triggered dumps.

SIGUSR1 = full dump (threads + ops + http + memory).
SIGUSR2 = incremental (ops + http + memory only).
faulthandler.register(SIGABRT) is a free belt-and-braces for fatal aborts.

Output routing
--------------
`emit_full_dump()` / `emit_incremental_dump()` accept a `signal_safe` flag:

  * `signal_safe=False` (default; watchdog auto-dump, programmatic `dump()`):
    accumulate into an in-memory buffer, then emit as ONE log record via
    `metadata.Diagnostics`. The whole dump ships through `StreamableLogHandler`
    as a single payload (no S3 line splitting) and through any other
    configured handler.

  * `signal_safe=True` (SIGUSR1 / SIGUSR2 handler):
    write directly to `sys.stderr`. Cannot use the logger from signal
    context — Python's logging module takes per-handler RLocks, which is
    not signal-safe (can deadlock against the very thread that was holding
    the lock when the signal was delivered).
"""

import faulthandler
import io
import logging
import os
import signal
import sys
import threading
import time
import traceback
from typing import Any

from metadata.ingestion.diagnostics import DIAG_LOG_PREFIX, emit_log
from metadata.ingestion.diagnostics.memory import (
    MemoryTracker,
    format_bytes,
    format_signed_bytes,
)
from metadata.ingestion.diagnostics.registry import OperationRegistry, format_op_frame


def install_signal_handlers(
    registry: OperationRegistry,
    http_tracker: Any,
    memory_tracker: MemoryTracker,
    workflow: Any,
) -> bool:
    """Wire SIGUSR1 / SIGUSR2 / faulthandler.

    Returns True on success. On Windows (no SIGUSR1) or when called
    from a non-main thread, falls back gracefully without raising.
    """
    if threading.current_thread() is not threading.main_thread():
        # Python's signal handlers can only be installed from the main
        # thread. If the workflow happens to run in a worker thread
        # (rare but possible), skip signal installation and let the
        # watchdog/heartbeat do the work.
        emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.signals skipped reason=not-main-thread")
        return False

    installed_any = False
    try:
        faulthandler.enable(file=sys.stderr)
        installed_any = True
    except Exception as exc:
        emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.faulthandler failed err={exc!r}")

    sigusr1 = getattr(signal, "SIGUSR1", None)
    sigusr2 = getattr(signal, "SIGUSR2", None)

    if sigusr1 is not None:
        try:
            signal.signal(
                sigusr1,
                _make_full_dump_handler(registry, http_tracker, memory_tracker, workflow),
            )
            installed_any = True
        except (OSError, ValueError) as exc:
            emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.sigusr1 failed err={exc!r}")

    if sigusr2 is not None:
        try:
            signal.signal(
                sigusr2,
                _make_incremental_dump_handler(registry, http_tracker, memory_tracker),
            )
            installed_any = True
        except (OSError, ValueError) as exc:
            emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.sigusr2 failed err={exc!r}")

    return installed_any


def _make_full_dump_handler(
    registry: OperationRegistry,
    http_tracker: Any,
    memory_tracker: MemoryTracker,
    workflow: Any,
) -> Any:
    def _handler(_signum: int, _frame: Any) -> None:
        # Signal context -- must NOT use the logger (per-handler RLocks
        # are not signal-safe). Stay on raw stderr.
        try:
            emit_full_dump(
                reason="sigusr1",
                registry=registry,
                http_tracker=http_tracker,
                memory_tracker=memory_tracker,
                workflow=workflow,
                signal_safe=True,
            )
        except Exception as exc:
            sys.stderr.write(f"{DIAG_LOG_PREFIX}.dump.error reason=sigusr1 err={exc!r}\n")
            sys.stderr.flush()

    return _handler


def _make_incremental_dump_handler(
    registry: OperationRegistry,
    http_tracker: Any,
    memory_tracker: MemoryTracker,
) -> Any:
    def _handler(_signum: int, _frame: Any) -> None:
        try:
            emit_incremental_dump(
                registry=registry,
                http_tracker=http_tracker,
                memory_tracker=memory_tracker,
                signal_safe=True,
            )
        except Exception as exc:
            sys.stderr.write(f"{DIAG_LOG_PREFIX}.dump.error reason=sigusr2 err={exc!r}\n")
            sys.stderr.flush()

    return _handler


def emit_full_dump(
    reason: str,
    registry: OperationRegistry,
    http_tracker: Any,
    memory_tracker: MemoryTracker,
    workflow: Any = None,
    signal_safe: bool = False,
) -> None:
    """Emit the full dump (threads + ops + http + memory + workflow).

    `signal_safe=True` writes synchronously to `sys.stderr` so the call
    is safe from a signal handler. `signal_safe=False` (the default)
    accumulates into a buffer and emits the entire block through the
    diagnostics logger as a single record, so it ships via whatever
    handlers the workflow has configured (StreamableLogHandler, file,
    etc.) without splitting across lines.
    """
    buf: io.StringIO | None = None if signal_safe else io.StringIO()
    out = sys.stderr if buf is None else buf
    out.write(f"{DIAG_LOG_PREFIX}.dump.begin reason={reason} pid={os.getpid()} ts={time.time():.0f}\n")
    try:
        _emit_thread_dump(out, signal_safe=signal_safe)
        _emit_op_dump(out, registry)
        _emit_http_dump(out, http_tracker)
        _emit_memory_dump(out, memory_tracker, deep=True)
        _emit_queues_dump(out)
        _emit_workflow_dump(out, workflow)
    except Exception as exc:
        out.write(f"{DIAG_LOG_PREFIX}.dump.error err={exc!r}\n")
    out.write(f"{DIAG_LOG_PREFIX}.dump.end reason={reason}\n")
    if buf is None:
        out.flush()
    else:
        emit_log(logging.WARNING, buf.getvalue().rstrip("\n"))


def emit_incremental_dump(
    registry: OperationRegistry,
    http_tracker: Any,
    memory_tracker: MemoryTracker,
    signal_safe: bool = False,
) -> None:
    """Emit ops + http + memory (no thread tracebacks, no top_types).

    Same routing semantics as `emit_full_dump`.
    """
    buf: io.StringIO | None = None if signal_safe else io.StringIO()
    out = sys.stderr if buf is None else buf
    out.write(f"{DIAG_LOG_PREFIX}.dump.begin reason=sigusr2 pid={os.getpid()} ts={time.time():.0f}\n")
    _emit_op_dump(out, registry)
    _emit_http_dump(out, http_tracker)
    _emit_memory_dump(out, memory_tracker, deep=False)
    _emit_queues_dump(out)
    out.write(f"{DIAG_LOG_PREFIX}.dump.end reason=sigusr2\n")
    if buf is None:
        out.flush()
    else:
        emit_log(logging.INFO, buf.getvalue().rstrip("\n"))


def _emit_thread_dump(out: Any, signal_safe: bool) -> None:
    """Render per-thread stack traces.

    Signal-safe path uses `faulthandler.dump_traceback`, which writes
    via a real fd and captures both Python and native (C extension)
    frames. Non-signal-safe path (StringIO target, used when shipping
    via the logger) uses `sys._current_frames()` +
    `traceback.format_stack` — Python frames only, but works with any
    file-like.
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


def _emit_op_dump(out: Any, registry: OperationRegistry) -> None:
    out.write(f"{DIAG_LOG_PREFIX}.dump.ops\n")
    snapshot = registry.snapshot()
    if not snapshot:
        out.write("  (no active operations)\n")
        return
    name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
    for tid, stack in snapshot.items():
        thread_name = name_by_ident.get(tid, f"tid-{tid}")
        out.write(f"  thread={thread_name}({tid})\n")
        for name, kwargs, age in stack:
            out.write(f"    -> {format_op_frame(name, kwargs, age)}\n")


def _emit_http_dump(out: Any, http_tracker: Any) -> None:
    out.write(f"{DIAG_LOG_PREFIX}.dump.http\n")
    active = http_tracker.snapshot()
    if not active:
        out.write("  (no in-flight requests)\n")
        return
    name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
    for tid, method, url, age in sorted(active, key=lambda r: -r[3]):
        thread_name = name_by_ident.get(tid, f"tid-{tid}")
        out.write(f"  thread={thread_name} method={method} url={url} age={age:.1f}s\n")


def _emit_memory_dump(out: Any, memory_tracker: MemoryTracker, deep: bool) -> None:
    out.write(f"{DIAG_LOG_PREFIX}.dump.memory\n")
    sample = memory_tracker.sample()
    delta_30s = memory_tracker.rss_delta_bytes_since(30.0)
    out.write(
        f"  rss={format_bytes(sample.rss)} "
        f"rss_delta_30s={format_signed_bytes(delta_30s)} "
        f"cgroup_current={format_bytes(sample.cgroup_current)} "
        f"cgroup_max={format_bytes(sample.cgroup_max)} "
        f"oom_kills={sample.oom_kill_count if sample.oom_kill_count is not None else '?'}\n"
    )
    if deep:
        out.write("  top_types:\n")
        for type_name, count in memory_tracker.top_object_types():
            out.write(f"    {type_name:<32} {count}\n")


def _emit_queues_dump(out: Any) -> None:
    """Render inter-stage queue depths + put/processed counters."""
    from metadata.ingestion.diagnostics import stage_progress  # noqa: PLC0415

    queues = stage_progress.snapshot()
    if not queues:
        return
    out.write(f"{DIAG_LOG_PREFIX}.dump.queues\n")
    for q in queues:
        out.write(f"  name={q['name']} depth={q['depth']} put={q['put']} processed={q['processed']}\n")


def _emit_workflow_dump(out: Any, workflow: Any) -> None:
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
