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
"""Unit tests for `WorkspaceState`.

Locks the per-workspace lifecycle and the operation-shaped API used by
`PowerbiSource`.
"""

import pytest

from metadata.ingestion.source.dashboard.powerbi.models import (
    DataflowExportResponse,
    Dataset,
    Group,
    PowerBIDashboard,
    PowerBIReport,
)
from metadata.ingestion.source.dashboard.powerbi.workspace_state import WorkspaceState


@pytest.fixture
def ws_a() -> Group:
    return Group(
        id="ws_a",
        name="Workspace A",
        state="Active",
        datasets=[Dataset(id="d_a1", name="Dataset A1")],
        reports=[PowerBIReport(id="r_a1", name="Report A1")],
    )


@pytest.fixture
def ws_b() -> Group:
    return Group(
        id="ws_b",
        name="Workspace B",
        state="Active",
        datasets=[Dataset(id="d_b1", name="Dataset B1")],
        reports=[PowerBIReport(id="r_b1", name="Report B1")],
    )


@pytest.fixture
def state() -> WorkspaceState:
    return WorkspaceState()


# -- Lifecycle contract --------------------------------------------------


def test_current_raises_when_no_workspace_active(state):
    with pytest.raises(RuntimeError, match="No active workspace"):
        _ = state.current


def test_enter_twice_without_exit_raises_runtime_error(state, ws_a, ws_b):
    state.enter(ws_a)
    with pytest.raises(RuntimeError, match="still active"):
        state.enter(ws_b)


def test_enter_after_exit_succeeds(state, ws_a, ws_b):
    state.enter(ws_a)
    state.exit()
    state.enter(ws_b)
    assert state.current is ws_b


def test_exit_is_idempotent(state):
    state.exit()
    state.exit()


# -- Per-workspace caches: populated on enter, cleared on exit -----------


def test_dataset_lookup_populated_on_enter_cleared_on_exit(state, ws_a):
    state.enter(ws_a)
    assert state.find_dataset("d_a1") is not None
    state.exit()
    assert state.find_dataset("d_a1") is None


def test_dataflow_exports_cleared_on_exit(state, ws_a):
    """Per-workspace dataflow exports must be released when the workspace exits."""
    state.enter(ws_a)
    export = DataflowExportResponse(name="x", version="1.0")
    state.cache_dataflow_export("df_a1", export)
    assert state.get_dataflow_export("df_a1") is export
    state.exit()
    assert state.get_dataflow_export("df_a1") is None


def test_filtered_datamodels_lazy_memo_lifecycle(state, ws_a):
    state.enter(ws_a)
    assert state.filtered_datamodels is None
    ds = Dataset(id="d_a1", name="Dataset A1")
    state.set_filtered_datamodels([ds])
    assert state.filtered_datamodels == [ds]
    state.exit()
    assert state.filtered_datamodels is None


def test_filtered_dashboards_add_iter_cleared_on_exit(state, ws_a):
    state.enter(ws_a)
    dash = PowerBIDashboard(id="dash1", displayName="Dash 1")
    state.add_filtered_dashboard(dash)
    assert list(state.filtered_dashboards) == [dash]
    state.exit()
    assert list(state.filtered_dashboards) == []


# -- Cross-workspace registry: survives exit, accumulates ---------------


def test_reports_registry_persists_across_workspaces(state, ws_a, ws_b):
    state.enter(ws_a)
    state.exit()
    state.enter(ws_b)
    state.exit()
    assert state.is_known_report("r_a1") is True
    assert state.is_known_report("r_b1") is True
    assert state.is_known_report(None) is False
    assert state.is_known_report("nonexistent") is False


# -- Dashboard charts: operation-shaped consume API ---------------------


def test_dashboard_charts_operation_shaped_api(state, ws_a):
    # Anti-property assertion: the dict is private; callers MUST use add/pop.
    assert not hasattr(state, "dashboard_charts")

    state.enter(ws_a)
    state.add_dashboard_chart("dash1", "chart_a")
    state.add_dashboard_chart("dash1", "chart_b")
    state.add_dashboard_chart("dash2", "chart_c")

    # pop returns the recorded charts and consumes the entry
    assert state.pop_dashboard_chart_ids("dash1") == ["chart_a", "chart_b"]
    assert state.pop_dashboard_chart_ids("dash1") == []
    # remaining entries unaffected
    assert state.pop_dashboard_chart_ids("dash2") == ["chart_c"]
    # never-added key returns empty default
    assert state.pop_dashboard_chart_ids("never_added") == []
    # entries are dropped on workspace exit (no bleed into next workspace)
    state.add_dashboard_chart("dash3", "chart_d")
    state.exit()
    assert state.pop_dashboard_chart_ids("dash3") == []
