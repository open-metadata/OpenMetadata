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
"""Heartbeat output format and step-status rendering.

Heartbeats are emitted through the `metadata.Diagnostics` logger, so
tests use pytest's `caplog` to capture log records instead of patching
stderr.
"""

import logging

from metadata.ingestion.diagnostics.heartbeat import HeartbeatThread
from metadata.ingestion.diagnostics.http_introspect import HttpTracker
from metadata.ingestion.diagnostics.memory import MemoryTracker
from metadata.ingestion.diagnostics.registry import OperationRegistry


class _FakeStatus:
    def __init__(self, record_count=0, records=None, failures=None):
        self.record_count = record_count
        self.records = records or []
        self.failures = failures or []


class _FakeStep:
    def __init__(self, name, status):
        self.name = name
        self._status = status

    def get_status(self):
        return self._status


class _FakeWorkflow:
    def __init__(self, steps):
        self._steps = steps

    def workflow_steps(self):
        return self._steps


def _emit_once(heartbeat, caplog) -> str:
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        heartbeat._emit()
    return "\n".join(record.getMessage() for record in caplog.records)


def test_heartbeat_emits_required_fields(caplog):
    heartbeat = HeartbeatThread(
        registry=OperationRegistry(),
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=None,
    )
    out = _emit_once(heartbeat, caplog)
    assert out.startswith("diag.heartbeat")
    for key in ("tick=", "pid=", "threads=", "rss=", "rss_delta_30s=", "active_http=", "main_op="):
        assert key in out


def test_heartbeat_renders_step_progress(caplog):
    steps = [
        _FakeStep("Source", _FakeStatus(record_count=42, failures=["e1"])),
        _FakeStep("Sink", _FakeStatus(record_count=40, failures=[])),
    ]
    heartbeat = HeartbeatThread(
        registry=OperationRegistry(),
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=_FakeWorkflow(steps),
    )
    out = _emit_once(heartbeat, caplog)
    assert "steps=[Source=42/1err,Sink=40/0err]" in out


def test_heartbeat_renders_main_thread_operation(caplog):
    registry = OperationRegistry()
    registry.push("source.iter", {"entity": "x"})
    heartbeat = HeartbeatThread(
        registry=registry,
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=None,
    )
    out = _emit_once(heartbeat, caplog)
    assert "main_op=source.iter(" in out


def test_heartbeat_handles_broken_step_status_gracefully(caplog):
    class _BadStep:
        name = "Bad"

        def get_status(self):
            raise RuntimeError("boom")

    heartbeat = HeartbeatThread(
        registry=OperationRegistry(),
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=_FakeWorkflow([_BadStep()]),
    )
    out = _emit_once(heartbeat, caplog)
    assert out.startswith("diag.heartbeat")


def test_heartbeat_emits_at_info_level(caplog):
    heartbeat = HeartbeatThread(
        registry=OperationRegistry(),
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=None,
    )
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        heartbeat._emit()
    levels = {r.levelname for r in caplog.records if r.message.startswith("diag.heartbeat")}
    assert levels == {"INFO"}


# Backwards-compat: a sanity test that heartbeats DO NOT write to stderr directly
# (everything must go through the logger so it ships).
def test_heartbeat_does_not_write_directly_to_stderr(caplog, capsys):
    heartbeat = HeartbeatThread(
        registry=OperationRegistry(),
        http_tracker=HttpTracker(),
        memory_tracker=MemoryTracker(),
        workflow=None,
    )
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        heartbeat._emit()
    captured = capsys.readouterr()
    # The default basicConfig StreamHandler may have written the formatted
    # log record to stderr — that's fine, the logger is responsible. What
    # we don't want is a direct sys.stderr.write of the raw "diag.heartbeat ..."
    # line BYPASSING the logger.
    if captured.err:
        # If stderr has output, every line must be a formatted log record
        # (which always contains the level name).
        for line in captured.err.splitlines():
            if line.strip():
                assert "diag.heartbeat" not in line or "INFO" in line
