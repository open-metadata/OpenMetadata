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
"""Heartbeat output format and step-status rendering."""

import logging

from metadata.ingestion.diagnostics.collectors.http import HttpTracker
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.collectors.stage_progress import StageProgressCollector
from metadata.ingestion.diagnostics.config import DiagnosticsConfig
from metadata.ingestion.diagnostics.handler import DiagnosticsHandler
from metadata.ingestion.diagnostics.monitors.watchdog import Watchdog
from metadata.ingestion.diagnostics.samplers.memory import MemoryTracker
from metadata.ingestion.diagnostics.samplers.time_accounting import TimeAccountingSampler


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


def _make_handler(workflow=None, registry=None):
    config = DiagnosticsConfig()
    registry = registry or OperationRegistry()
    memory = MemoryTracker()
    aspects = [
        registry,
        HttpTracker(),
        memory,
        TimeAccountingSampler(registry),
        StageProgressCollector(),
    ]
    return DiagnosticsHandler(
        config=config,
        aspects=aspects,
        watchdog=Watchdog(registry, memory, config),
        db_introspector=None,
        workflow=workflow,
    )


def _emit_once(handler, caplog) -> str:
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        handler.emit_heartbeat()
    return "\n".join(record.getMessage() for record in caplog.records)


def test_heartbeat_emits_required_fields(caplog):
    out = _emit_once(_make_handler(), caplog)
    assert out.startswith("diag.heartbeat")
    for key in ("tick=", "pid=", "threads=", "rss=", "rss_delta_30s=", "active_http=", "main_op="):
        assert key in out


def test_heartbeat_renders_step_progress(caplog):
    steps = [
        _FakeStep("Source", _FakeStatus(record_count=42, failures=["e1"])),
        _FakeStep("Sink", _FakeStatus(record_count=40, failures=[])),
    ]
    out = _emit_once(_make_handler(workflow=_FakeWorkflow(steps)), caplog)
    assert "steps=[Source=42/1err,Sink=40/0err]" in out


def test_heartbeat_renders_main_thread_operation(caplog):
    registry = OperationRegistry()
    registry.push("source.iter", {"entity": "x"})
    out = _emit_once(_make_handler(registry=registry), caplog)
    assert "main_op=source.iter(" in out


def test_heartbeat_handles_broken_step_status_gracefully(caplog):
    class _BadStep:
        name = "Bad"

        def get_status(self):
            raise RuntimeError("boom")

    out = _emit_once(_make_handler(workflow=_FakeWorkflow([_BadStep()])), caplog)
    assert out.startswith("diag.heartbeat")


def test_heartbeat_emits_at_info_level(caplog):
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        _make_handler().emit_heartbeat()
    levels = {r.levelname for r in caplog.records if r.message.startswith("diag.heartbeat")}
    assert levels == {"INFO"}


def test_heartbeat_does_not_write_directly_to_stderr(caplog, capsys):
    with caplog.at_level(logging.INFO, logger="metadata.Diagnostics"):
        _make_handler().emit_heartbeat()
    captured = capsys.readouterr()
    if captured.err:
        for line in captured.err.splitlines():
            if line.strip():
                assert "diag.heartbeat" not in line or "INFO" in line
