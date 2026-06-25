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
"""TopologyRunnerMixin: per-instance registry, progress path, no pull hooks."""

import inspect
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.api import topology_runner
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    TopologyContextManager,
    get_topology_node,
)
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceTopology,
)
from metadata.utils.progress_registry import ProgressRegistry


class TestRunnerProgressSurface:
    def test_progress_is_lazy_per_instance(self):
        runner = TopologyRunnerMixin()
        registry = runner.progress
        assert isinstance(registry, ProgressRegistry)
        assert runner.progress is registry

    def test_distinct_instances_distinct_registries(self):
        assert TopologyRunnerMixin().progress is not TopologyRunnerMixin().progress

    def test_current_progress_path_default_is_empty(self):
        assert TopologyRunnerMixin().current_progress_path() == []

    def test_declare_totals_is_gone(self):
        assert not hasattr(TopologyRunnerMixin, "declare_totals")

    def test_current_progress_scope_is_gone(self):
        assert not hasattr(TopologyRunnerMixin, "current_progress_scope")

    def test_no_count_pass_in_iter(self):
        source = inspect.getsource(topology_runner)
        assert "declare_totals" not in source
        assert ".track(" not in source

    def test_root_node_detection_uses_iter_captured_ids(self):
        runner = TopologyRunnerMixin()
        root, child = object(), object()
        assert runner._is_root_node(root) is False  # nothing captured yet
        runner.__dict__["_root_node_ids"] = {id(root)}
        assert runner._is_root_node(root) is True
        assert runner._is_root_node(child) is False


class _WalkRunner(TopologyRunnerMixin):
    """Drives the real _process_node gating while stubbing the orthogonal
    producer/stage execution, so the test exercises the gate, not the sink."""

    topology = DatabaseServiceTopology()

    def __init__(self, enabled):
        self.progress_tracking_enabled = enabled
        self.context = TopologyContextManager(self.topology)
        self.__dict__["_root_node_ids"] = set()
        self.status = MagicMock()

    def _run_node_producer(self, node):
        return ["a", "b"]

    def _process_stage(self, stage, node_entity):
        return iter(())


def _drive_leaf(runner):
    leaf = get_topology_node("table", runner.topology)
    list(runner._process_node(leaf))


def _drive_container(runner):
    """Drive _process_node through a container (non-leaf) node.

    ``database`` has ``databaseSchema`` as a child, making it a container
    whose producer is iterated lazily and whose progress is opened with
    ``expected=None`` (no connector-pushed total)."""
    container = get_topology_node("database", runner.topology)
    list(runner._process_node(container))


def test_disabled_walk_creates_no_registry():
    runner = _WalkRunner(enabled=False)
    _drive_leaf(runner)
    assert "_progress_registry" not in runner.__dict__


def test_enabled_walk_records_into_registry():
    runner = _WalkRunner(enabled=True)
    _drive_leaf(runner)
    snapshot = runner.progress.snapshot()
    assert snapshot.child_type == "Table"
    assert snapshot.processed == 2


def test_container_open_none_through_runner():
    """Driving _process_node through the *database* container node must call
    ``progress.open(parent_path, "Database", None)`` — the lazy branch where no
    connector pushes a total — so the registry records ``expected=None`` for
    the Database level."""
    runner = _WalkRunner(enabled=True)
    _drive_container(runner)
    snapshot = runner.progress.snapshot()
    assert snapshot is not None
    assert snapshot.child_type == "Database"
    assert snapshot.expected_by_type.get("Database") is None


@pytest.fixture
def progress_runner():
    """A _WalkRunner with progress tracking enabled, pre-seeded with a registry."""
    return _WalkRunner(enabled=True)


def test_container_without_push_is_unknown(progress_runner):
    # progress_runner: a TopologyRunnerMixin test double with progress_tracking_enabled=True
    progress_runner.progress.open(["db1"], "DatabaseSchema", None)
    snap = progress_runner.progress.snapshot()
    assert snap.children[0].expected is None


def test_runner_has_no_pull_hooks():
    from metadata.ingestion.api.topology_runner import TopologyRunnerMixin

    assert not hasattr(TopologyRunnerMixin, "container_expected_count")
    assert not hasattr(TopologyRunnerMixin, "prefetch_global_totals")
    assert not hasattr(TopologyRunnerMixin, "progress_snapshot")


class _CtxWalkRunner(_WalkRunner):
    """Like _WalkRunner but writes each entity into the node's context key, so
    consumer-derived paths and _scope_path_for_node resolve to real names."""

    def _process_stage(self, stage, node_entity):
        if getattr(stage, "context", None):
            setattr(self.context.get(), stage.context, node_entity)
        return iter(())


def test_scope_path_for_node_appends_context_value():
    runner = _WalkRunner(enabled=True)
    database_node = get_topology_node("database", runner.topology)
    key = runner._node_primary_stage(database_node).context
    setattr(runner.context.get(), key, "salesdb")
    assert runner._scope_path_for_node(database_node, []) == ["salesdb"]


def test_scope_path_for_node_is_none_without_context_value():
    runner = _WalkRunner(enabled=True)
    database_node = get_topology_node("database", runner.topology)
    assert runner._scope_path_for_node(database_node, []) is None


def test_completed_container_is_closed_through_runner():
    runner = _CtxWalkRunner(enabled=True)
    closed: list = []
    runner.progress.close = lambda path: closed.append(list(path))
    container = get_topology_node("database", runner.topology)
    list(runner._process_node(container))
    # producer yields "a","b"; each database entity is closed at its own path
    assert ["a"] in closed
    assert ["b"] in closed
