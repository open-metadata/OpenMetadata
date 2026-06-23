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
"""TopologyRunnerMixin: per-instance registry, progress path, no declare_totals."""

import inspect

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

    def test_container_expected_count_defaults_to_unknown(self):
        assert TopologyRunnerMixin().container_expected_count("Database") is None

    def test_root_node_detection_uses_iter_captured_ids(self):
        runner = TopologyRunnerMixin()
        root, child = object(), object()
        assert runner._is_root_node(root) is False  # nothing captured yet
        runner.__dict__["_root_node_ids"] = {id(root)}
        assert runner._is_root_node(root) is True
        assert runner._is_root_node(child) is False


class _FakeRegistry:
    def __init__(self):
        self.advances = []
        self.globals = {}

    def open(self, *args, **kwargs):
        pass

    def advance(self, path, child_type=None):
        self.advances.append((tuple(path), child_type))

    def set_global_expected(self, child_type, expected):
        self.globals[child_type] = expected


class _Runner(TopologyRunnerMixin):
    progress_tracking_enabled = True

    def __init__(self, totals):
        self._totals = totals
        self.__dict__["_progress_registry"] = _FakeRegistry()

    def prefetch_global_totals(self):
        return self._totals


def test_prefetch_global_totals_fires_once_and_populates_registry():
    runner = _Runner({"DatabaseSchema": 42})
    runner._maybe_prefetch_global_totals()
    runner._maybe_prefetch_global_totals()
    assert runner.progress.globals == {"DatabaseSchema": 42}


def test_default_prefetch_and_snapshot_hooks_are_inert():
    runner = _Runner({})
    runner._maybe_prefetch_global_totals()
    assert runner.progress.globals == {}
    assert TopologyRunnerMixin.prefetch_global_totals(runner) == {}


class _WalkRunner(TopologyRunnerMixin):
    """Drives the real _process_node gating while stubbing the orthogonal
    producer/stage execution, so the test exercises the gate, not the sink."""

    topology = DatabaseServiceTopology()

    def __init__(self, enabled):
        self.progress_tracking_enabled = enabled
        self.context = TopologyContextManager(self.topology)
        self.__dict__["_root_node_ids"] = set()

    def _run_node_producer(self, node):
        return ["a", "b"]

    def _process_stage(self, stage, node_entity):
        return iter(())


def _drive_leaf(runner):
    leaf = get_topology_node("table", runner.topology)
    list(runner._process_node(leaf))


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
