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
from typing import TextIO

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.formatting import format_bytes, format_signed_bytes

RING_BUFFER_SIZE = 10
TOP_TYPES_LIMIT = 10
# Pre-allocated bytearray reserved at install time and released right
# before `gc.get_objects()` runs under memory pressure. Gives the deep
# snapshot ~10MB of headroom so the Counter can build without itself
# triggering the OOM we're trying to diagnose.
EMERGENCY_RESERVE_BYTES = 10 * 1024 * 1024


class MemorySample:
    """A single point-in-time memory reading.

    Fields beyond rss/cgroup_current/cgroup_max are pre-OOM tripwire
    signals — see the watchdog's pressure check.
    """

    __slots__ = (
        "cgroup_current",
        "cgroup_events_high",
        "cgroup_events_oom",
        "cgroup_max",
        "oom_kill_count",
        "psi_some_avg10",
        "rss",
        "ts",
    )

    def __init__(
        self,
        ts: float,
        rss: int,
        cgroup_current: int | None,
        cgroup_max: int | None,
        oom_kill_count: int | None,
        cgroup_events_high: int | None = None,
        cgroup_events_oom: int | None = None,
        psi_some_avg10: float | None = None,
    ) -> None:
        self.ts = ts
        self.rss = rss
        self.cgroup_current = cgroup_current
        self.cgroup_max = cgroup_max
        self.oom_kill_count = oom_kill_count
        self.cgroup_events_high = cgroup_events_high
        self.cgroup_events_oom = cgroup_events_oom
        self.psi_some_avg10 = psi_some_avg10


class MemoryTracker:
    """Thread-safe rolling memory sampler — a poll-driven aspect that renders
    its own heartbeat field, dump fragment, and end-of-run summary."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ring: deque[MemorySample] = deque(maxlen=RING_BUFFER_SIZE)
        self._started_at = time.monotonic()
        self._psutil = _import_psutil()
        # Cache the Process handle. Construction reads /proc/<pid>/stat;
        # caching saves that read on every sample. The handle remains
        # valid for the lifetime of this process.
        self._process = self._make_process_handle()
        self._cgroup_paths = _detect_cgroup_paths()
        self._psi_path = _detect_psi_path()
        # Reserved bytes — `release_emergency_reserve` drops the reference
        # so `gc.get_objects()` can allocate. CPython 3.11 large-object
        # allocations bypass pymalloc and free directly to the OS.
        self._emergency_reserve: bytearray | None = bytearray(EMERGENCY_RESERVE_BYTES)
        # End-of-run summary accumulators, fed by `note_sample` on the heartbeat.
        self._peak_rss = 0
        self._baseline_rss: int | None = None
        self._high_water_op = ""
        self._psi_avg10_max = 0.0
        self._last_sample: MemorySample | None = None

    def note_sample(self, sample: MemorySample, current_op: str) -> None:
        """Fold a heartbeat sample into the end-of-run memory summary.

        Kept registry-free: the heartbeat (which already reads both the
        registry and this tracker) passes the deepest op so we can record
        what was running when RSS peaked.
        """
        with self._lock:
            self._last_sample = sample
            if self._baseline_rss is None:
                self._baseline_rss = sample.rss
            if sample.rss > self._peak_rss:
                self._peak_rss = sample.rss
                self._high_water_op = current_op
            if sample.psi_some_avg10 is not None and sample.psi_some_avg10 > self._psi_avg10_max:
                self._psi_avg10_max = sample.psi_some_avg10

    def _make_process_handle(self):
        if self._psutil is None:
            return None
        try:
            return self._psutil.Process()
        except Exception:
            return None

    def sample(self) -> MemorySample:
        """Take one cheap sample, append to ring, return it.

        Total cost: one rss read (psutil or /proc/self/status), one
        cgroup memory.current read, one cgroup memory.max read, one
        consolidated memory.events read (oom_kill + high + oom), and
        one /proc/pressure/memory read. ~5 tiny syscalls.
        """
        events = _read_memory_events(self._cgroup_paths.get("events"))
        sample = MemorySample(
            ts=time.monotonic(),
            rss=self._read_rss(),
            cgroup_current=_read_int(self._cgroup_paths.get("current")),
            cgroup_max=_read_cgroup_max(self._cgroup_paths.get("max")),
            oom_kill_count=events.get("oom_kill"),
            cgroup_events_high=events.get("high"),
            cgroup_events_oom=events.get("oom"),
            psi_some_avg10=_read_psi_some_avg10(self._psi_path),
        )
        with self._lock:
            self._ring.append(sample)
        return sample

    def latest(self) -> MemorySample | None:
        with self._lock:
            return self._ring[-1] if self._ring else None

    def render_summary(self) -> str | None:
        """The end-of-run `diag.mem_budget` line.

        Takes a final reading if no heartbeat ever fed one (runs shorter than
        the heartbeat interval), so the line still appears. Returns None only
        if even that sampling fails.
        """
        if self._last_sample is None:
            try:
                self.note_sample(self.sample(), "")
            except Exception:
                return None
        with self._lock:
            latest, baseline = self._last_sample, self._baseline_rss
            peak, high_water_op, psi_max = self._peak_rss, self._high_water_op, self._psi_avg10_max
            elapsed = time.monotonic() - self._started_at
        result = None
        if latest is not None and baseline is not None:
            result = _format_mem_budget("diag.mem_budget", latest, peak, baseline, high_water_op, psi_max, elapsed)
        return result

    def render_instant(self) -> str:
        """The heartbeat memory field, from the latest sample (the heartbeat
        drives `sample()`/`note_sample()` before fanning instants)."""
        sample = self._last_sample
        result = ""
        if sample is not None:
            delta_30s = self.rss_delta_bytes_since(30.0)
            oom = sample.oom_kill_count if sample.oom_kill_count is not None else "?"
            result = (
                f" rss={format_bytes(sample.rss)} "
                f"rss_delta_30s={format_signed_bytes(delta_30s)} "
                f"cgroup={format_bytes(sample.cgroup_current)}/{format_bytes(sample.cgroup_max)} "
                f"oom_kills={oom}"
            )
        return result

    def render_dump(self, out: TextIO) -> None:
        out.write(f"{DIAG_LOG_PREFIX}.dump.memory\n")
        sample = self.sample()
        delta_30s = self.rss_delta_bytes_since(30.0)
        out.write(
            f"  rss={format_bytes(sample.rss)} "
            f"rss_delta_30s={format_signed_bytes(delta_30s)} "
            f"cgroup_current={format_bytes(sample.cgroup_current)} "
            f"cgroup_max={format_bytes(sample.cgroup_max)} "
            f"oom_kills={sample.oom_kill_count if sample.oom_kill_count is not None else '?'}\n"
        )
        out.write("  top_types:\n")
        for type_name, count in self.top_object_types():
            out.write(f"    {type_name:<32} {count}\n")

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

        Expensive — only call on dump. Releases the emergency reserve
        first so we have headroom to build the Counter even when we're
        running this BECAUSE of memory pressure.
        """
        self._release_emergency_reserve()
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
        finally:
            self._restore_emergency_reserve()

    def _release_emergency_reserve(self) -> None:
        """Drop the reserve so the deep snapshot has 10MB of headroom."""
        self._emergency_reserve = None

    def _restore_emergency_reserve(self) -> None:
        """Re-allocate the reserve. Best-effort — under severe pressure
        this allocation may itself fail; that's acceptable since the
        snapshot already ran.
        """
        try:
            if self._emergency_reserve is None:
                self._emergency_reserve = bytearray(EMERGENCY_RESERVE_BYTES)
        except MemoryError:
            self._emergency_reserve = None

    def _read_rss(self) -> int:
        if self._process is None:
            return _read_rss_proc_self_status()
        try:
            return int(self._process.memory_info().rss)
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


