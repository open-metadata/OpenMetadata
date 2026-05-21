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
"""Watchdog behavior: warn at stuck-threshold, auto-dump at hang-threshold, throttle re-dumps.

Watchdog output goes through the `metadata.Diagnostics` logger; tests use
`caplog` to read what was emitted.
"""

import logging
import threading
import time as _time

from metadata.ingestion.diagnostics.http_introspect import HttpTracker
from metadata.ingestion.diagnostics.memory import MemoryTracker
from metadata.ingestion.diagnostics.registry import OperationRegistry
from metadata.ingestion.diagnostics.watchdog import WatchdogThread


def _make_watchdog():
    registry = OperationRegistry()
    http_tracker = HttpTracker()
    memory_tracker = MemoryTracker()
    watchdog = WatchdogThread(
        registry=registry, http_tracker=http_tracker, memory_tracker=memory_tracker, workflow=None
    )
    return watchdog, registry


def _all_messages(caplog) -> str:
    return "\n".join(r.getMessage() for r in caplog.records)


def test_no_warn_for_short_operation(caplog):
    watchdog, registry = _make_watchdog()
    registry.push("op.fast", {})

    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        watchdog._tick()
    out = _all_messages(caplog)
    assert "diag.warn.stuck" not in out


def test_warn_fires_after_stuck_threshold(caplog):
    """A stuck op (>60s but <300s) emits a `diag.warn.stuck` line."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 100.0
    registry._stacks[tid] = [("snowflake.query", {"sql": "SELECT *"}, started, 1)]

    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        watchdog._tick()
    out = _all_messages(caplog)
    assert "diag.warn.stuck" in out
    assert "snowflake.query" in out
    assert "diag.watchdog.auto_dump" not in out


def test_auto_dump_fires_after_hang_threshold(caplog):
    """An op stuck for >300s triggers a full dump (shipped via logger)."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 1000.0
    registry._stacks[tid] = [("source.iter", {"entity": "table42"}, started, 1)]

    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        watchdog._tick()
    out = _all_messages(caplog)
    assert "diag.watchdog.auto_dump" in out
    assert "diag.dump.begin" in out
    assert "diag.dump.end" in out


def test_redump_throttle_prevents_flood(caplog):
    """Re-ticking before the throttle window expires must not emit another dump."""
    watchdog, registry = _make_watchdog()
    tid = threading.get_ident()
    started = _time.monotonic() - 1000.0
    registry._stacks[tid] = [("op.hung", {}, started, 1)]

    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        watchdog._tick()
        first_count = sum("diag.watchdog.auto_dump" in r.getMessage() for r in caplog.records)
        watchdog._tick()
        second_count = sum("diag.watchdog.auto_dump" in r.getMessage() for r in caplog.records)
    assert first_count == 1
    assert second_count == 1
