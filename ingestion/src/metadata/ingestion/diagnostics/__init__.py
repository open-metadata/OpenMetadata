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
Runtime diagnostics for ingestion workflows.

When `workflowConfig.loggerLevel == DEBUG`, `install(workflow)` starts:
  - operation registry  (what each thread is doing right now)
  - signal handlers     (SIGUSR1/SIGUSR2 -> dump to stderr)
  - watchdog thread     (auto-detect hangs at 60s, auto-dump at 300s)
  - heartbeat thread    (one structured progress line every 30s)
  - memory tracker      (rss/cgroup on heartbeat, gc.get_objects on dump)

When off, `operation()` is a no-op context manager — no threads, no overhead.

Output channels
---------------
Regular-thread output (heartbeat, watchdog warn/auto-dump, install banner,
programmatic `dump()`) is emitted via the `metadata.Diagnostics` logger and
flows through whatever handlers the workflow has configured:

  * console / `BASE_LOGGING_FORMAT` StreamHandler -> kubectl logs
  * `StreamableLogHandler` (when `enableStreamableLogs=True`) -> S3
  * any file or syslog handlers users have attached

If the logger itself errors, the message falls back to a raw stderr write so
operators on `kubectl logs` still see the line.

Signal-handler output (SIGUSR1 / SIGUSR2 and `faulthandler.dump_traceback`)
goes straight to stderr because Python's logging module takes per-handler
RLocks and is not safe to call from signal context.
"""

import logging
import sys
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from typing import Any, Optional

from metadata.utils.logger import diag_logger

WATCHDOG_TICK_SECONDS = 10
STUCK_WARN_SECONDS = 60
AUTO_DUMP_SECONDS = 300
REDUMP_THROTTLE_SECONDS = 300
HEARTBEAT_INTERVAL_SECONDS = 30
MEMORY_SAMPLE_INTERVAL_SECONDS = 30
KWARGS_TRUNCATION_CHARS = 2000
OP_STACK_DEPTH_CAP = 20
DIAG_LOG_PREFIX = "diag"

# Pre-OOM tripwire thresholds. PSI `some avg10` is a percentage 0..100
# representing how much of the last 10 s the cgroup was stalled on
# memory; sustained values >10% reliably predict OOMKill within tens of
# seconds on gradual leaks (see /proc/pressure docs).
PRESSURE_PSI_AVG10_THRESHOLD = 10.0
# Memory-pressure tripwire dumps are throttled to one per reason per
# 5 minutes so we don't flood the logs with snapshots while pressure is
# sustained.
PRESSURE_DUMP_THROTTLE_SECONDS = 300

_state: Optional["_DiagnosticsState"] = None


class _DiagnosticsState:
    """Holds references to the singletons installed by `install()`."""

    def __init__(
        self,
        registry: Any,
        http_tracker: Any,
        memory_tracker: Any,
        watchdog: Any,
        heartbeat: Any,
        signals_installed: bool,
        db_introspector: Any,
        time_sampler: Any,
    ) -> None:
        self.registry = registry
        self.http_tracker = http_tracker
        self.memory_tracker = memory_tracker
        self.watchdog = watchdog
        self.heartbeat = heartbeat
        self.signals_installed = signals_installed
        self.db_introspector = db_introspector
        self.time_sampler = time_sampler


def is_active() -> bool:
    """True when diagnostics has been installed and is running."""
    return _state is not None


@contextmanager
def operation(name: str, **kwargs: Any) -> Iterator[None]:
    """Register the current thread as performing `name`.

    When diagnostics is not installed, this is a zero-overhead no-op so
    callers can sprinkle it through hot paths without worrying.
    """
    state = _state
    if state is None:
        yield
        return
    token = state.registry.push(name, kwargs)
    try:
        yield
    finally:
        state.registry.pop(token)


def install(workflow: Any) -> bool:
    """Install diagnostics for the given workflow.

    Returns True if diagnostics is now active (whether installed by this
    call or already running). Returns False when `loggerLevel` is not
    DEBUG or installation fails. Always best-effort: a diagnostics
    failure must never bring down the workflow.
    """
    global _state  # noqa: PLW0603  module-level singleton

    if _state is not None:
        return True

    if not _logger_level_is_debug(workflow):
        return False

    # Imports are deferred to keep `is_active()` / no-op `operation()` callers
    # from paying the import cost on every workflow start.
    try:
        from metadata.ingestion.diagnostics import stage_progress as _stage_progress  # noqa: PLC0415
        from metadata.ingestion.diagnostics.db_introspect import DbIntrospector  # noqa: PLC0415
        from metadata.ingestion.diagnostics.heartbeat import HeartbeatThread  # noqa: PLC0415
        from metadata.ingestion.diagnostics.http_introspect import HttpTracker  # noqa: PLC0415
        from metadata.ingestion.diagnostics.memory import MemoryTracker  # noqa: PLC0415
        from metadata.ingestion.diagnostics.registry import OperationRegistry  # noqa: PLC0415
        from metadata.ingestion.diagnostics.signals import install_signal_handlers  # noqa: PLC0415
        from metadata.ingestion.diagnostics.time_accounting import TimeAccountingSampler  # noqa: PLC0415
        from metadata.ingestion.diagnostics.watchdog import WatchdogThread  # noqa: PLC0415

        registry = OperationRegistry()
        http_tracker = HttpTracker()
        memory_tracker = MemoryTracker()
        _stage_progress.install(_stage_progress.StageProgressCollector())
        db_introspector = DbIntrospector(registry)
        db_introspector.install()
        time_sampler = TimeAccountingSampler(registry)
        time_sampler.start()

        signals_installed = install_signal_handlers(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            workflow=workflow,
        )

        watchdog = WatchdogThread(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            workflow=workflow,
        )
        watchdog.start()

        heartbeat = HeartbeatThread(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            workflow=workflow,
        )
        heartbeat.start()

        _state = _DiagnosticsState(
            registry=registry,
            http_tracker=http_tracker,
            memory_tracker=memory_tracker,
            watchdog=watchdog,
            heartbeat=heartbeat,
            signals_installed=signals_installed,
            db_introspector=db_introspector,
            time_sampler=time_sampler,
        )
    except Exception as exc:
        # Diagnostics must never break the workflow it is monitoring.
        _log_install_failure(exc)
        _state = None
        return False
    _log_install_banner()
    return True


def shutdown() -> None:
    """Stop all diagnostics threads and reset state.

    Called from `BaseWorkflow.stop()` so threads don't outlive the
    workflow and so a subsequent `install()` (e.g. in a test) starts
    fresh.
    """
    global _state  # noqa: PLW0603  module-level singleton
    state = _state
    if state is None:
        return
    _state = None
    # Emit the time-budget summary BEFORE stopping the sampler — gives
    # the operator one line in `kubectl logs` / S3 explaining where the
    # workflow actually spent its wall clock.
    with suppress(Exception):
        emit_log(logging.INFO, state.time_sampler.summary_log_line())
    for thread in (state.watchdog, state.heartbeat, state.time_sampler):
        with suppress(Exception):
            thread.stop()
    with suppress(Exception):
        state.db_introspector.uninstall()
    with suppress(Exception):
        from metadata.ingestion.diagnostics import stage_progress  # noqa: PLC0415

        stage_progress.uninstall()


def dump(reason: str = "manual") -> None:
    """Emit a full dump (threads + ops + http + memory) to stderr.

    Safe to call from any thread. Used by signal handlers and by the
    watchdog auto-dump path.
    """
    state = _state
    if state is None:
        return
    from metadata.ingestion.diagnostics.signals import emit_full_dump  # noqa: PLC0415

    emit_full_dump(
        reason=reason,
        registry=state.registry,
        http_tracker=state.http_tracker,
        memory_tracker=state.memory_tracker,
    )


def dump_on_memory_error():
    """Context manager wrapping `MemoryError`-raising code with a dump-then-reraise.

    Use it around `BaseWorkflow.execute_internal()` so a Python-side
    OOM (the allocator failed before the kernel killed us) still
    produces a dump in the logs / S3 before propagating.
    """
    return _DumpOnMemoryError()


class _DumpOnMemoryError:
    def __enter__(self) -> "_DumpOnMemoryError":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        _tb: Any,
    ) -> bool:
        if exc_type is MemoryError:
            # The dump path itself can fail under severe pressure;
            # never swallow the original MemoryError.
            with suppress(Exception):
                dump(reason=f"memory-error:{exc!r}")
        return False  # propagate


def _logger_level_is_debug(workflow: Any) -> bool:
    """True if the workflow is configured at DEBUG.

    Defensive — we never want a missing attribute or an unexpected
    value to crash the workflow at install time.
    """
    try:
        level = workflow.workflow_config.loggerLevel
        if level is None:
            return False
        value = getattr(level, "value", level)
        return str(value).upper() == "DEBUG"
    except Exception:
        return False


def emit_log(level: int, message: str) -> None:
    """Emit a diagnostics line through the `metadata.Diagnostics` logger.

    Belt-and-braces: if the logger itself fails (broken handler, lock
    contention from the very issue we're diagnosing), fall back to a
    raw stderr write so the line still reaches `kubectl logs`.

    Must NOT be called from signal-handler context — use
    `sys.stderr.write` directly for that.
    """
    try:
        diag_logger().log(level, message)
    except Exception:
        try:
            sys.stderr.write(message.rstrip("\n") + "\n")
            sys.stderr.flush()
        except Exception:
            pass


def _log_install_banner() -> None:
    emit_log(
        logging.INFO,
        f"{DIAG_LOG_PREFIX}.install ok components=registry,signals,watchdog,heartbeat,memory",
    )


def _log_install_failure(exc: BaseException) -> None:
    emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.install failed err={exc!r}")


def _get_state() -> Optional["_DiagnosticsState"]:
    """Test-only accessor."""
    return _state
