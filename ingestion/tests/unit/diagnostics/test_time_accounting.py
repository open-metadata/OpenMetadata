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

from metadata.ingestion.diagnostics.registry import OperationRegistry
from metadata.ingestion.diagnostics.time_accounting import (
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
    assert "workflow.execute" in dict(snap["top_ops"])
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


# ---- top_ops ----


def test_top_ops_sorted_by_time():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    t1 = registry.push("snowflake.query", {"sql": "a"})
    sampler.sample(0.5)
    registry.pop(t1)
    t2 = registry.push("ometa.http", {"method": "GET"})
    sampler.sample(0.1)
    registry.pop(t2)
    snap = sampler.snapshot()
    top = snap["top_ops"]
    # Both ops appear, snowflake.query first because it accumulated more time
    names = [name for name, _ in top]
    assert names[0] == "snowflake.query"
    assert "ometa.http" in names


# ---- summary line ----


def test_summary_line_includes_required_fields():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    registry.push("snowflake.query", {})
    sampler.sample(0.2)
    sampler.sample(0.2)
    line = sampler.summary_log_line()
    for key in ("elapsed=", "samples=", "active=", "idle=", "by_category=", "top_ops="):
        assert key in line
    assert "db=" in line
    assert "snowflake.query=" in line


def test_summary_line_handles_zero_samples():
    """Before any sample is taken, the summary must not divide by zero."""
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry)
    line = sampler.summary_log_line()
    assert "no data" in line


# ---- thread lifecycle smoke test ----


def test_sampler_run_can_be_stopped_quickly():
    registry = OperationRegistry()
    sampler = TimeAccountingSampler(registry, interval=0.05)
    sampler.start()
    time.sleep(0.15)  # let it tick 2-3 times
    sampler.stop()
    sampler.join(timeout=1.0)
    assert not sampler.is_alive()
    snap = sampler.snapshot()
    # At least one tick should have happened
    assert snap["samples"] >= 1
