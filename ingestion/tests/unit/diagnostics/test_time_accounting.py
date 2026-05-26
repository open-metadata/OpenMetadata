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
"""Time-accounting sampler — categorization, active/idle, multi-thread."""

import threading
import time

import pytest

from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.monitors.monitor import Monitor
from metadata.ingestion.diagnostics.monitors.time_accounting import (
    TimeAccountingSampler,
    _categorize,
)

# ---- categorization ----


@pytest.mark.parametrize(
    "op_name,expected",
    [
        ("workflow.execute", "idle"),
        ("ometa.http", "ometa_http"),
        ("snowflake.query", "db"),
        ("postgresql.query", "db"),
        ("redshift.query", "db"),
        ("sqlite.query", "db"),
        ("source.iter", "source"),
        ("sink.write", "sink"),
        ("processor.run", "processor"),
        ("stage.run", "stage"),
        ("bulksink.run", "bulksink"),
        ("something.else", "other"),
    ],
)
def test_categorize_known_op_names(op_name, expected):
    assert _categorize(op_name) == expected


# ---- sampling: idle ----


def test_sampler_credits_idle_when_no_ops():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=1.0)
    snap = sampler.snapshot()
    assert snap["idle_walltime"] == 1.0
    assert snap["active_walltime"] == 0.0
    assert snap["categories"] == {}


def test_sampler_credits_idle_when_only_workflow_execute_on_stack():
    """workflow.execute alone means we're in execute_internal but no step is active."""
    registry = OperationRegistry()
    registry.push("workflow.execute", {})
    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=2.0)
    snap = sampler.snapshot()
    assert snap["idle_walltime"] == 2.0
    assert snap["active_walltime"] == 0.0
    # workflow.execute does get op_time credit (for the top_ops breakdown)
    # but does NOT get category credit.
    assert "idle" not in snap["categories"]


# ---- sampling: active ----


def test_sampler_credits_db_during_query():
    registry = OperationRegistry()
    registry.push("snowflake.query", {"sql": "SELECT 1"})
    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=0.5)
    snap = sampler.snapshot()
    assert snap["active_walltime"] == 0.5
    assert snap["idle_walltime"] == 0.0
    assert snap["categories"] == {"db": 0.5}


def test_sampler_credits_source_during_iter():
    registry = OperationRegistry()
    registry.push("workflow.execute", {})
    registry.push("source.iter", {})
    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=0.3)
    snap = sampler.snapshot()
    assert snap["categories"]["source"] == 0.3
    assert snap["active_walltime"] == 0.3


# ---- sampling: multi-thread ----


def test_multithread_main_idle_worker_active_counts_as_active():
    """If a worker is running a query while main is on workflow.execute,
    the tick is active (any thread doing something)."""
    registry = OperationRegistry()
    # Main thread on workflow.execute
    registry._stacks[threading.get_ident()] = [("workflow.execute", {}, time.monotonic(), 1)]
    # Worker thread on snowflake.query
    fake_worker_tid = threading.get_ident() + 1
    registry._stacks[fake_worker_tid] = [("snowflake.query", {"sql": "x"}, time.monotonic(), 2)]

    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=1.0)
    snap = sampler.snapshot()
    assert snap["active_walltime"] == 1.0
    assert snap["idle_walltime"] == 0.0
    assert snap["categories"].get("db") == 1.0
    # 'idle' must NOT appear as a category — it's only tracked via
    # idle_walltime.
    assert "idle" not in snap["categories"]


def test_multithread_two_categories_both_credited():
    """Source iterating + DB query in parallel: both buckets get the delta."""
    registry = OperationRegistry()
    registry._stacks[threading.get_ident()] = [("source.iter", {}, time.monotonic(), 1)]
    other_tid = threading.get_ident() + 99
    registry._stacks[other_tid] = [("snowflake.query", {}, time.monotonic(), 2)]

    sampler = TimeAccountingSampler(registry)
    sampler.sample(delta=0.4)
    snap = sampler.snapshot()
    assert snap["categories"]["source"] == 0.4
    assert snap["categories"]["db"] == 0.4
    assert snap["active_walltime"] == 0.4
    # Categories may sum > active_walltime due to parallelism.
    assert sum(snap["categories"].values()) > snap["active_walltime"]


# ---- accumulation across multiple samples ----


def test_accumulates_across_samples():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    registry.push("snowflake.query", {})
    sampler.sample(0.1)
    sampler.sample(0.1)
    sampler.sample(0.1)
    snap = sampler.snapshot()
    assert snap["categories"]["db"] == pytest.approx(0.3, rel=1e-6)
    assert snap["samples"] == 3


