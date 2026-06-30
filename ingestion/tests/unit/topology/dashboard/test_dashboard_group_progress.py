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
"""Reusable per-group progress helpers on DashboardServiceSource."""

from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource


class _BareSource(DashboardServiceSource):
    # Minimal concrete subclass: Python 3.11's object.__new__ enforces the ABC
    # abstract-method check, so we cannot __new__ the abstract base directly.
    # Overriding the abstract methods clears __abstractmethods__; __new__ then
    # skips the heavy __init__. The helpers and the ``progress`` property only
    # touch ``self.__dict__``, so no further setup is needed.
    def create(self, *args, **kwargs): ...
    def get_dashboard_details(self, *args, **kwargs): ...
    def get_dashboard_name(self, *args, **kwargs): ...
    def get_dashboards_list(self, *args, **kwargs): ...
    def yield_dashboard(self, *args, **kwargs): ...
    def yield_dashboard_chart(self, *args, **kwargs): ...
    def yield_dashboard_lineage_details(self, *args, **kwargs): ...


def _bare_source() -> DashboardServiceSource:
    return _BareSource.__new__(_BareSource)


class TestDashboardGroupProgress:
    def test_helpers_drive_registry_and_prune(self):
        src = _bare_source()
        src._declare_progress_groups("Workspaces", 2)
        src._open_group_progress("Sales", {"Dashboard": 3, "Chart": None})
        src._advance_group_progress("Sales", "Dashboard")
        src._advance_group_progress("Sales", "Chart")
        assert src.progress.global_counters() == [("Workspaces", 0, 2)]
        assert src.progress.assets_ingested() == 2

        src._close_group_progress("Sales")
        assert src.progress.global_counters() == [("Workspaces", 1, 2)]
        snapshot = src.progress.snapshot()
        assert snapshot is None or all(child.label != "Sales" for child in snapshot.children)
