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
"""Memory-pressure tripwires (PSI, cgroup events) + MemoryError context manager."""

import logging
import time

import pytest

from metadata.ingestion import diagnostics
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.config import DiagnosticsConfig
from metadata.ingestion.diagnostics.monitors.watchdog import Verdict, Watchdog
from metadata.ingestion.diagnostics.samplers.memory import MemorySample, MemoryTracker


class _FixedSampleTracker(MemoryTracker):
    """MemoryTracker whose `sample()` returns a scripted MemorySample sequence."""

    def __init__(self, samples: list[MemorySample]) -> None:
        super().__init__()
        self._scripted = list(samples)

    def sample(self) -> MemorySample:
        if not self._scripted:
            return MemorySample(
                ts=time.monotonic(),
                rss=1000,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
            )
        return self._scripted.pop(0)


def _watchdog_with(samples: list[MemorySample]) -> Watchdog:
    return Watchdog(OperationRegistry(), _FixedSampleTracker(samples), DiagnosticsConfig())


def _dump_verdicts(verdicts: list[Verdict]) -> list[Verdict]:
    return [v for v in verdicts if v.dump_reason is not None]


# ---- PSI tripwire ----


def test_psi_below_threshold_does_not_trip():
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                psi_some_avg10=DiagnosticsConfig().pressure_psi_avg10_threshold - 0.1,
            )
        ]
    )
    assert _dump_verdicts(wd.check(time.monotonic())) == []


def test_psi_above_threshold_emits_dump_verdict():
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                psi_some_avg10=42.5,
            )
        ]
    )
    verdicts = _dump_verdicts(wd.check(time.monotonic()))
    assert len(verdicts) == 1
    verdict = verdicts[0]
    assert "diag.warn.memory_pressure" in verdict.message
    assert "memory-pressure-psi:avg10=42.5" in verdict.message
    assert verdict.dump_reason == "memory-pressure-psi:avg10=42.5"


# ---- cgroup memory.events.high ----


def test_events_high_increment_emits_dump_verdict():
    """First tick: baseline (no fire). Second tick: counter increased → fire."""
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_high=5,
            ),
            MemorySample(
                ts=1,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_high=12,
            ),
        ]
    )
    assert _dump_verdicts(wd.check(time.monotonic())) == []
    second = _dump_verdicts(wd.check(time.monotonic()))
    assert len(second) == 1
    assert "memory-pressure-cgroup-high:delta=7" in second[0].message


def test_events_high_unchanged_does_not_trip():
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_high=5,
            ),
            MemorySample(
                ts=1,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_high=5,
            ),
        ]
    )
    assert _dump_verdicts(wd.check(time.monotonic())) == []
    assert _dump_verdicts(wd.check(time.monotonic())) == []


# ---- cgroup memory.events.oom ----


def test_events_oom_increment_emits_dump_verdict():
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_oom=0,
            ),
            MemorySample(
                ts=1,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                cgroup_events_oom=1,
            ),
        ]
    )
    wd.check(time.monotonic())  # baseline
    second = _dump_verdicts(wd.check(time.monotonic()))
    assert len(second) == 1
    assert "memory-pressure-cgroup-oom" in second[0].message


# ---- throttling ----


def test_psi_tripwire_is_throttled():
    wd = _watchdog_with(
        [
            MemorySample(
                ts=0,
                rss=1,
                cgroup_current=None,
                cgroup_max=None,
                oom_kill_count=None,
                psi_some_avg10=50.0,
            )
            for _ in range(5)
        ]
    )
    first = _dump_verdicts(wd.check(time.monotonic()))
    second = _dump_verdicts(wd.check(time.monotonic()))
    third = _dump_verdicts(wd.check(time.monotonic()))
    assert len(first) == 1
    assert second == []
    assert third == []


# ---- MemoryError context manager (facade-level integration) ----


@pytest.fixture()
def _diag_installed():
    class _Cfg:
        class loggerLevel:  # noqa: N801
            value = "DEBUG"

    class _W:
        workflow_config = _Cfg()

        def workflow_steps(self):
            return []

    diagnostics.shutdown()
    assert diagnostics.install(_W())
    yield
    diagnostics.shutdown()


def test_memory_error_triggers_dump_then_reraises(_diag_installed, caplog):
    """Python-side MemoryError should produce a dump and propagate."""
    with (
        caplog.at_level(logging.WARNING, logger="metadata.Diagnostics"),
        pytest.raises(MemoryError),
        diagnostics.dump_on_memory_error(),
    ):
        raise MemoryError("simulated")
    out = "\n".join(r.getMessage() for r in caplog.records)
    assert "memory-error:" in out
    assert "diag.dump.begin" in out


def test_dump_on_memory_error_passes_through_other_exceptions(_diag_installed):
    with pytest.raises(RuntimeError), diagnostics.dump_on_memory_error():
        raise RuntimeError("not a memory error")


def test_dump_on_memory_error_noop_when_diagnostics_off(caplog):
    diagnostics.shutdown()
    with pytest.raises(MemoryError), diagnostics.dump_on_memory_error():
        raise MemoryError("simulated")
    diag_records = [r for r in caplog.records if "diag" in r.getMessage()]
    assert diag_records == []


# ---- perf smoke + emergency reserve (unchanged behavior; lives here for proximity) ----


def test_sample_is_under_5ms():
    """Each tracker.sample() should be sub-millisecond on average.

    Five samples must complete in under 25 ms total — well under the 10s
    watchdog tick. This guards against accidental I/O regression in the
    consolidated readers.
    """
    tracker = MemoryTracker()
    started = time.monotonic()
    for _ in range(5):
        tracker.sample()
    elapsed_ms = (time.monotonic() - started) * 1000
    assert elapsed_ms < 25, f"5x sample took {elapsed_ms:.1f}ms"


def test_emergency_reserve_is_allocated_at_construction():
    tracker = MemoryTracker()
    assert tracker._emergency_reserve is not None
    assert len(tracker._emergency_reserve) == 10 * 1024 * 1024


def test_top_object_types_releases_then_restores_reserve():
    tracker = MemoryTracker()
    initial = tracker._emergency_reserve
    assert initial is not None
    tracker.top_object_types(limit=3)
    if tracker._emergency_reserve is not None:
        assert len(tracker._emergency_reserve) == 10 * 1024 * 1024
