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
"""Workspace-scoped ingestion state for the PowerBI source.

Lifecycle contract:
    enter(workspace)   activates a workspace; raises if another is active
    exit()             releases per-workspace caches; idempotent
    enter + exit must be paired by the caller (typically via try / finally
    around the workspace iteration).
"""

from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    DataflowExportResponse,
    Dataset,
    Group,
    PowerBIDashboard,
    PowerBIReport,
)

# A workspace's "dashboards" list from the admin scan can contain either
# PowerBI Dashboards or Reports (both modelled as Dashboard in OM).
DashboardLike = PowerBIDashboard | PowerBIReport
# A workspace's "datamodels" set is the concatenation of datasets and
# dataflows; both become DashboardDataModel entities in OM.
DataModelLike = Dataset | Dataflow


class WorkspaceState:
    """State container for PowerBI workspace iteration.

    Per-workspace caches released on `exit`. Cross-workspace report-id
    registry persists for the whole run (tile-pinned lineage needs it
    to verify that a tile's referenced report exists somewhere in the
    tenant; only the id is required, not the report payload).
    """

    def __init__(self) -> None:
        self._current: Group | None = None
        self._datasets_by_id: dict[str, Dataset] = {}
        self._dataflow_exports: dict[str, DataflowExportResponse] = {}
        self._known_report_ids: set[str] = set()
        self._filtered_dashboards: list[DashboardLike] = []
        self._filtered_datamodels: list[DataModelLike] | None = None
        self._dashboard_charts: dict[str, list[str]] = {}

    def enter(self, workspace: Group) -> None:
        """Activate `workspace` and build its per-workspace caches.

        Raises:
            RuntimeError: a workspace is already active; call `exit()` first.
        """
        if self._current is not None:
            raise RuntimeError(
                f"WorkspaceState.enter() called while workspace "
                f"'{self._current.name}' is still active. Call exit() first."
            )
        self._current = workspace
        self._datasets_by_id = {d.id: d for d in workspace.datasets or []}
        self._filtered_dashboards = []
        self._filtered_datamodels = None
        self._dashboard_charts = {}
        for report in workspace.reports or []:
            self._known_report_ids.add(report.id)

    def exit(self) -> None:
        """Release per-workspace caches. Idempotent. Cross-workspace report registry persists."""
        if self._current is None:
            return
        self._current = None
        self._datasets_by_id = {}
        self._dataflow_exports = {}
        self._filtered_dashboards = []
        self._filtered_datamodels = None
        self._dashboard_charts = {}

    @property
    def current(self) -> Group:
        """Return the active workspace, raising if none is set."""
        if self._current is None:
            raise RuntimeError("No active workspace scope.")
        return self._current

    def find_dataset(self, dataset_id: str) -> Dataset | None:
        """Look up a dataset by id in the current workspace."""
        return self._datasets_by_id.get(dataset_id)

    def is_known_report(self, report_id: str | None) -> bool:
        """Return True if `report_id` was seen in any workspace entered so far."""
        return report_id is not None and report_id in self._known_report_ids

    def cache_dataflow_export(self, key: str, export: DataflowExportResponse) -> None:
        """Memoise a dataflow export for the current workspace's lineage stage."""
        self._dataflow_exports[key] = export

    def get_dataflow_export(self, key: str) -> DataflowExportResponse | None:
        """Fetch a previously cached dataflow export for the current workspace."""
        return self._dataflow_exports.get(key)

    # --- Filtered dashboards: write per-item, read by iteration -------------

    def add_filtered_dashboard(self, dashboard: DashboardLike) -> None:
        """Record a dashboard that passed the workspace's filter."""
        self._filtered_dashboards.append(dashboard)

    @property
    def filtered_dashboards(self) -> list[DashboardLike]:
        """Dashboards that passed the filter for the current workspace."""
        return self._filtered_dashboards

    # --- Filtered datamodels: write-once (lazy memo), read by iteration -----

    def set_filtered_datamodels(self, datamodels: list[DataModelLike]) -> None:
        """Populate the memoised filtered-datamodels cache for the current workspace."""
        self._filtered_datamodels = datamodels

    @property
    def filtered_datamodels(self) -> list[DataModelLike] | None:
        """Memoised filtered datamodels; `None` until populated via setter."""
        return self._filtered_datamodels

    # --- Dashboard charts: per-dashboard consume-on-read --------------------

    def add_dashboard_chart(self, dashboard_id: str, chart_id: str) -> None:
        """Record a chart id under a dashboard for the current workspace."""
        self._dashboard_charts.setdefault(dashboard_id, []).append(chart_id)

    def pop_dashboard_chart_ids(self, dashboard_id: str) -> list[str]:
        """Consume the chart ids for a dashboard; empty list if absent or already consumed."""
        return self._dashboard_charts.pop(dashboard_id, [])
