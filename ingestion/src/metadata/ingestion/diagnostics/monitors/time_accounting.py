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
Workflow time-accounting via operation-registry sampling.

A daemon thread samples every 100 ms and answers, on its own, where the
workflow spent its wall clock:

  * How long did the workflow take, and how much was active vs idle?
  * Within active time, how much was DB queries, OMeta HTTP, source
    iteration, sink writes, etc.? (coarse `by_category`, from the deepest
    registered op on each thread)
  * Which code methods accumulated the most wall-clock? (`top_methods`)

Category vs method
------------------
Two complementary cuts come from one tick:

  * `by_category` reads the deepest *registered op* on each thread
    (`source.iter`, `{dialect}.query`, `ometa.http`, ...) for a semantic
    split, plus the active/idle wall-clock breakdown.
  * `top_methods` reads the deepest *Python stack frame* of each active
    thread via `sys._current_frames()` and credits the interval to that
    method. When a thread is blocked in a C call (e.g. `cursor.execute`),
    the deepest Python frame is the caller that issued it, so query wait
    time attributes to the method responsible (e.g. `get_columns`) — a
    statistical profile, with no per-query/per-table cardinality.

Only threads the registry marks active are credited, so idle workers and
the diagnostics daemons themselves never pollute the profile. The method
key space is bounded by the codebase and capped with an `(other)` backstop.

Perf
----
At 100 ms cadence: ~10 ticks/sec x a snapshot + one `sys._current_frames()`
read = negligible CPU, all on the sampler thread.
"""

from __future__ import annotations

import sys
import threading
import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from types import FrameType

    from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry

_DIAGNOSTICS_PACKAGE = "/diagnostics/"
_METHOD_LIMIT = 200
_OVERFLOW_KEY = "(other)"


def _categorize(op_name: str) -> str:
    """Map an op name to a coarse category for the time budget."""
    if op_name == "workflow.execute":
        return "idle"
    if op_name == "ometa.http":
        return "ometa_http"
    if op_name.endswith(".query"):
        return "db"
    if op_name == "source.iter":
        return "source"
    if op_name == "sink.write":
        return "sink"
    if op_name == "processor.run":
        return "processor"
    if op_name == "stage.run":
        return "stage"
    if op_name == "bulksink.run":
        return "bulksink"
    return "other"


class TimeAccountingSampler:
    """Samples the registry and the call stack, accumulating wall-clock time.

    A plain object (not a thread): a Monitor drives `tick()` on an interval.
    `sample()` is also called directly by tests with deterministic deltas
    and synthetic frames.
    """

    def __init__(self, registry: OperationRegistry) -> None:
        self._registry = registry
        self._lock = threading.Lock()
        self._totals: dict[str, float] = defaultdict(float)
        self._method_times: dict[str, float] = defaultdict(float)
        self._active_walltime: float = 0.0
        self._idle_walltime: float = 0.0
        self._sample_count: int = 0
        self._started_at = time.monotonic()
        self._last_tick = time.monotonic()

    def tick(self) -> None:
        now = time.monotonic()
        delta = now - self._last_tick
        self._last_tick = now
        self.sample(delta, sys._current_frames())

    def sample(self, delta: float, frames: dict[int, FrameType] | None = None) -> None:
        """Record one sample worth `delta` seconds.

        Public so tests can drive the sampler with deterministic ticks and
        synthetic `frames`. One lock acquisition for the whole update.
        """
        deepest = self._registry.deepest_per_thread()
        active_categories: set[str] = set()
        with self._lock:
            for tid, (op_name, _kwargs, _age) in deepest.items():
                category = _categorize(op_name)
                if category != "idle":
                    active_categories.add(category)
                    self._credit_method(delta, frames, tid)
            self._sample_count += 1
            if active_categories:
                for category in active_categories:
                    self._totals[category] += delta
                self._active_walltime += delta
            else:
                self._idle_walltime += delta

    def _credit_method(self, delta: float, frames: dict[int, FrameType] | None, tid: int) -> None:
        if frames is not None:
            method = _frame_method(frames.get(tid))
            if method:
                key = (
                    method if method in self._method_times or len(self._method_times) < _METHOD_LIMIT else _OVERFLOW_KEY
                )
                self._method_times[key] += delta

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            elapsed = time.monotonic() - self._started_at
            return {
                "elapsed_seconds": elapsed,
                "samples": self._sample_count,
                "active_walltime": self._active_walltime,
                "idle_walltime": self._idle_walltime,
                "categories": dict(self._totals),
                "top_methods": sorted(self._method_times.items(), key=lambda kv: -kv[1])[:10],
            }

    def render(self, prefix: str = "diag.time_budget") -> str | None:
        """Render the end-of-workflow time budget as one structured line.

        Returns None when no samples were taken so `emit_report` skips it.
        """
        snap = self.snapshot()
        elapsed = snap["elapsed_seconds"]
        if elapsed <= 0 or snap["samples"] == 0:
            return None

        active = snap["active_walltime"]
        idle = snap["idle_walltime"]
        active_pct = active / elapsed * 100
        idle_pct = idle / elapsed * 100

        cats = snap["categories"]
        ordered = ("db", "ometa_http", "source", "sink", "processor", "stage", "bulksink", "other")
        cat_parts = [
            f"{name}={cats[name]:.1f}s({cats[name] / elapsed * 100:.0f}%)" for name in ordered if cats.get(name, 0) > 0
        ]

        method_parts = [f"{name}={t:.1f}s" for name, t in snap["top_methods"][:5] if t > 0]

        return (
            f"{prefix} "
            f"elapsed={elapsed:.1f}s "
            f"samples={snap['samples']} "
            f"active={active:.1f}s({active_pct:.1f}%) "
            f"idle={idle:.1f}s({idle_pct:.1f}%) "
            f"by_category=[{','.join(cat_parts)}] "
            f"top_methods=[{','.join(method_parts)}]"
        )


def _frame_method(frame: FrameType | None) -> str:
    """Key for the deepest stack frame outside the diagnostics machinery."""
    current = frame
    while current is not None and _DIAGNOSTICS_PACKAGE in current.f_code.co_filename:
        current = current.f_back
    return _frame_key(current) if current is not None else ""


def _frame_key(frame: FrameType) -> str:
    code = frame.f_code
    qualname = getattr(code, "co_qualname", code.co_name)
    return f"{_short_path(code.co_filename)}:{qualname}"


def _short_path(path: str) -> str:
    for marker in ("/site-packages/", "/src/"):
        index = path.rfind(marker)
        if index != -1:
            return path[index + len(marker) :]
    return path.rsplit("/", 1)[-1]