def _read_memory_events(path: str | None) -> dict[str, int]:
    """Read cgroup v2 `memory.events` in one shot.

    Returns a dict with keys among `low`, `high`, `max`, `oom`,
    `oom_kill` (whichever the kernel exposes). Empty dict on missing
    file or v1 cgroup. The kernel writes one counter per line.
    """
    out: dict[str, int] = {}
    if not path:
        return out
    try:
        with open(path) as fh:  # noqa: PTH123  text read of /sys file
            for line in fh:
                key, _, value = line.partition(" ")
                try:
                    out[key.strip()] = int(value.strip())
                except ValueError:
                    continue
    except OSError:
        return {}
    return out


def _detect_psi_path() -> str | None:
    """Return `/proc/pressure/memory` if present (kernel ≥4.20).

    PSI is the kernel's own "memory is becoming a bottleneck" signal —
    far more reliable than a static cgroup-ratio threshold.
    """
    psi_path = "/proc/pressure/memory"
    if os.path.exists(psi_path):  # noqa: PTH110  cheap probe
        return psi_path
    return None


def _read_psi_some_avg10(path: str | None) -> float | None:
    """Parse the `some avg10` value from `/proc/pressure/memory`.

    The file format is:
        some avg10=0.10 avg60=0.05 avg300=0.01 total=12345
        full avg10=0.00 avg60=0.00 avg300=0.00 total=6789

    `some` = % of the last N seconds where ANY task in the cgroup was
    stalled on memory. `avg10` is the most reactive window.
    """
    if not path:
        return None
    try:
        with open(path) as fh:  # noqa: PTH123  text read of /proc file
            line = fh.readline()
    except OSError:
        return None
    if not line.startswith("some "):
        return None
    for token in line.split():
        if token.startswith("avg10="):
            try:
                return float(token.split("=", 1)[1])
            except ValueError:
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


def _format_mem_budget(
    prefix: str,
    latest: MemorySample,
    peak: int,
    baseline: int,
    high_water_op: str,
    psi_avg10_max: float,
    elapsed: float,
) -> str:
    """Render the mem_budget block: title, rss numbers, attribution, optional `unavailable:`."""
    lines: list[str] = [prefix]
    lines.append(
        f"  elapsed={elapsed:.1f}s  "
        f"baseline={format_bytes(baseline)}  "
        f"peak={format_bytes(peak)}  "
        f"final={format_bytes(latest.rss)}  "
        f"Δpeak={format_signed_bytes(peak - baseline)}"
    )

    attribution_parts = [f"high_water_op={high_water_op or '-'}", f"psi_avg10_max={psi_avg10_max:.1f}"]
    unavailable: list[str] = []

    if latest.cgroup_max is not None and latest.cgroup_current is not None:
        attribution_parts.append(f"cgroup_headroom={format_bytes(latest.cgroup_max - latest.cgroup_current)}")
    else:
        unavailable.append("cgroup_headroom")

    if latest.oom_kill_count is not None:
        attribution_parts.append(f"oom_kills={latest.oom_kill_count}")
    else:
        unavailable.append("oom_kills")

    if latest.cgroup_events_high is not None:
        attribution_parts.append(f"events.high={latest.cgroup_events_high}")
    else:
        unavailable.append("events.high")

    if latest.cgroup_events_oom is not None:
        attribution_parts.append(f"events.oom={latest.cgroup_events_oom}")
    else:
        unavailable.append("events.oom")

    lines.append("  " + "  ".join(attribution_parts))
    if unavailable:
        lines.append("  unavailable: " + "  ".join(unavailable))
    return "\n".join(lines)
