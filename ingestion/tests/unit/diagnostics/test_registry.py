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
"""Unit tests for the diagnostics operation registry."""

import threading
import time

from metadata.ingestion.diagnostics.collectors import operation_registry
from metadata.ingestion.diagnostics.collectors.operation_registry import (
    SLOW_OPS_CAP,
    OperationRegistry,
    _truncate_kwargs,
    format_op_frame,
)


def test_push_pop_basic():
    registry = OperationRegistry()
    token = registry.push("op.a", {"foo": "bar"})
    snap = registry.snapshot()
    tid = threading.get_ident()
    assert tid in snap
    assert snap[tid][0][0] == "op.a"
    assert snap[tid][0][1] == {"foo": "bar"}
    registry.pop(token)
    assert tid not in registry.snapshot()


def test_nested_push_pop_ordering():
    registry = OperationRegistry()
    outer = registry.push("op.outer", {})
    inner = registry.push("op.inner", {})
    tid = threading.get_ident()
    stack = registry.snapshot()[tid]
    assert [frame[0] for frame in stack] == ["op.outer", "op.inner"]
    registry.pop(inner)
    assert [frame[0] for frame in registry.snapshot()[tid]] == ["op.outer"]
    registry.pop(outer)
    assert tid not in registry.snapshot()


def test_pop_by_token_handles_misnest():
    """If frames are popped out of order we still desync gracefully."""
    registry = OperationRegistry()
    outer = registry.push("op.outer", {})
    inner = registry.push("op.inner", {})
    registry.pop(outer)  # outer popped before inner — same as a generator left open
    tid = threading.get_ident()
    # Outer + inner both gone — pop drops the slice
    assert tid not in registry.snapshot()
    registry.pop(inner)  # second pop is a no-op, must not raise


def test_kwargs_truncated_to_keep_references_small():
    big = "x" * 5000
    truncated = _truncate_kwargs({"sql": big})
    assert len(truncated["sql"]) < len(big)
    assert "+3000 chars" in truncated["sql"]


def test_kwargs_non_str_stringified():
    truncated = _truncate_kwargs({"count": 42, "obj": ["a", "b"]})
    assert truncated["count"] == "42"
    assert truncated["obj"] == "['a', 'b']"


def test_deepest_per_thread_returns_innermost():
    registry = OperationRegistry()
    registry.push("op.outer", {})
    registry.push("op.inner", {"k": "v"})
    deepest = registry.deepest_per_thread()
    tid = threading.get_ident()
    assert deepest[tid][0] == "op.inner"
    assert deepest[tid][1] == {"k": "v"}


def test_age_is_monotonic_seconds():
    registry = OperationRegistry()
    registry.push("op.long", {})
    time.sleep(0.02)
    age = registry.snapshot()[threading.get_ident()][0][2]
    assert age >= 0.02


def test_stack_depth_cap_prevents_runaway():
    registry = OperationRegistry()
    # Push more than the cap (20 by default)
    tokens = [registry.push(f"op.{i}", {}) for i in range(30)]
    tid = threading.get_ident()
    stack = registry.snapshot()[tid]
    assert len(stack) <= 20
    for token in tokens:
        registry.pop(token)


def test_format_op_frame_human_readable():
    rendered = format_op_frame("ometa.http", {"method": "GET", "url": "/api/v1/tables"}, 0.5)
    assert "ometa.http" in rendered
    assert "500ms" in rendered
    assert "method=" in rendered


def test_gc_dead_threads_clears_entries():
    registry = OperationRegistry()
    # Register an op from a worker thread, let the thread die
    done = threading.Event()

    def worker():
        registry.push("op.worker", {})
        done.set()

    t = threading.Thread(target=worker)
    t.start()
    done.wait()
    t.join()

    assert t.ident in registry.snapshot()
    registry.gc_dead_threads({threading.get_ident()})
    assert t.ident not in registry.snapshot()


def test_counts_are_exact_per_op():
    registry = OperationRegistry()
    for _ in range(5):
        registry.pop(registry.push("db.query", {}))
    registry.pop(registry.push("ometa.http", {"url": "/api/v1/tables"}))

    assert registry.counts() == {"db.query": 5, "ometa.http": 1}


def test_slow_ops_keeps_slowest_first_with_method(monkeypatch):
    clock = {"now": 0.0}
    monkeypatch.setattr(operation_registry.time, "monotonic", lambda: clock["now"])
    registry = OperationRegistry()

    for name, duration in [("a.query", 1.0), ("b.query", 5.0), ("c.query", 0.1)]:
        clock["now"] = 0.0
        token = registry.push(name, {})
        clock["now"] = duration
        registry.pop(token)

    slow = registry.slow_ops()
    assert [op_name for _duration, op_name, _method in slow] == ["b.query", "a.query", "c.query"]
    assert slow[0][0] == 5.0
    assert all(method for _d, _n, method in slow)  # issuing method attributed


def test_slow_ops_is_bounded(monkeypatch):
    clock = {"now": 0.0}
    monkeypatch.setattr(operation_registry.time, "monotonic", lambda: clock["now"])
    registry = OperationRegistry()

    for i in range(SLOW_OPS_CAP * 3):
        clock["now"] = 0.0
        token = registry.push("q", {})
        clock["now"] = float(i)
        registry.pop(token)

    slow = registry.slow_ops()
    assert len(slow) == SLOW_OPS_CAP
    assert slow[0][0] == float(SLOW_OPS_CAP * 3 - 1)  # the single slowest is retained


def test_slow_ops_excludes_wrapper_ops(monkeypatch):
    clock = {"now": 0.0}
    monkeypatch.setattr(operation_registry.time, "monotonic", lambda: clock["now"])
    registry = OperationRegistry()

    # wrapper ops span whole phases and are the "slowest", but must not appear
    for name in ("workflow.execute", "source.iter", "db.query"):
        clock["now"] = 0.0
        token = registry.push(name, {})
        clock["now"] = 100.0
        registry.pop(token)

    op_names = {op_name for _duration, op_name, _method in registry.slow_ops()}
    assert op_names == {"db.query"}
