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
Stage backpressure collector.

Tracks the depth and put/processed counts of the inter-stage queues used
by `TopologyRunnerMixin`, so heartbeats and dumps can show "source
produced 1000, sink consumed 50, depth 950" — the signal that
distinguishes a slow source from a slow sink.

The Queue class (in `models/topology.py`) calls the module-level
`record_put` / `record_processed` / `register_queue` hooks on every
operation. When diagnostics is OFF those hooks are no-ops with a single
attribute load, so the queue stays cheap.
"""

import threading
import weakref
from typing import Any

_collector: "StageProgressCollector | None" = None


class StageProgressCollector:
    """In-memory counters for inter-stage queues."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # name -> weak references to live queue instances (one queue may have
        # several writers in different threads; we keep refs to all)
        self._queues: dict[str, list[weakref.ref]] = {}
        # name -> running counters
        self._counts: dict[str, dict[str, int]] = {}

    def register(self, name: str, queue_obj: Any) -> None:
        ref = weakref.ref(queue_obj)
        with self._lock:
            self._queues.setdefault(name, []).append(ref)
            self._counts.setdefault(name, {"put": 0, "processed": 0})

    def record_put(self, name: str, n: int = 1) -> None:
        with self._lock:
            counts = self._counts.setdefault(name, {"put": 0, "processed": 0})
            counts["put"] += n

    def record_processed(self, name: str, n: int = 1) -> None:
        with self._lock:
            counts = self._counts.setdefault(name, {"put": 0, "processed": 0})
            counts["processed"] += n

    def snapshot(self) -> list[dict[str, Any]]:
        """Return per-queue snapshot: name, current depth, totals.

        Also garbage-collects weakrefs to queues that have been
        deallocated.
        """
        out = []
        with self._lock:
            for name, refs in list(self._queues.items()):
                live_refs = []
                depth = 0
                for ref in refs:
                    queue_obj = ref()
                    if queue_obj is None:
                        continue
                    live_refs.append(ref)
                    depth += _queue_depth(queue_obj)
                self._queues[name] = live_refs
                counts = self._counts.get(name, {"put": 0, "processed": 0})
                out.append(
                    {
                        "name": name,
                        "depth": depth,
                        "put": counts["put"],
                        "processed": counts["processed"],
                    }
                )
        return out


def _queue_depth(queue_obj: Any) -> int:
    """Best-effort depth read from a topology Queue wrapper or std queue.Queue."""
    inner = getattr(queue_obj, "_queue", queue_obj)
    try:
        return int(inner.qsize())
    except Exception:
        return 0


def install(collector: StageProgressCollector) -> None:
    """Wire the module-level hook so `Queue` operations are tracked."""
    global _collector  # noqa: PLW0603  module-level singleton
    _collector = collector


def uninstall() -> None:
    global _collector  # noqa: PLW0603  module-level singleton
    _collector = None


def register_queue(name: str, queue_obj: Any) -> None:
    """Called from `Queue.__init__`. No-op when diagnostics is off."""
    collector = _collector
    if collector is not None:
        collector.register(name, queue_obj)


def record_put(name: str, n: int = 1) -> None:
    """Called from `Queue.put`. No-op when diagnostics is off."""
    collector = _collector
    if collector is not None:
        collector.record_put(name, n)


def record_processed(name: str, n: int = 1) -> None:
    """Called from `Queue.process` (per item yielded). No-op when off."""
    collector = _collector
    if collector is not None:
        collector.record_processed(name, n)


def snapshot() -> list[dict[str, Any]]:
    """Used by heartbeat + dump rendering."""
    collector = _collector
    if collector is None:
        return []
    return collector.snapshot()


def format_for_heartbeat() -> str:
    """Render `stage_queues=` field for heartbeat lines.

    Returns empty string when there's nothing to report so heartbeats
    stay clean.
    """
    queues = snapshot()
    if not queues:
        return ""
    parts = [f"{q['name']}:{q['depth']}({q['put']}->{q['processed']})" for q in queues]
    return " stage_queues=" + ",".join(parts)
