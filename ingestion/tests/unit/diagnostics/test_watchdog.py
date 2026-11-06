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
from metadata.ingestion.diagnostics.collectors.operation_registry import (
    NON_LEAF_OPS,
    OperationRegistry,
)
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
    registry._stacks[tid] = [("snowflake.query", {"sql": "SELECT *"}, started, 1)]

    verdicts = watchdog.check(_time.monotonic())
    assert len(verdicts) == 1
    verdict = verdicts[0]
    assert "diag.watchdog.auto_dump" in verdict.message
    assert verdict.dump_reason is not None
    assert "watchdog:snowflake.query" in verdict.dump_reason


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


# ---- wrapper-op exclusion (NON_LEAF_OPS) ----


@pytest.mark.parametrize("op_name", sorted(NON_LEAF_OPS))
def test_no_verdict_for_aged_wrapper_op_alone(op_name):
    """A whole-phase wrapper op whose cumulative age is past both thresholds must
    not produce any verdict — its age is the phase span, not a sign of being stuck."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 1000.0
    registry._stacks[tid] = [(op_name, {}, started, 1)]
    assert watchdog.check(_time.monotonic()) == []


def test_no_verdict_for_healthy_wrapper_with_intermittent_nested_progress():
    """Model a healthy long run: a wrapper frame held for the whole phase while
    short nested ops come and go to represent per-record progress. No verdicts
    should fire on any tick — whether the tick lands inside a nested op or after
    it pops back to the wrapper."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    # Wrapper held 1100 s — past warn (60 s) and dump (300 s) thresholds.
    wrapper_started = _time.monotonic() - 1100.0
    registry._stacks[tid] = [("source.iter", {"entity": "table42"}, wrapper_started, 1)]

    # Tick 1: wrapper is the deepest frame — excluded, no verdicts.
    assert watchdog.check(_time.monotonic()) == []

    # Simulate several cycles of per-record progress: push a short nested op,
    # tick inside it (small age), pop it, tick on the wrapper again (excluded).
    for _ in range(3):
        token = registry.push("sink.write", {"entity": "rec"})
        assert watchdog.check(_time.monotonic()) == []
        registry.pop(token)
        assert watchdog.check(_time.monotonic()) == []


def test_no_verdict_for_healthy_workflow_execute_across_redump_window():
    """A bare workflow.execute wrapper aged past the dump threshold + redump
    throttle must not re-fire verdicts on subsequent ticks — the exclusion
    holds even as the cumulative age keeps growing."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 400.0
    registry._stacks[tid] = [("workflow.execute", {}, started, 1)]

    assert watchdog.check(_time.monotonic()) == []
    # Even after the redump throttle window would have elapsed, no verdict.
    assert watchdog.check(_time.monotonic()) == []


def test_nested_stuck_op_under_wrapper_still_fires():
    """A genuinely stuck *leaf* op beneath a wrapper must still be caught —
    the exclusion only skips the wrapper frame, not real work."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    wrapper_started = _time.monotonic() - 1200.0
    registry._stacks[tid] = [("source.iter", {"entity": "t"}, wrapper_started, 1)]
    # Push a nested op that is itself aged past the dump threshold.
    nested_started = _time.monotonic() - 1000.0
    registry._stacks[tid].append(("snowflake.query", {"sql": "SELECT 1"}, nested_started, 2))

    verdicts = watchdog.check(_time.monotonic())
    assert len(verdicts) == 1
    verdict = verdicts[0]
    assert "diag.watchdog.auto_dump" in verdict.message
    assert "snowflake.query" in verdict.dump_reason
    # The wrapper must NOT appear in the verdict — only the stuck leaf op.
    assert "source.iter" not in verdict.dump_reason


# ---- handler shell: verdicts -> log + dump ----


def _make_handler_with_hung_op(started_seconds_ago: float):
    config = DiagnosticsConfig()
    registry = OperationRegistry()
    memory = MemoryTracker()
    tid = threading.get_ident()
    registry._stacks[tid] = [("snowflake.query", {"sql": "SELECT 1"}, _time.monotonic() - started_seconds_ago, 1)]
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


def test_handler_run_watchdog_no_dump_for_healthy_wrapper_op(caplog: pytest.LogCaptureFixture) -> None:
    """End-to-end: a healthy wrapper op aged past the dump threshold must not
    produce any watchdog warn/dump output via the handler."""
    config = DiagnosticsConfig()
    registry = OperationRegistry()
    memory = MemoryTracker()
    tid = threading.get_ident()
    registry._stacks[tid] = [("source.iter", {"entity": "t"}, _time.monotonic() - 1100.0, 1)]
    aspects = [registry, HttpTracker(), memory, TimeAccountingSampler(registry), StageProgressCollector()]
    handler = DiagnosticsHandler(
        config=config,
        aspects=aspects,
        watchdog=Watchdog(registry, memory, config),
        db_introspector=None,
        workflow=None,
    )
    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        handler.run_watchdog()
    out = "\n".join(r.getMessage() for r in caplog.records)
    assert "diag.warn.stuck" not in out
    assert "diag.watchdog.auto_dump" not in out
    assert "diag.dump.begin" not in out
