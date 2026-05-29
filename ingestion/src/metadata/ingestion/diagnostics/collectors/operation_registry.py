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
Per-thread operation registry.

Each thread maintains a stack of `(name, kwargs, started_monotonic)`. The
deepest entry is "what this thread is doing right now". The watchdog and
heartbeat threads call `snapshot()` to see the live state of every thread.
"""

import heapq
import sys
import threading
import time
from collections import defaultdict
from typing import Any, TextIO

from metadata.ingestion.diagnostics.attribution import op_identity
from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.formatting import fmt_age

# Self-protection bounds on the registry itself (mechanism, not operator policy):
# cap per-thread op-stack growth and truncate stored kwargs (SQL/URLs can be huge)
# so the observer never becomes the memory/output problem it watches for.
KWARGS_TRUNCATION_CHARS = 2000
OP_STACK_DEPTH_CAP = 20
SLOW_OPS_CAP = 50

# Structural/wrapper ops whose span is a whole phase, not a unit of work — excluded
# from slow_ops so they don't crowd out the actual slow I/O calls (db/http/sink).
_NON_LEAF_OPS = frozenset({"workflow.execute", "source.iter", "stage.run", "processor.run", "bulksink.run"})


class OperationRegistry:
    """Thread-safe per-thread operation stack.

    The shared operation *source*: a Collector that renders its own op-stack
    fragment / main-op field, and that monitors and the time Sampler query.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # thread_id -> list of (name, kwargs, started_monotonic, token)
        self._stacks: dict[int, list[tuple[str, dict[str, Any], float, int]]] = {}
        self._token_counter = 0
        self._counts: dict[str, int] = defaultdict(int)
        # min-heap of (duration, seq, op_name, method) — the slowest single calls
        self._slow: list[tuple[float, int, str, str]] = []
        self._slow_seq = 0

    def push(self, name: str, kwargs: dict[str, Any]) -> int:
        """Push a new operation for the calling thread. Returns a token used by pop()."""
        tid = threading.get_ident()
        truncated = _truncate_kwargs(kwargs)
        now = time.monotonic()
        with self._lock:
            self._token_counter += 1
            token = self._token_counter
            stack = self._stacks.setdefault(tid, [])
            if len(stack) >= OP_STACK_DEPTH_CAP:
                # Refuse to grow. Returning -1 means pop() is a no-op for
                # this entry, but the caller's `with` block still works.
                return -1
            stack.append((name, truncated, now, token))
        return token

    def pop(self, token: int) -> None:
        """Pop the operation identified by `token`.

        We match by token (not "always the top") so that a misnested
        operation() — e.g. due to a generator that didn't get fully
        consumed — doesn't desync the stack permanently.
        """
        if token < 0:
            return
        tid = threading.get_ident()
        now = time.monotonic()
        with self._lock:
            stack = self._stacks.get(tid)
            if not stack:
                return
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][3] == token:
                    name, kwargs, started, _ = stack[i]
                    self._counts[name] += 1
                    self._record_slow(name, kwargs, now - started)
                    del stack[i:]
                    break
            if not stack:
                del self._stacks[tid]

    def _record_slow(self, name: str, kwargs: dict[str, Any], duration: float) -> None:
        """Tail-sampled top-N slowest single calls. Resolves the op identity
        (HTTP endpoint, else issuing method) ONLY when a call enters the top-N —
        outliers are rare, so the per-call cost stays a duration compare. Wrapper
        ops (whole-phase spans) are skipped so they don't bury the real slow
        work. Caller holds the lock."""
        if name not in _NON_LEAF_OPS and (len(self._slow) < SLOW_OPS_CAP or duration > self._slow[0][0]):
            identity = op_identity(name, kwargs, sys._getframe())
            self._slow_seq += 1
            entry = (duration, self._slow_seq, name, identity)
            if len(self._slow) < SLOW_OPS_CAP:
                heapq.heappush(self._slow, entry)
            else:
                heapq.heappushpop(self._slow, entry)

    def snapshot(self) -> dict[int, list[tuple[str, dict[str, Any], float]]]:
        """Return a copy of every thread's current op stack with `(name, kwargs, age_seconds)`."""
        now = time.monotonic()
        out: dict[int, list[tuple[str, dict[str, Any], float]]] = {}
        with self._lock:
            for tid, stack in self._stacks.items():
                out[tid] = [(name, kwargs, now - started) for (name, kwargs, started, _) in stack]
        return out

    def deepest_per_thread(self) -> dict[int, tuple[str, dict[str, Any], float]]:
        """For each thread, the bottom-most (most recently entered) operation."""
        snap = self.snapshot()
        return {tid: stack[-1] for tid, stack in snap.items() if stack}

    def counts(self) -> dict[str, int]:
        """Exact per-op call counts (incremented on every pop)."""
        with self._lock:
            return dict(self._counts)

    def slow_ops(self) -> list[tuple[float, str, str]]:
        """Slowest single calls as `(duration, op_name, method)`, slowest first."""
        with self._lock:
            ordered = sorted(self._slow, reverse=True)
        return [(duration, name, method) for (duration, _seq, name, method) in ordered]

    def gc_dead_threads(self, alive_idents: set) -> None:
        """Drop entries for threads that no longer exist."""
        with self._lock:
            dead = [tid for tid in self._stacks if tid not in alive_idents]
            for tid in dead:
                del self._stacks[tid]

    def render_instant(self) -> str:
        """The heartbeat ` main_op=name(age)` field for the main thread (`-` if idle)."""
        main_ident = threading.main_thread().ident
        main_op = "-"
        if main_ident is not None:
            deepest = self.deepest_per_thread().get(main_ident)
            if deepest:
                op_name, _kwargs, age = deepest
                main_op = f"{op_name}({fmt_age(age)})"
        return f" main_op={main_op}"

    def render_dump(self, out: TextIO) -> None:
        out.write(f"{DIAG_LOG_PREFIX}.dump.ops\n")
        snapshot = self.snapshot()
        if not snapshot:
            out.write("  (no active operations)\n")
            return
        name_by_ident = {t.ident: t.name for t in threading.enumerate() if t.ident}
        for tid, stack in snapshot.items():
            thread_name = name_by_ident.get(tid, f"tid-{tid}")
            out.write(f"  thread={thread_name}({tid})\n")
            for name, kwargs, age in stack:
                out.write(f"    -> {format_op_frame(name, kwargs, age)}\n")


def _truncate_kwargs(kwargs: dict[str, Any]) -> dict[str, Any]:
    """Keep references small: long strings get truncated, non-str values stringified."""
    out: dict[str, Any] = {}
    for key, value in kwargs.items():
        if isinstance(value, str):
            if len(value) > KWARGS_TRUNCATION_CHARS:
                out[key] = value[:KWARGS_TRUNCATION_CHARS] + f"...(+{len(value) - KWARGS_TRUNCATION_CHARS} chars)"
            else:
                out[key] = value
        else:
            try:
                s = repr(value)
            except Exception:
                s = "<unreprable>"
            if len(s) > KWARGS_TRUNCATION_CHARS:
                s = s[:KWARGS_TRUNCATION_CHARS] + f"...(+{len(s) - KWARGS_TRUNCATION_CHARS} chars)"
            out[key] = s
    return out


def format_op_frame(name: str, kwargs: dict[str, Any], age: float) -> str:
    """Single-line rendering of one op-stack frame for dump output."""
    if kwargs:
        kvs = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
        return f"{name} ({fmt_age(age)}) {kvs}"
    return f"{name} ({fmt_age(age)})"