def test_idle_and_active_can_both_accumulate_in_one_run():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    sampler.sample(0.2)  # idle
    token = registry.push("snowflake.query", {})
    sampler.sample(0.2)  # db
    sampler.sample(0.2)  # db
    registry.pop(token)
    sampler.sample(0.2)  # idle again
    snap = sampler.snapshot()
    assert snap["idle_walltime"] == pytest.approx(0.4, rel=1e-6)
    assert snap["active_walltime"] == pytest.approx(0.4, rel=1e-6)
    assert snap["categories"]["db"] == pytest.approx(0.4, rel=1e-6)


# ---- method sampling ----


class _FakeCode:
    def __init__(self, filename: str, qualname: str) -> None:
        self.co_filename = filename
        self.co_qualname = qualname
        self.co_name = qualname.rsplit(".", 1)[-1]


class _FakeFrame:
    def __init__(self, filename: str, qualname: str, back: "_FakeFrame | None" = None) -> None:
        self.f_code = _FakeCode(filename, qualname)
        self.f_back = back


_GET_COLUMNS_FRAME = _FakeFrame(
    "/env/src/metadata/ingestion/source/database/snowflake/metadata.py",
    "SnowflakeSource.get_columns",
)
_GET_COLUMNS_KEY = "metadata/ingestion/source/database/snowflake/metadata.py:SnowflakeSource.get_columns"


def test_method_sampling_credits_active_thread_frame():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    tid = threading.get_ident()
    registry.push("snowflake.query", {"sql": "SELECT 1"})
    sampler.sample(0.2, {tid: _GET_COLUMNS_FRAME})
    sampler.sample(0.2, {tid: _GET_COLUMNS_FRAME})
    methods = dict(sampler.snapshot()["top_methods"])
    assert methods[_GET_COLUMNS_KEY] == pytest.approx(0.4)


def test_method_sampling_skips_idle_threads():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    tid = threading.get_ident()
    registry.push("workflow.execute", {})
    sampler.sample(0.2, {tid: _GET_COLUMNS_FRAME})
    assert sampler.snapshot()["top_methods"] == []


def test_method_sampling_skips_diagnostics_frames():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    tid = threading.get_ident()
    registry.push("snowflake.query", {})
    diagnostics_frame = _FakeFrame(
        "/env/src/metadata/ingestion/diagnostics/monitors/time_accounting.py",
        "TimeAccountingSampler.tick",
        back=_GET_COLUMNS_FRAME,
    )
    sampler.sample(0.3, {tid: diagnostics_frame})
    assert _GET_COLUMNS_KEY in dict(sampler.snapshot()["top_methods"])


def test_method_sampling_without_frames_is_noop():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    registry.push("snowflake.query", {})
    sampler.sample(0.2)
    assert sampler.snapshot()["top_methods"] == []


def test_method_sampling_caps_distinct_keys(monkeypatch):
    from metadata.ingestion.diagnostics.monitors import time_accounting

    monkeypatch.setattr(time_accounting, "_METHOD_LIMIT", 2)
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    tid = threading.get_ident()
    registry.push("snowflake.query", {})
    for index in range(5):
        sampler.sample(0.1, {tid: _FakeFrame(f"/env/src/metadata/m{index}.py", f"fn{index}")})
    methods = dict(sampler.snapshot()["top_methods"])
    assert "(other)" in methods
    assert len([key for key in methods if key != "(other)"]) <= 2


# ---- summary line ----


def test_summary_line_includes_required_fields():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    tid = threading.get_ident()
    registry.push("snowflake.query", {})
    sampler.sample(0.2, {tid: _GET_COLUMNS_FRAME})
    sampler.sample(0.2, {tid: _GET_COLUMNS_FRAME})
    line = sampler.render()
    for key in ("elapsed=", "samples=", "active=", "idle=", "by_category=", "top_methods="):
        assert key in line
    assert "db=" in line
    assert "get_columns" in line


def test_render_returns_none_for_zero_samples():
    """Before any sample is taken, render() returns None so emit_report skips it."""
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    assert sampler.render() is None


# ---- thread lifecycle smoke test ----


def test_monitor_runs_sampler_and_can_be_stopped_quickly():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    monitor = Monitor("diag-time-accounting", 0.05, sampler.tick)
    monitor.start()
    time.sleep(0.15)  # let it tick 2-3 times
    monitor.stop()
    monitor.join(timeout=1.0)
    assert not monitor.is_alive()
    snap = sampler.snapshot()
    # At least one tick should have happened
    assert snap["samples"] >= 1
