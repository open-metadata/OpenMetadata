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
Memory tracker — cheap on heartbeat, expensive only on dump.

Sample (cheap, called on every heartbeat tick):
  - RSS (psutil)
  - cgroup current/max (from /sys/fs/cgroup, both v1 and v2)
  - cgroup oom_kill_count (proof of recent OOM siblings)

Deep snapshot (expensive, only on dump):
  - gc.get_objects() aggregated by type(obj).__name__ — answers
    "what kind of object is occupying memory?"

The ring buffer (last N samples) gives us a per-second growth rate so
heartbeats can show whether memory is rising fast.
"""

import gc
import os
import threading
import time
from collections import Counter, deque

RING_BUFFER_SIZE = 10
TOP_TYPES_LIMIT = 10


class MemorySample:
    """A single point-in-time memory reading."""

    __slots__ = ("cgroup_current", "cgroup_max", "oom_kill_count", "rss", "ts")

    def __init__(
        self,
        ts: float,
        rss: int,
        cgroup_current: int | None,
        cgroup_max: int | None,
        oom_kill_count: int | None,
    ) -> None:
        self.ts = ts
        self.rss = rss
        self.cgroup_current = cgroup_current
        self.cgroup_max = cgroup_max
        self.oom_kill_count = oom_kill_count


class MemoryTracker:
    """Thread-safe rolling memory sampler."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ring: deque[MemorySample] = deque(maxlen=RING_BUFFER_SIZE)
        self._psutil = _import_psutil()
        self._cgroup_paths = _detect_cgroup_paths()

    def sample(self) -> MemorySample:
        """Take one cheap sample, append to ring, return it."""
        sample = MemorySample(
            ts=time.monotonic(),
            rss=self._read_rss(),
            cgroup_current=_read_int(self._cgroup_paths.get("current")),
            cgroup_max=_read_cgroup_max(self._cgroup_paths.get("max")),
            oom_kill_count=_read_oom_kill_count(self._cgroup_paths.get("events")),
        )
        with self._lock:
            self._ring.append(sample)
        return sample

    def latest(self) -> MemorySample | None:
        with self._lock:
            return self._ring[-1] if self._ring else None

    def rss_delta_bytes_since(self, seconds_ago: float) -> int | None:
        """RSS change between the most recent sample and the oldest within `seconds_ago`."""
        with self._lock:
            if not self._ring:
                return None
            latest = self._ring[-1]
            cutoff = latest.ts - seconds_ago
            baseline = None
            for sample in self._ring:
                if sample.ts <= cutoff:
                    baseline = sample
                else:
                    break
            if baseline is None:
                baseline = self._ring[0]
        return latest.rss - baseline.rss

    def top_object_types(self, limit: int = TOP_TYPES_LIMIT) -> list[tuple[str, int]]:
        """gc.get_objects() aggregated by type name.

        Expensive — only call on dump.  Wrapped in try/except because
        gc.get_objects can in theory raise on broken __class__
        descriptors.
        """
        try:
            counter: Counter = Counter()
            for obj in gc.get_objects():
                try:
                    counter[type(obj).__name__] += 1
                except Exception:
                    counter["<unknown>"] += 1
            return counter.most_common(limit)
        except Exception:
            return []

    def _read_rss(self) -> int:
        if self._psutil is None:
            return _read_rss_proc_self_status()
        try:
            return int(self._psutil.Process().memory_info().rss)
        except Exception:
            return _read_rss_proc_self_status()


def _import_psutil():
    try:
        import psutil  # noqa: PLC0415  optional dependency probe
    except ImportError:
        return None
    return psutil


def _detect_cgroup_paths() -> dict:
    """Return paths for cgroup memory.current / memory.max / memory.events.

    Tries cgroup v2 first (`/sys/fs/cgroup/memory.*`), then v1
    (`/sys/fs/cgroup/memory/memory.*`).
    """
    paths = {}
    v2_root = "/sys/fs/cgroup"
    if os.path.exists(f"{v2_root}/memory.current"):  # noqa: PTH110  cheap probe
        paths["current"] = f"{v2_root}/memory.current"
        paths["max"] = f"{v2_root}/memory.max"
        paths["events"] = f"{v2_root}/memory.events"
        return paths
    v1_root = "/sys/fs/cgroup/memory"
    if os.path.exists(f"{v1_root}/memory.usage_in_bytes"):  # noqa: PTH110  cheap probe
        paths["current"] = f"{v1_root}/memory.usage_in_bytes"
        paths["max"] = f"{v1_root}/memory.limit_in_bytes"
        paths["events"] = None
    return paths


def _read_int(path: str | None) -> int | None:
    if not path:
        return None
    try:
        with open(path, "rb") as fh:  # noqa: PTH123  binary read of /sys file
            data = fh.read().strip()
        return int(data)
    except (OSError, ValueError):
        return None


def _read_cgroup_max(path: str | None) -> int | None:
    """cgroup v2 emits the literal string 'max' for unlimited."""
    if not path:
        return None
    try:
        with open(path, "rb") as fh:  # noqa: PTH123  binary read of /sys file
            data = fh.read().strip()
        if data == b"max":
            return None
        return int(data)
    except (OSError, ValueError):
        return None


def _read_oom_kill_count(path: str | None) -> int | None:
    """cgroup v2 memory.events file looks like:

    low 0
    high 0
    max 0
    oom 0
    oom_kill 0
    """
    if not path:
        return None
    try:
        with open(path) as fh:  # noqa: PTH123  text read of /sys file
            for line in fh:
                key, _, value = line.partition(" ")
                if key == "oom_kill":
                    return int(value.strip())
    except (OSError, ValueError):
        return None
    return None


def _read_rss_proc_self_status() -> int:
    """Fallback when psutil is unavailable."""
    try:
        with open("/proc/self/status") as fh:  # noqa: PTH123  text read of /proc file
            for line in fh:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    return int(parts[1]) * 1024
    except (OSError, ValueError):
        pass
    return 0


def format_bytes(n: int | None) -> str:
    if n is None:
        return "?"
    abs_n = abs(n)
    if abs_n >= 1024 * 1024 * 1024:
        return f"{n / (1024 * 1024 * 1024):.1f}G"
    if abs_n >= 1024 * 1024:
        return f"{n / (1024 * 1024):.0f}M"
    if abs_n >= 1024:
        return f"{n / 1024:.0f}K"
    return f"{n}B"


def format_signed_bytes(n: int | None) -> str:
    if n is None:
        return "?"
    sign = "+" if n >= 0 else "-"
    return sign + format_bytes(abs(n))
