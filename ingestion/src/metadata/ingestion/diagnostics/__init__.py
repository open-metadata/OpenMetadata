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
Runtime diagnostics for ingestion workflows — public API.

When `workflowConfig.loggerLevel == DEBUG`, `install(workflow)` starts:
  - operation registry  (what each thread is doing right now)
  - signal handlers     (SIGUSR1/SIGUSR2 -> dump to stderr)
  - watchdog thread     (auto-detect hangs at 60s, auto-dump at 300s)
  - heartbeat thread    (one structured progress line every 30s)
  - memory tracker      (rss/cgroup on heartbeat, gc.get_objects on dump)
  - time-accounting     (100ms sampling, end-of-run wall-time-by-method)

When off, `operation()` is a no-op context manager — no threads, no overhead.

Architecture
------------
The handler singleton, log emitter, and any module-shared state live in
`kernel.py` — that's a dependency-free leaf module, so every collector,
sampler, monitor, and reporter top-imports from it without risking a cycle.
This file is a thin public API + composition entry-point on top.

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
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from typing import Any

from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import (
    emit_log,
    get_handler,
    set_handler,
)

# Back-compat alias: existing seams still import `_get_state` from the facade.
_get_state = get_handler


def is_active() -> bool:
    """True when diagnostics has been installed and is running."""
    return get_handler() is not None


@contextmanager
def operation(name: str, **kwargs: Any) -> Iterator[None]:
    """Register the current thread as performing `name`.

    When diagnostics is not installed, this is a zero-overhead no-op so
    callers can sprinkle it through hot paths without worrying. When on,
    push/pop are wrapped so a bug in diagnostics can never propagate into
    ingestion — the helpers log the failure and return cleanly.
    """
    handler = get_handler()
    if handler is None:
        yield
        return
    registry, token = _safe_push_operation(handler, name, kwargs)
    try:
        yield
    finally:
        _safe_pop_operation(registry, token)


def _safe_push_operation(handler: Any, name: str, kwargs: dict) -> tuple[Any, Any]:
    """Push the op onto the registry; on any failure log and return (None, None)."""
    try:
        registry = handler.aspect(OperationRegistry)
        return registry, registry.push(name, kwargs)
    except Exception as exc:
        emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.operation.push.error err={exc!r}")
        return None, None


def _safe_pop_operation(registry: Any, token: Any) -> None:
    if registry is None or token is None:
        return
    try:
        registry.pop(token)
    except Exception as exc:
        emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.operation.pop.error err={exc!r}")


def install(workflow: Any) -> bool:
    """Install diagnostics for the given workflow.

    Returns True if diagnostics is now active (whether installed by this
    call or already running). Returns False when `loggerLevel` is not
    DEBUG or installation fails. Always best-effort: a diagnostics
    failure must never bring down the workflow.
    """
    if get_handler() is not None:
        return True

    if not _logger_level_is_debug(workflow):
        return False

    try:
        from metadata.ingestion.diagnostics.handler import DiagnosticsHandler  # noqa: PLC0415

        handler = DiagnosticsHandler.build(workflow)
        handler.start()
        set_handler(handler)
    except Exception as exc:
        # Diagnostics must never break the workflow it is monitoring.
        _log_install_failure(exc)
        set_handler(None)
        return False
    _log_install_banner()
    return True


def shutdown() -> None:
    """Stop all diagnostics threads and reset state.

    Called from `BaseWorkflow.stop()` so threads don't outlive the
    workflow and so a subsequent `install()` (e.g. in a test) starts
    fresh.
    """
    handler = get_handler()
    if handler is None:
        return
    set_handler(None)
    handler.emit_summary()
    handler.stop()


def dump(reason: str = "manual") -> None:
    """Emit a full dump (threads + ops + http + memory) to stderr.

    Safe to call from any thread. Used by signal handlers and by the
    watchdog auto-dump path.
    """
    handler = get_handler()
    if handler is not None:
        handler.emit_dump(reason)


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


def _log_install_banner() -> None:
    emit_log(
        logging.INFO,
        f"{DIAG_LOG_PREFIX}.install ok components=registry,signals,watchdog,heartbeat,memory",
    )


def _log_install_failure(exc: BaseException) -> None:
    emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.install failed err={exc!r}")
