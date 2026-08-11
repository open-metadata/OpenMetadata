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
workflow spent its wall clock: total time, active vs idle, and within active
time a `by_op` breakdown — each op category (db, ometa_http, source, sink, ...)
with its total share AND its top contributing methods.

Method identity is chosen per op, because what discriminates time differs:

  * `ometa.http` funnels every call through one client method, so the stack
    frame is useless — we key by the **endpoint** (method + path template,
    ids collapsed) taken from the op's `url` kwarg.
  * everything else (db queries, source iteration, ...) is keyed by the
    deepest **project stack frame** (`sys._current_frames()`), which is the
    OM method that issued the work — e.g. a query blocked in the driver
    attributes to `get_columns`, not to the socket read.

Only threads the registry marks active are credited, so idle workers and the
diagnostics daemons never pollute the profile. Each category's method set is
bounded (evict-smallest into `(other)`), so cardinality stays safe.
"""

from __future__ import annotations

import sys
import threading
import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any

from metadata.ingestion.diagnostics.attribution import HTTP_OP, op_identity
from metadata.ingestion.diagnostics.formatting import fmt_age, share_bar, short_method

if TYPE_CHECKING:
    from collections.abc import Mapping
    from types import FrameType

    from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry

_METHODS_PER_OP = 50
_TOP_HOTSPOTS = 8
_OVERFLOW_KEY = "(other)"


def _categorize(op_name: str) -> str:
    """Map an op name to a coarse category for the time budget."""
    if op_name == "workflow.execute":
        return "idle"
    if op_name == HTTP_OP:
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

    A poll-driven aspect: a Monitor drives `tick()` on an interval; it renders
    its own `diag.time_budget` summary. `sample()` is also called directly by
    tests with deterministic deltas and synthetic frames.
    """

    def __init__(self, registry: OperationRegistry) -> None:
        self._registry = registry
        self._lock = threading.Lock()
        self._totals: dict[str, float] = defaultdict(float)
        self._op_methods: dict[str, dict[str, float]] = {}
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

    def sample(self, delta: float, frames: Mapping[int, FrameType] | None = None) -> None:
        """Record one sample worth `delta` seconds.

        Public so tests can drive the sampler with deterministic ticks and
        synthetic `frames`. One lock acquisition for the whole update.
        """
        deepest = self._registry.deepest_per_thread()
        active_categories: set[str] = set()
        with self._lock:
            for tid, (op_name, kwargs, _age) in deepest.items():
                category = _categorize(op_name)
                if category != "idle":
                    active_categories.add(category)
                    method = self._method_key(op_name, kwargs, frames, tid)
                    if method:
                        self._record(category, method, delta)
            self._sample_count += 1
            if active_categories:
                for category in active_categories:
                    self._totals[category] += delta
                self._active_walltime += delta
            else:
                self._idle_walltime += delta

    @staticmethod
    def _method_key(op_name: str, kwargs: dict[str, Any], frames: Mapping[int, FrameType] | None, tid: int) -> str:
        frame = frames.get(tid) if frames is not None else None
        return op_identity(op_name, kwargs, frame)

    def _record(self, category: str, method: str, delta: float) -> None:
        """Credit `method` under `category`, keeping each category's method set
        bounded by evicting its smallest into `(other)`. Newcomers are always
        admitted (the evicted one is the current minimum), so a late-appearing
        heavy method is never dropped on arrival."""
        methods = self._op_methods.setdefault(category, {})
        if method in methods:
            methods[method] += delta
        elif len(methods) < _METHODS_PER_OP:
            methods[method] = delta
        else:
            evicted = min((key for key in methods if key != _OVERFLOW_KEY), key=lambda key: methods[key])
            methods[_OVERFLOW_KEY] = methods.get(_OVERFLOW_KEY, 0.0) + methods.pop(evicted)
            methods[method] = delta

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            elapsed = time.monotonic() - self._started_at
            by_op = {
                category: sorted(methods.items(), key=lambda kv: -kv[1])
                for category, methods in self._op_methods.items()
            }
            return {
                "elapsed_seconds": elapsed,
                "samples": self._sample_count,
                "active_walltime": self._active_walltime,
                "idle_walltime": self._idle_walltime,
                "categories": dict(self._totals),
                "by_op": by_op,
            }

    def render_summary(self) -> str | None:
        """Render the end-of-workflow time budget as a structured multi-line block.

        Three sections: operations by share (with exact call counts), wall time
        by method (sampled), and slow ops (the slowest single calls). Returns
        None when no samples were taken so the summary skips it.
        """
        snap = self.snapshot()
        elapsed = snap["elapsed_seconds"]
        result = None
        if elapsed > 0 and snap["samples"] > 0:
            lines = [self._render_header("diag.time_budget", snap, elapsed)]
            lines.extend(self._render_operations(snap, elapsed))
            lines.extend(self._render_wall_time_by_method(snap, elapsed))
            lines.extend(self._render_slow_ops())
            result = "\n".join(lines)
        return result

    @staticmethod
    def _render_header(prefix: str, snap: dict[str, Any], elapsed: float) -> str:
        active = snap["active_walltime"]
        idle = snap["idle_walltime"]
        return (
            f"{prefix}\n"
            f"  elapsed={elapsed:.1f}s  "
            f"active={active / elapsed * 100:.0f}%  "
            f"idle={idle / elapsed * 100:.0f}%  "
            f"samples={snap['samples']}"
        )

    def _render_operations(self, snap: dict[str, Any], elapsed: float) -> list[str]:
        cats = snap["categories"]
        counts = self._counts_by_category()
        lines = ["  operations by share  (share · time · calls · operation)"]
        for category in sorted(cats, key=lambda name: -cats[name]):
            total = cats[category]
            pct = total / elapsed * 100
            lines.append(
                f"    {category:<11} {share_bar(pct)} {pct:>3.0f}%  {total:>7.1f}s  {counts.get(category, 0):>9,} calls"
            )
        return lines

    def _counts_by_category(self) -> dict[str, int]:
        counts: dict[str, int] = defaultdict(int)
        for op_name, count in self._registry.counts().items():
            counts[_categorize(op_name)] += count
        return counts

    @staticmethod
    def _render_wall_time_by_method(snap: dict[str, Any], elapsed: float) -> list[str]:
        by_op = snap["by_op"]
        hotspots = sorted(
            (
                (seconds, category, name)
                for category, methods in by_op.items()
                for name, seconds in methods
                if seconds > 0
            ),
            reverse=True,
        )[:_TOP_HOTSPOTS]
        lines: list[str] = []
        if hotspots:
            lines.append("  wall time by method  (time · share · operation · location)")
            lines.extend(
                f"    {seconds:>5.1f}s {seconds / elapsed * 100:>3.0f}%   {category:<11} {short_method(name)}"
                for seconds, category, name in hotspots
            )
        return lines

    def _render_slow_ops(self) -> list[str]:
        rows = self._aggregate_slow_ops_by_method()
        lines: list[str] = []
        if rows:
            lines.append("  slow ops  (slowest single call · count · operation · location)")
            lines.extend(rows)
        return lines

    def _aggregate_slow_ops_by_method(self) -> list[str]:
        """Aggregate the flat slow-call heap by method: keep each method's worst
        single call and an `xN` count of how many of the slowest tracked calls it
        owns. `slow_ops` is sorted slowest-first, so the first hit per method is
        its max; later hits only bump the count. Top `_TOP_HOTSPOTS` by max."""
        aggregated: dict[str, tuple[float, str, int]] = {}
        for duration, op_name, method in self._registry.slow_ops():
            previous = aggregated.get(method)
            if previous is None:
                aggregated[method] = (duration, op_name, 1)
            else:
                aggregated[method] = (previous[0], previous[1], previous[2] + 1)
        ordered = sorted(aggregated.items(), key=lambda item: -item[1][0])[:_TOP_HOTSPOTS]
        return [
            f"    {fmt_age(max_duration):>7}  {'x' + str(count):<4} {_categorize(op_name):<11} {short_method(method)}"
            for method, (max_duration, op_name, count) in ordered
        ]
