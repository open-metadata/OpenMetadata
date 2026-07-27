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
"""Unit tests for ``metadata.domain.tags.TagRegistry``.

Covers attach/labels_for/drain/clear_scope/ensure_known semantics plus
basic thread-safety stress scenarios. The OM client is mocked; no
network or schema validation against a real backend.
"""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock

import pytest

from metadata.domain.tags import ScopeAlreadyClearedError, TagRegistry
from metadata.generated.schema.type.tagLabel import LabelType, State


@pytest.fixture
def mock_metadata() -> MagicMock:
    return MagicMock()


@pytest.fixture
def registry(mock_metadata: MagicMock) -> TagRegistry:
    return TagRegistry(metadata=mock_metadata)


def _attach_kwargs(
    scope: str,
    entity: str,
    classification: str = "TestClass",
    tag: str = "TestTag",
) -> dict:
    return {
        "scope_fqn": scope,
        "entity_fqn": entity,
        "classification_name": classification,
        "tag_name": tag,
        "classification_description": "test classification",
        "tag_description": "test tag",
    }


class TestAttachAndLabelsFor:
    def test_attach_then_labels_for_returns_one_label(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.table"))
        labels = registry.labels_for("svc.db.schema.table")
        assert len(labels) == 1

    def test_attach_multiple_tags_same_entity_returns_all(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.table", tag="Tag1"))
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.table", tag="Tag2"))
        labels = registry.labels_for("svc.db.schema.table")
        assert len(labels) == 2

    def test_labels_for_unattached_entity_returns_empty_list(self, registry: TagRegistry):
        assert registry.labels_for("svc.db.schema.unknown") == []

    def test_labels_for_is_idempotent(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.table"))
        first = registry.labels_for("svc.db.schema.table")
        second = registry.labels_for("svc.db.schema.table")
        # Read-and-leave: both reads return the same labels.
        # Cleanup is the responsibility of clear_scope, not labels_for.
        assert len(first) == 1
        assert second == first

    def test_labels_for_returns_copy_not_internal_list(self, registry: TagRegistry):
        # Mutating the returned list must not affect registry state.
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.table"))
        first = registry.labels_for("svc.db.schema.table")
        first.clear()
        second = registry.labels_for("svc.db.schema.table")
        assert len(second) == 1


class TestDrain:
    def test_drain_yields_pending_then_clears(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_a"))
        first = list(registry.drain())
        second = list(registry.drain())
        assert len(first) == 1
        assert second == []

    def test_drain_dedupes_same_tag_across_entities(self, registry: TagRegistry):
        for i in range(100):
            registry.attach(**_attach_kwargs("svc.db", f"svc.db.schema.tbl_{i}"))
        pending = list(registry.drain())
        assert len(pending) == 1

    def test_drain_yields_distinct_payloads_for_distinct_tags(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_1", tag="TagA"))
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_2", tag="TagB"))
        pending = list(registry.drain())
        assert len(pending) == 2

    def test_drain_does_not_dedup_across_case_variants(self, registry: TagRegistry):
        # OM stores tags case-sensitively; our dedup must follow that rule.
        registry.attach(**_attach_kwargs("svc.db", "svc.db.t1", tag="Sensitive"))
        registry.attach(**_attach_kwargs("svc.db", "svc.db.t2", tag="sensitive"))
        pending = list(registry.drain())
        assert len(pending) == 2  # both must PUT — they're distinct tags server-side

    def test_drain_dedupes_same_fqn_across_label_types(self, registry: TagRegistry):
        # Different cache keys (label_type varies) but identical tag_fqn → ONE PUT.
        # Cache key is (class, tag, label_type, state); tag_fqn is class.tag.
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.t1"),
            label_type=LabelType.Manual,
        )
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.t2"),
            label_type=LabelType.Automated,
        )
        pending = list(registry.drain())
        assert len(pending) == 1, "fqn-level dedup must collapse PUTs across label_type variants"


class TestClearScope:
    def test_clear_scope_drops_descendant_labels(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db.schema", "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs("svc.db.schema", "svc.db.schema.tbl_2"))
        registry.clear_scope("svc.db.schema")
        assert registry.labels_for("svc.db.schema.tbl_1") == []
        assert registry.labels_for("svc.db.schema.tbl_2") == []

    def test_clear_scope_drops_scope_itself(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db.schema", "svc.db.schema"))
        registry.clear_scope("svc.db.schema")
        assert registry.labels_for("svc.db.schema") == []

    def test_clear_scope_preserves_other_scopes(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db.schema_a", "svc.db.schema_a.tbl"))
        registry.attach(**_attach_kwargs("svc.db.schema_b", "svc.db.schema_b.tbl"))
        registry.clear_scope("svc.db.schema_a")
        assert registry.labels_for("svc.db.schema_a.tbl") == []
        assert len(registry.labels_for("svc.db.schema_b.tbl")) == 1

    def test_clear_scope_no_false_prefix_match(self, registry: TagRegistry):
        # 'schema_a' is NOT a prefix of 'schema_alpha' once the FQN
        # separator is taken into account.
        registry.attach(**_attach_kwargs("svc.db.schema_alpha", "svc.db.schema_alpha.tbl"))
        registry.clear_scope("svc.db.schema_a")
        assert len(registry.labels_for("svc.db.schema_alpha.tbl")) == 1

    def test_clear_scope_idempotent_on_unattached_scope(self, registry: TagRegistry):
        registry.clear_scope("svc.db.never_attached")  # must not raise

    def test_attach_after_clear_raises(self, registry: TagRegistry):
        registry.clear_scope("svc.db.schema")
        with pytest.raises(ScopeAlreadyClearedError):
            registry.attach(**_attach_kwargs("svc.db.schema", "svc.db.schema.tbl"))


class TestEnsureKnown:
    def test_is_known_empty_returns_false(self, registry: TagRegistry):
        assert registry.is_known("Class.Tag") is False

    def test_is_known_after_attach_returns_true(self, registry: TagRegistry):
        registry.attach(
            **_attach_kwargs(
                "svc.db",
                "svc.db.schema.tbl",
                classification="Class",
                tag="Tag",
            )
        )
        assert registry.is_known("Class.Tag") is True

    def test_is_known_is_case_sensitive(self, registry: TagRegistry):
        # Reflects OM's case-sensitive identity rule.
        registry.attach(
            **_attach_kwargs(
                "svc.db",
                "svc.db.schema.tbl",
                classification="Class",
                tag="Tag",
            )
        )
        assert registry.is_known("Class.Tag") is True
        assert registry.is_known("class.tag") is False  # different tag server-side

    def test_ensure_known_cache_hit_skips_io(self, registry: TagRegistry, mock_metadata: MagicMock):
        registry.attach(
            **_attach_kwargs(
                "svc.db",
                "svc.db.schema.tbl",
                classification="Class",
                tag="Tag",
            )
        )
        assert registry.ensure_known("Class.Tag") is True
        mock_metadata.get_by_name.assert_not_called()

    def test_ensure_known_cache_miss_calls_get_by_name_once(self, registry: TagRegistry, mock_metadata: MagicMock):
        mock_metadata.get_by_name.return_value = MagicMock()
        assert registry.ensure_known("Other.Tag") is True
        assert registry.ensure_known("Other.Tag") is True  # cached now
        assert mock_metadata.get_by_name.call_count == 1

    def test_ensure_known_404_returns_false_and_does_not_cache(self, registry: TagRegistry, mock_metadata: MagicMock):
        mock_metadata.get_by_name.return_value = None
        assert registry.ensure_known("Missing.Tag") is False
        assert registry.ensure_known("Missing.Tag") is False
        # Re-queries on each miss; not cached.
        assert mock_metadata.get_by_name.call_count == 2

    def test_ensure_known_swallows_exception(self, registry: TagRegistry, mock_metadata: MagicMock):
        mock_metadata.get_by_name.side_effect = RuntimeError("network down")
        assert registry.ensure_known("Crashed.Tag") is False


class TestThreadSafety:
    def test_concurrent_attach_same_tag_dedupes_pending(self, registry: TagRegistry):
        def worker(thread_idx: int) -> None:
            for i in range(100):
                registry.attach(
                    **_attach_kwargs(
                        "svc.db",
                        f"svc.db.schema.tbl_{thread_idx}_{i}",
                    )
                )

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(worker, range(8)))

        pending = list(registry.drain())
        assert len(pending) == 1

    def test_concurrent_disjoint_scopes_no_label_loss(self, registry: TagRegistry):
        def worker(scope_idx: int) -> None:
            scope = f"svc.db.schema_{scope_idx}"
            for i in range(50):
                registry.attach(
                    **_attach_kwargs(
                        scope,
                        f"{scope}.tbl_{i}",
                        tag=f"Tag_{scope_idx}_{i}",
                    )
                )

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(worker, range(8)))

        for scope_idx in range(8):
            scope = f"svc.db.schema_{scope_idx}"
            for i in range(50):
                entity = f"{scope}.tbl_{i}"
                labels = registry.labels_for(entity)
                assert len(labels) == 1, f"missing label for {entity}"


class TestStats:
    def test_initial_stats_all_zero(self, registry: TagRegistry):
        assert registry.stats() == {
            "known_tag_fqns": 0,
            "tag_label_cache": 0,
            "pending": 0,
            "cleared_scopes": 0,
            "live_entities": 0,
            "live_labels": 0,
        }

    def test_stats_reflect_attach(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_2"))
        s = registry.stats()
        # Both attaches share the same tag — known + pending dedup to 1
        assert s["known_tag_fqns"] == 1
        assert s["pending"] == 1
        # Two entities, each with one label
        assert s["live_entities"] == 2
        assert s["live_labels"] == 2

    def test_labels_for_does_not_decrease_live_state(self, registry: TagRegistry):
        # labels_for is idempotent (read-and-leave); clear_scope is the
        # only mechanism that reduces live state.
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl"))
        registry.labels_for("svc.db.schema.tbl")
        s = registry.stats()
        assert s["live_entities"] == 1
        assert s["live_labels"] == 1
        assert s["known_tag_fqns"] == 1
        assert s["pending"] == 1

    def test_drain_decreases_pending_only(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl"))
        list(registry.drain())
        s = registry.stats()
        assert s["pending"] == 0
        assert s["known_tag_fqns"] == 1  # still tracked for dedup

    def test_clear_scope_zeroes_live_state_for_scope(self, registry: TagRegistry):
        # Critical invariant: after clear_scope, no live_entities for that scope.
        for i in range(50):
            registry.attach(**_attach_kwargs("svc.db.schema", f"svc.db.schema.tbl_{i}"))
        assert registry.stats()["live_entities"] == 50

        registry.clear_scope("svc.db.schema")
        s = registry.stats()
        assert s["live_entities"] == 0
        assert s["live_labels"] == 0
        assert s["cleared_scopes"] == 1


class TestInterning:
    """TagLabel interning — multiple attaches with the same key share one
    underlying ``TagLabel`` instance. Memory bound depends on this; the
    `is`-identity assertion is the load-bearing check."""

    def test_attach_interns_identical_tag_labels(self, registry: TagRegistry):
        # Same (classification, tag, label_type, state) across two entities
        # must return the exact same TagLabel object — not just an equal one.
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs("svc.db", "svc.db.schema.tbl_2"))

        label_1 = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_2 = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_1 is label_2, "expected shared TagLabel instance via interning"

    def test_attach_does_not_intern_across_label_types(self, registry: TagRegistry):
        # Cache key includes label_type — non-default values must not collide.
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.schema.tbl_1"),
            label_type=LabelType.Manual,
        )
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.schema.tbl_2"),
            label_type=LabelType.Automated,
        )

        label_manual = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_auto = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_manual is not label_auto
        assert label_manual.labelType == LabelType.Manual
        assert label_auto.labelType == LabelType.Automated

    def test_attach_does_not_intern_across_states(self, registry: TagRegistry):
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.schema.tbl_1"),
            state=State.Suggested,
        )
        registry.attach(
            **_attach_kwargs("svc.db", "svc.db.schema.tbl_2"),
            state=State.Confirmed,
        )

        label_suggested = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_confirmed = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_suggested is not label_confirmed

    def test_intern_cache_survives_clear_scope(self, registry: TagRegistry):
        # Cache lifetime is registry lifetime, NOT scope lifetime — next scope
        # reuses the same TagLabel instance for the same (class, tag, ...) key.
        registry.attach(**_attach_kwargs("svc.db.schema_1", "svc.db.schema_1.tbl"))
        label_first = registry.labels_for("svc.db.schema_1.tbl")[0]

        registry.clear_scope("svc.db.schema_1")

        registry.attach(**_attach_kwargs("svc.db.schema_2", "svc.db.schema_2.tbl"))
        label_second = registry.labels_for("svc.db.schema_2.tbl")[0]

        assert label_first is label_second, "intern cache should survive clear_scope"
