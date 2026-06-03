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

import threading
import time
from typing import Any

from metadata.ingestion.diagnostics import KWARGS_TRUNCATION_CHARS, OP_STACK_DEPTH_CAP


class OperationRegistry:
    """Thread-safe per-thread operation stack."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # thread_id -> list of (name, kwargs, started_monotonic, token)
        self._stacks: dict[int, list[tuple[str, dict[str, Any], float, int]]] = {}
        self._token_counter = 0

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
        with self._lock:
            stack = self._stacks.get(tid)
            if not stack:
                return
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][3] == token:
                    del stack[i:]
                    break
            if not stack:
                del self._stacks[tid]

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

    def gc_dead_threads(self, alive_idents: set) -> None:
        """Drop entries for threads that no longer exist."""
        with self._lock:
            dead = [tid for tid in self._stacks if tid not in alive_idents]
            for tid in dead:
                del self._stacks[tid]


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
        return f"{name} ({_fmt_age(age)}) {kvs}"
    return f"{name} ({_fmt_age(age)})"


def _fmt_age(seconds: float) -> str:
    if seconds < 1:
        return f"{int(seconds * 1000)}ms"
    if seconds < 60:
        return f"{seconds:.1f}s"
    if seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m{s:02d}s"
    h, rem = divmod(int(seconds), 3600)
    m, _ = divmod(rem, 60)
    return f"{h}h{m:02d}m"
