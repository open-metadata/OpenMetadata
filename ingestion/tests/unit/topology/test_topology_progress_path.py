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
        assert _DBLikeRunner(database="db").current_progress_path("Database") == []

    def test_schema_node_opens_under_its_database(self):
        runner = _DBLikeRunner(database="db")
        assert runner.current_progress_path("DatabaseSchema") == ["db"]

    def test_table_node_opens_under_database_and_schema(self):
        runner = _DBLikeRunner(database="db", database_schema="sales")
        assert runner.current_progress_path("Table") == ["db", "sales"]

    def test_stored_procedure_opens_under_database_and_schema(self):
        runner = _DBLikeRunner(database="db", database_schema="sales")
        assert runner.current_progress_path("StoredProcedure") == ["db", "sales"]

    def test_schema_node_ignores_stale_sibling_schema_context(self):
        runner = _DBLikeRunner(database="db2", database_schema="stale_from_db1")
        assert runner.current_progress_path("DatabaseSchema") == ["db2"]

    def test_unknown_entity_type_yields_empty_path(self):
        assert _DBLikeRunner(database="db").current_progress_path("Nope") == []

    def test_none_entity_type_does_not_touch_topology_or_context(self):
        # The default surface test: no entity type means no path, and the
        # method must not require topology/context to be set.
        assert TopologyRunnerMixin().current_progress_path() == []

    def test_root_context_keys_derived_from_topology(self):
        assert _DBLikeRunner().current_progress_path  # smoke: method resolves
        assert _DBLikeRunner()._root_context_keys() == {"database_service"}


class TestShouldTrackProgress:
    def _runner(self, enabled):
        runner = TopologyRunnerMixin()
        runner.progress_tracking_enabled = enabled
        runner.__dict__["_root_node_ids"] = set()
        return runner

    def test_disabled_never_tracks(self):
        assert self._runner(False)._should_track_progress(object(), "Table") is False

    def test_enabled_real_entity_tracks(self):
        assert self._runner(True)._should_track_progress(object(), "Table") is True

    def test_enabled_but_no_entity_type_does_not_track(self):
        assert self._runner(True)._should_track_progress(object(), None) is False

    def test_enabled_root_node_does_not_track(self):
        runner = self._runner(True)
        root = object()
        runner.__dict__["_root_node_ids"] = {id(root)}
        assert runner._should_track_progress(root, "Database") is False

    def test_default_flag_is_false(self):
        assert TopologyRunnerMixin.progress_tracking_enabled is False
