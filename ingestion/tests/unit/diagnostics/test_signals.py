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
"""Dump output format and routing.

Non-signal-safe dumps go through the `metadata.Diagnostics` logger as a
single record (so they ship via StreamableLogHandler and any other
configured handler). Signal-safe dumps go to raw stderr (signal handler
context — can't safely call into the logging module).
"""

import io
import logging
import sys
from unittest.mock import patch

from metadata.ingestion.diagnostics.http_introspect import HttpTracker
from metadata.ingestion.diagnostics.memory import MemoryTracker
from metadata.ingestion.diagnostics.registry import OperationRegistry
from metadata.ingestion.diagnostics.signals import (
    emit_full_dump,
    emit_incremental_dump,
)


def _capture_logger_full(registry, http, memory, workflow=None, caplog=None) -> str:
    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        emit_full_dump(
            reason="unit-test",
            registry=registry,
            http_tracker=http,
            memory_tracker=memory,
            workflow=workflow,
            signal_safe=False,
        )
    return "\n".join(r.getMessage() for r in caplog.records)


def _capture_stderr_full(registry, http, memory, workflow=None) -> str:
    stderr = io.StringIO()
    with patch.object(sys, "stderr", stderr):
        emit_full_dump(
            reason="unit-test",
            registry=registry,
            http_tracker=http,
            memory_tracker=memory,
            workflow=workflow,
            signal_safe=True,
        )
    return stderr.getvalue()


# ---------- Non-signal-safe path: goes through the logger ----------


def test_full_dump_has_section_markers(caplog):
    out = _capture_logger_full(OperationRegistry(), HttpTracker(), MemoryTracker(), caplog=caplog)
    for marker in ("diag.dump.begin", "diag.dump.ops", "diag.dump.http", "diag.dump.memory", "diag.dump.end"):
        assert marker in out


def test_full_dump_is_one_log_record_for_shipping(caplog):
    """The entire dump must be one log record so StreamableLogHandler ships it as one payload."""
    with caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"):
        emit_full_dump(
            reason="unit",
            registry=OperationRegistry(),
            http_tracker=HttpTracker(),
            memory_tracker=MemoryTracker(),
            workflow=None,
            signal_safe=False,
        )
    dump_records = [r for r in caplog.records if "diag.dump.begin" in r.getMessage()]
    assert len(dump_records) == 1


def test_full_dump_lists_active_ops(caplog):
    registry = OperationRegistry()
    registry.push("source.iter", {"entity": "table42"})
    out = _capture_logger_full(registry, HttpTracker(), MemoryTracker(), caplog=caplog)
    assert "source.iter" in out
    assert "table42" in out


def test_full_dump_lists_inflight_http(caplog):
    http = HttpTracker()
    with http.request("PUT", "/api/v1/tables"):
        out = _capture_logger_full(OperationRegistry(), http, MemoryTracker(), caplog=caplog)
        assert "method=PUT" in out
        assert "url=/api/v1/tables" in out


def test_full_dump_includes_python_thread_frames(caplog):
    """Logger path uses `sys._current_frames()` (no native frames, but ships)."""
    out = _capture_logger_full(OperationRegistry(), HttpTracker(), MemoryTracker(), caplog=caplog)
    assert "diag.dump.threads" in out
    # The current thread must appear with at least one frame.
    assert "thread=MainThread" in out


def test_incremental_dump_excludes_thread_section(caplog):
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        emit_incremental_dump(
            registry=OperationRegistry(),
            http_tracker=HttpTracker(),
            memory_tracker=MemoryTracker(),
            signal_safe=False,
        )
    out = "\n".join(r.getMessage() for r in caplog.records)
    assert "diag.dump.threads" not in out
    assert "diag.dump.ops" in out
    assert "diag.dump.memory" in out
    assert "top_types" not in out  # shallow dump skips the expensive section


def test_full_dump_renders_workflow_step_summary(caplog):
    class _Status:
        def __init__(self) -> None:
            self.record_count = 5
            self.failures: list = []
            self.filtered: list = []

    class _Step:
        name = "Source"

        def get_status(self):
            return _Status()

    class _Workflow:
        def workflow_steps(self):
            return [_Step()]

    out = _capture_logger_full(OperationRegistry(), HttpTracker(), MemoryTracker(), workflow=_Workflow(), caplog=caplog)
    assert "diag.dump.workflow" in out
    assert "step=Source" in out
    assert "records=5" in out


# ---------- Signal-safe path: writes directly to stderr ----------


def test_signal_safe_full_dump_writes_to_stderr():
    out = _capture_stderr_full(OperationRegistry(), HttpTracker(), MemoryTracker())
    for marker in ("diag.dump.begin", "diag.dump.ops", "diag.dump.http", "diag.dump.memory", "diag.dump.end"):
        assert marker in out


def test_signal_safe_path_does_not_emit_log_records(caplog):
    """Signal-handler dumps must NOT go through the logger."""
    with caplog.at_level(logging.DEBUG, logger="metadata.Diagnostics"):
        _capture_stderr_full(OperationRegistry(), HttpTracker(), MemoryTracker())
    dump_records = [r for r in caplog.records if "diag.dump" in r.getMessage()]
    assert dump_records == []
