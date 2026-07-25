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
"""Generic, topology-driven current_progress_path on TopologyRunnerMixin.

These tests exercise the base-class method directly against the standard
database topology, bypassing the (still-present) DatabaseServiceSource
override, so they prove the consumer-derivation rule on its own.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import get_topology_node
from metadata.ingestion.progress.modes import ProgressMode
from metadata.ingestion.progress.runner_tracker import NO_OP_NODE_PROGRESS
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceTopology,
)


class _DBLikeRunner(TopologyRunnerMixin):
    """Bare runner carrying the standard DB topology — no override in its MRO."""

    topology = DatabaseServiceTopology()

    def __init__(self, database=None, database_schema=None):
        ctx = SimpleNamespace(database=database, database_schema=database_schema)
        self.context = MagicMock()
        self.context.get.return_value = ctx


class TestGenericProgressPath:
    def test_database_node_opens_at_root(self):
        assert _DBLikeRunner(database="db").progress_tracker.current_path("Database") == []

    def test_schema_node_opens_under_its_database(self):
        runner = _DBLikeRunner(database="db")
        assert runner.progress_tracker.current_path("DatabaseSchema") == ["db"]

    def test_table_node_opens_under_database_and_schema(self):
        runner = _DBLikeRunner(database="db", database_schema="sales")
        assert runner.progress_tracker.current_path("Table") == ["db", "sales"]

    def test_stored_procedure_opens_under_database_and_schema(self):
        runner = _DBLikeRunner(database="db", database_schema="sales")
        assert runner.progress_tracker.current_path("StoredProcedure") == ["db", "sales"]

    def test_schema_node_ignores_stale_sibling_schema_context(self):
        runner = _DBLikeRunner(database="db2", database_schema="stale_from_db1")
        assert runner.progress_tracker.current_path("DatabaseSchema") == ["db2"]

    def test_unknown_entity_type_yields_empty_path(self):
        assert _DBLikeRunner(database="db").progress_tracker.current_path("Nope") == []

    def test_none_entity_type_does_not_touch_topology_or_context(self):
        # The default surface test: no entity type means no path, and the
        # method must not require topology/context to be set.
        assert TopologyRunnerMixin().progress_tracker.current_path() == []

    def test_root_context_keys_derived_from_topology(self):
        assert _DBLikeRunner().progress_tracker.current_path  # smoke: method resolves
        assert _DBLikeRunner().progress_tracker._root_context_keys() == {"database_service"}


class TestShouldTrackProgress:
    def _runner(self, mode):
        runner = _DBLikeRunner()
        runner.progress_mode = mode
        return runner

    def test_disabled_never_tracks(self):
        runner = self._runner(ProgressMode.OFF)
        table_node = get_topology_node("table", runner.topology)
        assert runner.progress_tracker.for_node(table_node, is_leaf=True) is NO_OP_NODE_PROGRESS

    def test_enabled_real_entity_tracks(self):
        runner = self._runner(ProgressMode.AUTO)
        table_node = get_topology_node("table", runner.topology)
        assert runner.progress_tracker.for_node(table_node, is_leaf=True) is not NO_OP_NODE_PROGRESS

    def test_enabled_but_no_entity_type_does_not_track(self):
        runner = self._runner(ProgressMode.AUTO)
        node = SimpleNamespace(stages=[])
        assert runner.progress_tracker.for_node(node, is_leaf=True) is NO_OP_NODE_PROGRESS

    def test_enabled_root_node_does_not_track(self):
        runner = self._runner(ProgressMode.AUTO)
        root_node = get_topology_node("root", runner.topology)
        runner.progress_tracker.on_walk_start([root_node])
        assert runner.progress_tracker.for_node(root_node, is_leaf=False) is NO_OP_NODE_PROGRESS

    def test_default_mode_is_auto(self):
        assert TopologyRunnerMixin.progress_mode is ProgressMode.AUTO
