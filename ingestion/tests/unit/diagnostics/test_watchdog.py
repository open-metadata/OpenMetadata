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
"""Watchdog verdicts + handler.run_watchdog log+dump integration."""

import logging
import threading
import time as _time

import pytest

from metadata.ingestion.diagnostics.collectors.http import HttpTracker
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.collectors.stage_progress import StageProgressCollector
from metadata.ingestion.diagnostics.config import DiagnosticsConfig
from metadata.ingestion.diagnostics.handler import DiagnosticsHandler
from metadata.ingestion.diagnostics.monitors.watchdog import Watchdog
from metadata.ingestion.diagnostics.samplers.memory import MemoryTracker
from metadata.ingestion.diagnostics.samplers.time_accounting import TimeAccountingSampler


def _make_watchdog():
    registry = OperationRegistry()
    return Watchdog(registry, MemoryTracker(), DiagnosticsConfig()), registry


# ---- pure detector verdicts ----


def test_no_verdict_for_short_operation():
    watchdog, registry = _make_watchdog()
    registry.push("op.fast", {})
    assert watchdog.check(_time.monotonic()) == []


def test_stuck_verdict_after_warn_threshold():
    """An op stuck >60s emits a warn-only verdict (no dump_reason)."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 100.0
    registry._stacks[tid] = [("snowflake.query", {"sql": "SELECT *"}, started, 1)]

    verdicts = watchdog.check(_time.monotonic())
    assert len(verdicts) == 1
    verdict = verdicts[0]
    assert verdict.severity == logging.WARNING
    assert "diag.warn.stuck" in verdict.message
    assert "snowflake.query" in verdict.message
    assert verdict.dump_reason is None


def test_auto_dump_verdict_after_hang_threshold():
    """An op stuck >300s emits a verdict carrying a dump_reason."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 1000.0
    registry._stacks[tid] = [("source.iter", {"entity": "table42"}, started, 1)]

    verdicts = watchdog.check(_time.monotonic())
    assert len(verdicts) == 1
    verdict = verdicts[0]
    assert "diag.watchdog.auto_dump" in verdict.message
    assert verdict.dump_reason is not None
    assert "watchdog:source.iter" in verdict.dump_reason


def test_redump_throttle_blocks_repeat_dump_verdicts():
    """Re-ticking before the throttle window expires must not re-emit a dump verdict."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 1000.0
    registry._stacks[tid] = [("op.hung", {}, started, 1)]

    first = watchdog.check(_time.monotonic())
    second = watchdog.check(_time.monotonic())

    assert sum(1 for v in first if v.dump_reason is not None) == 1
    assert all(v.dump_reason is None for v in second)


# ---- handler shell: verdicts -> log + dump ----


def _make_handler_with_hung_op(started_seconds_ago: float):
    config = DiagnosticsConfig()
    registry = OperationRegistry()
    memory = MemoryTracker()
    tid = threading.get_ident()
    registry._stacks[tid] = [("source.iter", {"entity": "t"}, _time.monotonic() - started_seconds_ago, 1)]
    aspects = [registry, HttpTracker(), memory, TimeAccountingSampler(registry), StageProgressCollector()]
    return DiagnosticsHandler(
        config=config,
        aspects=aspects,
        watchdog=Watchdog(registry, memory, config),
        db_introspector=None,
        workflow=None,
    )


def test_handler_run_watchdog_logs_warn_and_dumps_on_hang(caplog: pytest.LogCaptureFixture) -> None:
    """End-to-end: a hung op produces the auto_dump log line AND a real dump."""
    handler = _make_handler_with_hung_op(started_seconds_ago=1000.0)
    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        handler.run_watchdog()
    out = "\n".join(r.getMessage() for r in caplog.records)
    assert "diag.watchdog.auto_dump" in out
    assert "diag.dump.begin" in out
    assert "diag.dump.end" in out


def test_handler_run_watchdog_logs_warn_without_dump_on_stuck(caplog: pytest.LogCaptureFixture) -> None:
    handler = _make_handler_with_hung_op(started_seconds_ago=100.0)
    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        handler.run_watchdog()
    out = "\n".join(r.getMessage() for r in caplog.records)
    assert "diag.warn.stuck" in out
    assert "diag.dump.begin" not in out
