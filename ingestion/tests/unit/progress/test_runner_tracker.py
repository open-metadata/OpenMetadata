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
"""TopologyProgressTracker: gating, path resolution, handles, totals hook."""

from unittest.mock import MagicMock

from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import TopologyContextManager, get_topology_node, get_topology_root
from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer
from metadata.ingestion.progress.runner_tracker import (
    NO_OP_NODE_PROGRESS,
    NodeProgress,
    TopologyProgressTracker,
)
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology


class _FakeSource(TopologyRunnerMixin):
    topology = DatabaseServiceTopology()

    def __init__(self, mode=ProgressMode.AUTO):
        self.progress_mode = mode
        self.context = TopologyContextManager(self.topology)
        self.status = MagicMock()
        self.declared = 0

    def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
        self.declared += 1
        totals.set_total("Database", 7)


def _table_node(source):
    return get_topology_node("table", source.topology)


def _database_node(source):
    return get_topology_node("database", source.topology)


def test_for_node_returns_noop_when_mode_is_not_auto():
    for mode in (ProgressMode.MANUAL, ProgressMode.OFF):
        source = _FakeSource(mode)
        tracker = TopologyProgressTracker(source)
        assert tracker.for_node(_table_node(source), is_leaf=True) is NO_OP_NODE_PROGRESS
        assert "_progress_registry" not in source.__dict__


def test_for_node_returns_noop_for_root_node():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    root = get_topology_root(source.topology)[0]
    tracker.on_walk_start([root])
    assert tracker.is_root_node(root)
    assert tracker.for_node(root, is_leaf=False) is NO_OP_NODE_PROGRESS


def test_for_node_returns_real_handle_for_auto_leaf():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    handle = tracker.for_node(_table_node(source), is_leaf=True)
    assert isinstance(handle, NodeProgress)
    assert handle.wants_eager_count is True


def test_totals_hook_called_exactly_once_and_only_for_real_nodes():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    root = get_topology_root(source.topology)[0]
    tracker.on_walk_start([root])
    tracker.for_node(root, is_leaf=False)
    assert source.declared == 0
    tracker.for_node(_database_node(source), is_leaf=False)
    tracker.for_node(_table_node(source), is_leaf=True)
    assert source.declared == 1
    assert ("Database", 0, 7) in source.progress.global_counters()


def test_leaf_handle_counts_open_and_advance():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    handle = tracker.for_node(_table_node(source), is_leaf=True)
    handle.open_with_count(2)
    handle.advance_leaf()
    handle.advance_leaf()
    snapshot = source.progress.snapshot()
    assert snapshot.child_type == "Table"
    assert snapshot.processed == 2


def test_container_handle_is_lazy_without_reconcilable_counter():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    handle = tracker.for_node(_database_node(source), is_leaf=False)
    assert handle.wants_eager_count is False
    handle.open_lazy()
    assert source.progress.snapshot().expected_by_type.get("Database") is None


def test_container_handle_reconciles_when_counter_is_reconcilable():
    source = _FakeSource()
    source.progress.seed_scope_total("DatabaseSchema", "salesdb", 1)
    tracker = TopologyProgressTracker(source)
    key = source._node_primary_stage(_database_node(source)).context
    setattr(source.context.get(), key, "salesdb")
    schema_node = get_topology_node("databaseSchema", source.topology)
    handle = tracker.for_node(schema_node, is_leaf=False)
    assert handle.wants_eager_count is True
    handle.open_with_count(3)
    counters = {t: (done, total) for t, done, total in source.progress.global_counters()}
    assert counters["DatabaseSchema"] == (0, 3)


def test_enter_scope_closes_and_tracks_on_exit():
    source = _FakeSource()
    source.progress.set_total("Database", 7)
    tracker = TopologyProgressTracker(source)
    node = _database_node(source)
    handle = tracker.for_node(node, is_leaf=False)
    key = source._node_primary_stage(node).context
    setattr(source.context.get(), key, "salesdb")
    closed = []
    source.progress.close = lambda path: closed.append(list(path))
    scope = handle.enter_scope()
    scope.exit()
    assert closed == [["salesdb"]]
    counters = {t: (done, total) for t, done, total in source.progress.global_counters()}
    assert counters["Database"][0] == 1


def test_enter_scope_is_noop_without_context_value():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    handle = tracker.for_node(_database_node(source), is_leaf=False)
    scope = handle.enter_scope()
    scope.exit()
    assert source.progress.snapshot() is None  # nothing opened, nothing closed


def test_current_path_resolves_ancestor_context():
    source = _FakeSource()
    tracker = TopologyProgressTracker(source)
    assert tracker.current_path() == []
    db_key = source._node_primary_stage(_database_node(source)).context
    setattr(source.context.get(), db_key, "salesdb")
    assert tracker.current_path("DatabaseSchema") == ["salesdb"]
