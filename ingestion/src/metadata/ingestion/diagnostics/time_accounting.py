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

A daemon thread samples the registry every 100 ms, looks at the deepest
op on each thread, and credits the elapsed interval to a category
bucket. At workflow end we emit one `diag.time_budget` line that
answers, on its own:

  * How long did the workflow take wall-clock?
  * What fraction of that was "doing something" (active) vs "doing
    nothing" (idle)?
  * Within active time, how much was DB queries, OMeta HTTP, source
    iteration, sink writes, etc.?
  * Which specific ops took the most time?

Categorization
--------------
The deepest op on a thread defines the category:

  * `workflow.execute` (only thing on stack)  -> idle (not credited to
    any category, but `idle_walltime` is incremented)
  * `{dialect}.query`                          -> db
  * `ometa.http`                               -> ometa_http
  * `source.iter`                              -> source
  * `sink.write`                               -> sink
  * `processor.run`                            -> processor
  * `stage.run` / `bulksink.run`               -> stage / bulksink
  * anything else                              -> other

If MULTIPLE threads are active in the same tick (e.g., main is iterating
the source while a worker thread is running a SQL query), each
contributing category gets credited for that tick. As a result, the
per-category totals may sum to more than `active_walltime` — that's the
expected behavior under multithread sources, and the summary line
documents it.

Perf
----
At 100 ms cadence: ~10 ticks/sec x ~5 us per snapshot = ~50 us/sec =
0.005% CPU. The sampler thread holds the registry's lock only for the
duration of `snapshot()`, which is O(threads).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from metadata.ingestion.diagnostics.registry import OperationRegistry

TIME_ACCOUNTING_INTERVAL_SECONDS = 0.1


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


class TimeAccountingSampler(threading.Thread):
    """Daemon thread that samples the registry and accumulates per-category time."""

    def __init__(
        self,
        registry: OperationRegistry,
        interval: float = TIME_ACCOUNTING_INTERVAL_SECONDS,
    ) -> None:
        super().__init__(name="diag-time-accounting", daemon=True)
        self._registry = registry
        self._interval = interval
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._totals: dict[str, float] = defaultdict(float)
        self._op_times: dict[str, float] = defaultdict(float)
        self._active_walltime: float = 0.0
        self._idle_walltime: float = 0.0
        self._sample_count: int = 0
        self._started_at = time.monotonic()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        last_tick = time.monotonic()
        while not self._stop_event.wait(self._interval):
            now = time.monotonic()
            delta = now - last_tick
            last_tick = now
            try:
                self.sample(delta)
            except Exception:
                # Diagnostics must never break the workflow it monitors.
                continue

    def sample(self, delta: float) -> None:
        """Record one sample worth `delta` seconds.

        Public so tests can drive the sampler with deterministic ticks
        instead of waiting for the real cadence.

        One lock acquisition for the whole update — sample() runs only
        from this daemon thread; the lock protects readers from
        `snapshot()` and ensures they see a consistent post-tick state
        rather than partial mutations.
        """
        deepest = self._registry.deepest_per_thread()
        active_categories: set[str] = set()
        with self._lock:
            for op_name, _kwargs, _age in deepest.values():
                category = _categorize(op_name)
                if category != "idle":
                    active_categories.add(category)
                self._op_times[op_name] += delta
            self._sample_count += 1
            if active_categories:
                for cat in active_categories:
                    self._totals[cat] += delta
                self._active_walltime += delta
            else:
                self._idle_walltime += delta

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            elapsed = time.monotonic() - self._started_at
            return {
                "elapsed_seconds": elapsed,
                "samples": self._sample_count,
                "active_walltime": self._active_walltime,
                "idle_walltime": self._idle_walltime,
                "categories": dict(self._totals),
                "top_ops": sorted(self._op_times.items(), key=lambda kv: -kv[1])[:10],
            }

    def summary_log_line(self, prefix: str = "diag.time_budget") -> str:
        """Render the end-of-workflow summary as one structured line."""
        snap = self.snapshot()
        elapsed = snap["elapsed_seconds"]
        if elapsed <= 0 or snap["samples"] == 0:
            return f"{prefix} elapsed={elapsed:.1f}s samples={snap['samples']} (no data)"

        active = snap["active_walltime"]
        idle = snap["idle_walltime"]
        active_pct = active / elapsed * 100
        idle_pct = idle / elapsed * 100

        cats = snap["categories"]
        ordered = ("db", "ometa_http", "source", "sink", "processor", "stage", "bulksink", "other")
        cat_parts = [
            f"{name}={cats[name]:.1f}s({cats[name] / elapsed * 100:.0f}%)" for name in ordered if cats.get(name, 0) > 0
        ]

        top_parts = [f"{name}={t:.1f}s" for name, t in snap["top_ops"][:5] if t > 0]

        return (
            f"{prefix} "
            f"elapsed={elapsed:.1f}s "
            f"samples={snap['samples']} "
            f"active={active:.1f}s({active_pct:.1f}%) "
            f"idle={idle:.1f}s({idle_pct:.1f}%) "
            f"by_category=[{','.join(cat_parts)}] "
            f"top_ops=[{','.join(top_parts)}]"
        )
