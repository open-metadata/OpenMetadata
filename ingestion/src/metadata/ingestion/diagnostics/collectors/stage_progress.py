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

Tracks the depth and put/processed counts of the inter-stage queues used by
`TopologyRunnerMixin`, so heartbeats and dumps show "source produced 1000, sink
consumed 50, depth 950" — the signal that distinguishes a slow source from a
slow sink.

The `Queue` class (in `models/topology.py`) calls the module-level
`register_queue` / `record_put` / `record_processed` hooks on every operation.
Those route through the installed handler's `stage` collector (the same single
root the rest of the seams use); when diagnostics is OFF they're no-ops with a
single attribute load, so the queue stays cheap.
"""

import logging
import threading
import weakref
from typing import Any, TextIO

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import emit_log, get_handler


class StageProgressCollector:
    """In-memory counters for inter-stage queues (a Renderable Collector)."""

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
        """Per-queue snapshot: name, current depth, totals. Also drops weakrefs
        to queues that have been deallocated."""
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
                out.append({"name": name, "depth": depth, "put": counts["put"], "processed": counts["processed"]})
        return out

    def render_instant(self) -> str:
        """The heartbeat ` stage_queues=name:depth(put->processed)` field."""
        queues = self.snapshot()
        if not queues:
            return ""
        parts = [f"{q['name']}:{q['depth']}({q['put']}->{q['processed']})" for q in queues]
        return " stage_queues=" + ",".join(parts)

    def render_dump(self, out: TextIO) -> None:
        queues = self.snapshot()
        if not queues:
            return
        out.write(f"{DIAG_LOG_PREFIX}.dump.queues\n")
        for q in queues:
            out.write(f"  name={q['name']} depth={q['depth']} put={q['put']} processed={q['processed']}\n")


def _queue_depth(queue_obj: Any) -> int:
    """Best-effort depth read from a topology Queue wrapper or std queue.Queue."""
    inner = getattr(queue_obj, "_queue", queue_obj)
    try:
        return int(inner.qsize())
    except Exception:
        return 0


def register_queue(name: str, queue_obj: Any) -> None:
    """Seam called from `Queue.__init__`. Safe from the hot path."""
    stage = _stage()
    if stage is None:
        return
    try:
        stage.register(name, queue_obj)
    except Exception as exc:
        _emit_seam_error("stage.register_queue", exc)


def record_put(name: str, n: int = 1) -> None:
    """Seam called from `Queue.put`. Safe from the hot path."""
    stage = _stage()
    if stage is None:
        return
    try:
        stage.record_put(name, n)
    except Exception as exc:
        _emit_seam_error("stage.record_put", exc)


def record_processed(name: str, n: int = 1) -> None:
    """Seam called from `Queue.process` per item. Safe from the hot path."""
    stage = _stage()
    if stage is None:
        return
    try:
        stage.record_processed(name, n)
    except Exception as exc:
        _emit_seam_error("stage.record_processed", exc)


def _stage() -> "StageProgressCollector | None":
    handler = get_handler()
    if handler is None:
        return None
    try:
        return handler.aspect(StageProgressCollector)
    except KeyError:
        return None


def _emit_seam_error(seam: str, exc: BaseException) -> None:
    """Audit log for seam-side defensive wraps."""
    emit_log(logging.ERROR, f"{DIAG_LOG_PREFIX}.{seam}.error err={exc!r}")
