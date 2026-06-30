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
"""Unit tests for the hierarchical (tree) ProgressRegistry."""

import threading

from metadata.utils.progress_registry import ProgressRegistry


def _by_label(snapshot):
    return {child.label: child for child in snapshot.children}


class TestTreeProgress:
    def test_empty_registry_snapshots_none(self):
        assert ProgressRegistry().snapshot() is None

    def test_root_counts_databases_as_bare_when_expected_unknown(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        snap = reg.snapshot()
        assert snap.child_type == "Database"
        assert snap.expected is None
        assert snap.processed == 0
        assert snap.active is True

    def test_leaf_advance_increments_processed_against_expected(self):
        reg = ProgressRegistry()
        reg.open(["xyz"], "DatabaseSchema", 10)
        reg.open(["xyz", "abc"], "Table", 100)
        for _ in range(20):
            reg.advance(["xyz", "abc"])
        abc = _by_label(_by_label(reg.snapshot())["xyz"])["abc"]
        assert abc.processed == 20
        assert abc.expected == 100
        assert abc.active is True

    def test_container_completion_is_derived_from_children(self):
        reg = ProgressRegistry()
        reg.open([], "Database", 1)
        reg.open(["xyz"], "DatabaseSchema", 2)
        reg.open(["xyz", "abc"], "Table", 1)
        reg.open(["xyz", "def"], "Table", 1)
        reg.advance(["xyz", "abc"])  # only one of two schemas complete
        xyz = _by_label(reg.snapshot())["xyz"]
        assert xyz.processed == 1
        assert xyz.expected == 2
        assert xyz.active is True

    def test_completed_subtree_is_pruned_and_root_completes(self):
        reg = ProgressRegistry()
        reg.open([], "Database", 1)
        reg.open(["xyz"], "DatabaseSchema", 1)
        reg.open(["xyz", "abc"], "Table", 1)
        reg.advance(["xyz", "abc"])  # schema done -> db done -> root done
        snap = reg.snapshot()
        assert snap.processed == 1
        assert snap.expected == 1
        assert snap.active is False
        assert snap.children == ()  # completed db pruned

    def test_empty_schema_auto_completes_and_vanishes(self):
        reg = ProgressRegistry()
        reg.open(["xyz"], "DatabaseSchema", 2)
        reg.open(["xyz", "empty"], "Table", 0)  # zero-table schema -> complete
        reg.open(["xyz", "live"], "Table", 5)  # in-flight keeps xyz visible
        reg.advance(["xyz", "live"])
        xyz = _by_label(reg.snapshot())["xyz"]
        schemas = _by_label(xyz)
        assert "empty" not in schemas  # completed empty schema pruned
        assert "live" in schemas  # active schema still shown
        assert xyz.processed == 1  # empty counted as one complete child

    def test_unknown_expected_advance_renders_bare_count(self):
        reg = ProgressRegistry()
        reg.advance(["topic"])  # advanced without a prior open
        reg.advance(["topic"])
        node = _by_label(reg.snapshot())["topic"]
        assert node.processed == 2
        assert node.expected is None
        assert node.active is True

    def test_over_count_is_pruned_and_no_visible_node_exceeds_expected(self):
        reg = ProgressRegistry()
        reg.open(["xyz"], "DatabaseSchema", 2)
        reg.open(["xyz", "abc"], "Table", 2)
        reg.open(["xyz", "live"], "Table", 9)
        for _ in range(5):  # 5 advances against expected 2 -> over-counted
            reg.advance(["xyz", "abc"])
        reg.advance(["xyz", "live"])
        xyz = _by_label(reg.snapshot())["xyz"]
        assert "abc" not in _by_label(xyz)  # over-counted -> complete -> pruned
        assert xyz.processed == 1  # abc counted as one complete child

        def _no_overrun(node):
            assert node.expected is None or node.processed <= node.expected
            for child in node.children:
                _no_overrun(child)

        _no_overrun(reg.snapshot())

    def test_multi_leaf_type_schema_sums_expected(self):
        reg = ProgressRegistry()
        reg.open(["xyz", "abc"], "Table", 100)
        reg.open(["xyz", "abc"], "StoredProcedure", 5)
        for _ in range(7):
            reg.advance(["xyz", "abc"])
        abc = _by_label(_by_label(reg.snapshot())["xyz"])["abc"]
        assert abc.expected == 105
        assert abc.processed == 7
        assert abc.child_type == "Table"  # first opener is the label

    def test_active_leaf_cap_overflows(self):
        reg = ProgressRegistry(active_leaf_cap=2)
        reg.open(["db"], "DatabaseSchema", 50)
        for i in range(5):
            reg.open(["db", f"s{i}"], "Table", 10)
            reg.advance(["db", f"s{i}"])  # in-flight, not complete
        db = _by_label(reg.snapshot())["db"]
        assert len(db.children) == 2
        assert db.overflow == 3

    def test_snapshot_is_detached(self):
        reg = ProgressRegistry()
        reg.open(["xyz", "abc"], "Table", 100)
        reg.advance(["xyz", "abc"])
        snap = reg.snapshot()
        reg.advance(["xyz", "abc"])
        abc = _by_label(_by_label(snap)["xyz"])["abc"]
        assert abc.processed == 1  # frozen at snapshot time

    def test_real_thread_concurrency_converges(self):
        reg = ProgressRegistry()
        reg.open([], "Database", 1)
        reg.open(["db"], "DatabaseSchema", 8)
        for i in range(8):
            reg.open(["db", f"s{i}"], "Table", 10)

        def work(schema):
            for _ in range(10):
                reg.advance(["db", schema])

        threads = [threading.Thread(target=work, args=(f"s{i}",)) for i in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        snap = reg.snapshot()
        assert snap.processed == 1  # the one database completed
        assert snap.active is False


class TestRegistryPrimitives:
    def test_advance_tracks_processed_per_child_type(self):
        reg = ProgressRegistry()
        reg.open(["db", "s1"], "Table", 10)
        reg.open(["db", "s1"], "StoredProcedure", 4)
        for _ in range(3):
            reg.advance(["db", "s1"], "Table")
        reg.advance(["db", "s1"], "StoredProcedure")
        s1 = _by_label(_by_label(reg.snapshot())["db"])["s1"]
        assert s1.processed_by_type == {"Table": 3, "StoredProcedure": 1}
        assert s1.expected_by_type == {"Table": 10, "StoredProcedure": 4}
        assert s1.processed == 4  # combined, unchanged generic semantics

    def test_advance_without_child_type_uses_node_child_type(self):
        reg = ProgressRegistry()
        reg.open(["db", "s1"], "Table", 5)
        reg.advance(["db", "s1"])
        s1 = _by_label(_by_label(reg.snapshot())["db"])["s1"]
        assert s1.processed_by_type == {"Table": 1}

    def test_completed_at_depth_counts_complete_nodes_including_pruned(self):
        reg = ProgressRegistry()
        reg.open([], "Database", 2)
        for db in ("d1", "d2"):
            reg.open([db], "DatabaseSchema", 1)
        # d1.s1 complete (1/1), d2.s1 in-flight (0/1)
        reg.open(["d1", "s1"], "Table", 1)
        reg.advance(["d1", "s1"], "Table")
        reg.open(["d2", "s1"], "Table", 3)
        reg.advance(["d2", "s1"], "Table")
        assert reg.completed_at_depth(1) == 1  # d1 complete, d2 not
        assert reg.completed_at_depth(2) == 1  # d1.s1 complete, d2.s1 not

    def test_snapshot_cap_override_widens_active_children(self):
        reg = ProgressRegistry(active_leaf_cap=1)
        reg.open(["db"], "DatabaseSchema", 9)
        for i in range(3):
            reg.open(["db", f"s{i}"], "Table", 5)
            reg.advance(["db", f"s{i}"], "Table")
        db_default = _by_label(reg.snapshot())["db"]
        db_wide = _by_label(reg.snapshot(active_leaf_cap=10))["db"]
        assert len(db_default.children) == 1  # capped
        assert len(db_wide.children) == 3  # override lifts the cap

    def test_completed_snapshots_at_depth_returns_finished_nodes_with_detail(self):
        reg = ProgressRegistry()
        reg.open([], "Database", 1)
        reg.open(["d1"], "DatabaseSchema", 2)
        reg.open(["d1", "orders"], "Table", 2)
        reg.open(["d1", "orders"], "StoredProcedure", 1)
        reg.advance(["d1", "orders"], "Table")
        reg.advance(["d1", "orders"], "Table")
        reg.advance(["d1", "orders"], "StoredProcedure")
        reg.open(["d1", "public"], "Table", 5)  # still in-flight
        reg.advance(["d1", "public"], "Table")
        completed = reg.completed_snapshots_at_depth(2)
        assert len(completed) == 1  # only the finished schema
        ancestors, snap = completed[0]
        assert ancestors == ("d1",)
        assert snap.label == "orders"
        assert snap.active is False
        assert snap.processed_by_type == {"Table": 2, "StoredProcedure": 1}
        assert snap.expected_by_type == {"Table": 2, "StoredProcedure": 1}

    def test_completed_snapshots_at_depth_caps_to_last_limit(self):
        reg = ProgressRegistry()
        for i in range(5):
            reg.open(["d1", f"s{i}"], "Table", 1)
            reg.advance(["d1", f"s{i}"], "Table")  # all complete
        completed = reg.completed_snapshots_at_depth(2, limit=2)
        assert [snap.label for _, snap in completed] == ["s3", "s4"]  # last two


class TestOpenKeepsKnownExpected:
    def test_lazy_open_does_not_clobber_known_expected(self):
        registry = ProgressRegistry()
        registry.open(["db", "s"], "Table", 5)
        registry.open(["db", "s"], "Table", None)
        snapshot = registry.snapshot()
        schema = snapshot.children[0].children[0]
        assert schema.expected == 5


class TestAssetCounterAndClose:
    def test_advance_increments_assets_ingested(self):
        registry = ProgressRegistry()
        registry.advance(["db", "s"], "Table")
        registry.advance(["db", "s"], "Table")
        assert registry.assets_ingested() == 2

    def test_assets_ingested_is_monotonic_across_close(self):
        registry = ProgressRegistry()
        registry.advance(["db", "s1"], "Table")
        registry.advance(["db", "s1"], "Table")
        registry.close(["db", "s1"])
        assert registry.assets_ingested() == 2  # survives the prune
        registry.advance(["db", "s2"], "Table")
        assert registry.assets_ingested() == 3

    def test_close_removes_node_from_parent(self):
        registry = ProgressRegistry()
        registry.open(["db", "s1"], "Table", 5)
        registry.advance(["db", "s1"], "Table")
        registry.open(["db", "s2"], "Table", 5)
        registry.advance(["db", "s2"], "Table")
        registry.close(["db", "s1"])
        snapshot = registry.snapshot()
        database = snapshot.children[0]
        labels = {child.label for child in database.children}
        assert "s1" not in labels
        assert "s2" in labels

    def test_close_absent_or_empty_path_is_noop(self):
        registry = ProgressRegistry()
        registry.close([])  # empty: no-op
        registry.close(["ghost"])  # absent: no-op
        assert registry.snapshot() is None


class TestGlobalCounters:
    def test_global_counters_empty_by_default(self):
        reg = ProgressRegistry()
        assert reg.global_counters() == []

    def test_set_total_then_track(self):
        reg = ProgressRegistry()
        reg.set_total("Database", 4)
        assert reg.global_counters() == [("Database", 0, 4)]
        reg.track("Database")
        reg.track("Database")
        assert reg.global_counters() == [("Database", 2, 4)]

    def test_set_total_with_unknown_total(self):
        reg = ProgressRegistry()
        reg.set_total("Workspaces", None)
        reg.track("Workspaces")
        assert reg.global_counters() == [("Workspaces", 1, None)]

    def test_track_unknown_type_is_noop(self):
        reg = ProgressRegistry()
        reg.track("Nope")
        assert reg.global_counters() == []

    def test_track_does_not_touch_asset_counter(self):
        reg = ProgressRegistry()
        reg.advance([], "Table")
        reg.set_total("Database", 3)
        reg.track("Database")
        assert reg.assets_ingested() == 1
        assert reg.global_counters() == [("Database", 1, 3)]

    def test_seed_scope_total_sums_and_is_reconcilable(self):
        reg = ProgressRegistry()
        reg.seed_scope_total("DatabaseSchema", "db1", 10)
        reg.seed_scope_total("DatabaseSchema", "db2", 35)
        assert reg.global_counters() == [("DatabaseSchema", 0, 45)]
        assert reg.is_reconcilable("DatabaseSchema") is True
        assert reg.is_reconcilable("Database") is False

    def test_reconcile_scope_total_applies_delta(self):
        reg = ProgressRegistry()
        reg.seed_scope_total("DatabaseSchema", "db1", 10)
        reg.seed_scope_total("DatabaseSchema", "db2", 35)
        reg.reconcile_scope_total("DatabaseSchema", "db1", 12)
        assert reg.global_counters() == [("DatabaseSchema", 0, 47)]

    def test_reconcile_unknown_type_is_noop(self):
        reg = ProgressRegistry()
        reg.reconcile_scope_total("DatabaseSchema", "db1", 5)
        assert reg.global_counters() == []

    def test_total_never_below_done(self):
        reg = ProgressRegistry()
        reg.seed_scope_total("DatabaseSchema", "db1", 1)
        reg.track("DatabaseSchema")
        reg.track("DatabaseSchema")
        assert reg.global_counters() == [("DatabaseSchema", 2, 2)]

    def test_set_reconcilable_creates_counter(self):
        reg = ProgressRegistry()
        reg.set_reconcilable("DatabaseSchema")
        assert reg.is_reconcilable("DatabaseSchema") is True
        reg.reconcile_scope_total("DatabaseSchema", "db1", 7)
        assert reg.global_counters() == [("DatabaseSchema", 0, 7)]
