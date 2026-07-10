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
"""ProgressMode knob, TotalsDeclarer and ManualProgress facades."""

import pytest

from metadata.ingestion.progress.modes import (
    ManualProgress,
    ProgressMode,
    ProgressModeError,
    TotalsDeclarer,
)
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.ingestion.progress.tracking import ProgressTracking


def test_manual_raises_in_auto_mode():
    with pytest.raises(ProgressModeError):
        _ = ProgressTracking(ProgressMode.AUTO, "AutoSource").manual


def test_manual_raises_in_off_mode():
    with pytest.raises(ProgressModeError):
        _ = ProgressTracking(ProgressMode.OFF, "OffSource").manual


def test_manual_is_cached_per_tracking():
    tracking = ProgressTracking(ProgressMode.MANUAL, "ManualSource")
    assert tracking.manual is tracking.manual


def test_manual_wraps_the_tracking_registry():
    tracking = ProgressTracking(ProgressMode.MANUAL, "ManualSource")
    tracking.manual.set_total("Workspaces", 3)
    assert ("Workspaces", 0, 3) in tracking.registry.global_counters()


def test_totals_declarer_exposes_no_counting_methods():
    declarer = TotalsDeclarer(ProgressRegistry())
    for name in ("track", "advance", "open", "close", "reconcile_scope_total"):
        assert not hasattr(declarer, name)


def test_totals_declarer_sets_denominators():
    registry = ProgressRegistry()
    totals = TotalsDeclarer(registry)
    totals.set_total("Database", 4)
    totals.seed_scope_total("DatabaseSchema", "db1", 3)
    totals.mark_reconcilable("Table")
    counters = {t: (done, total) for t, done, total in registry.global_counters()}
    assert counters["Database"] == (0, 4)
    assert counters["DatabaseSchema"] == (0, 3)
    assert registry.is_reconcilable("DatabaseSchema")
    assert registry.is_reconcilable("Table")


def test_declare_progress_totals_default_is_noop():
    from metadata.ingestion.api.topology_runner import TopologyRunnerMixin

    class _Plain(TopologyRunnerMixin):
        pass

    registry = ProgressRegistry()
    _Plain().declare_progress_totals(TotalsDeclarer(registry))
    assert registry.global_counters() == []


def test_manual_group_flow_drives_registry_like_the_old_helpers():
    registry = ProgressRegistry()
    manual = ManualProgress(registry)
    manual.declare_groups("Workspaces", 2)
    manual.open_group("Finance", {"Dashboard": 2, "Chart": None})
    manual.advance("Finance", "Dashboard")
    manual.advance("Finance", "Dashboard")
    manual.advance("Finance", "Chart")
    manual.close_group("Finance")
    counters = {t: (done, total) for t, done, total in registry.global_counters()}
    assert counters["Workspaces"] == (1, 2)
    assert registry.assets_ingested() == 3
    assert registry.snapshot() is None


def test_manual_counter_api_passthrough():
    registry = ProgressRegistry()
    manual = ManualProgress(registry)
    manual.seed_scope_total("Queries", "run", 100)
    manual.track("Queries", 40)
    manual.reconcile_scope_total("Queries", "run", 40)
    counters = {t: (done, total) for t, done, total in registry.global_counters()}
    assert counters["Queries"] == (40, 40)
