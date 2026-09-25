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

Covers definitions, attachments, bounded deduplication and scope cleanup,
including concurrent registration.
"""

import weakref
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import pytest

from metadata.domain.tags import TagDefinition, TagRegistry
from metadata.generated.schema.type.tagLabel import LabelType, State


@pytest.fixture
def registry() -> TagRegistry:
    return TagRegistry()


def _attach_kwargs(
    registry: TagRegistry,
    entity: str,
    classification: str = "TestClass",
    tag: str = "TestTag",
) -> dict:
    definition = TagDefinition(classification, tag, "test classification", "test tag")
    registry.define(definition)
    return {
        "entity_fqn": entity,
        "tag": definition,
    }


class TestAttachAndLabelsFor:
    def test_attach_then_labels_for_returns_one_label(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.table"))
        labels = registry.labels_for("svc.db.schema.table")
        assert len(labels) == 1

    def test_attach_multiple_tags_same_entity_returns_all(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.table", tag="Tag1"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.table", tag="Tag2"))
        labels = registry.labels_for("svc.db.schema.table")
        assert len(labels) == 2

    def test_labels_for_unattached_entity_returns_empty_list(self, registry: TagRegistry):
        assert registry.labels_for("svc.db.schema.unknown") == []

    def test_labels_for_is_idempotent(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.table"))
        first = registry.labels_for("svc.db.schema.table")
        second = registry.labels_for("svc.db.schema.table")
        # Read-and-leave: both reads return the same labels.
        # Cleanup is the responsibility of clear_scope, not labels_for.
        assert len(first) == 1
        assert second == first

    def test_labels_for_returns_copy_not_internal_list(self, registry: TagRegistry):
        # Mutating the returned list must not affect registry state.
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.table"))
        first = registry.labels_for("svc.db.schema.table")
        first.clear()
        second = registry.labels_for("svc.db.schema.table")
        assert len(second) == 1


class TestDrain:
    def test_interrupted_drain_preserves_unconfirmed_definitions(self, registry: TagRegistry):
        for name in ("First", "Second", "Third"):
            registry.define(TagDefinition("Class", name, "", ""))

        with closing(registry.drain()) as records:
            assert next(records).tag_request.name.root == "First"
            assert next(records).tag_request.name.root == "Second"

        with ThreadPoolExecutor(max_workers=1) as pool:
            remaining = pool.submit(lambda: list(registry.drain())).result(timeout=5)
        assert [record.tag_request.name.root for record in remaining] == ["Second", "Third"]
        assert registry.stats()["pending"] == 0
        assert list(registry.drain()) == []

    def test_discovery_continues_during_drain_without_duplicate_pending_definitions(self):
        registry = TagRegistry(cache_size=1)
        first, second, third = [TagDefinition("Class", name, "", "") for name in ("First", "Second", "Third")]
        registry.define(first)
        registry.define(second)

        with closing(registry.drain()) as records:
            assert next(records).tag_request.name.root == "First"

            def discover():
                registry.define(first)
                registry.define(third)
                registry.attach(entity_fqn="svc.db.schema.table", tag=third)
                labels = registry.labels_for("svc.db.schema.table")
                registry.clear_scope("svc.db.schema")
                return labels

            with ThreadPoolExecutor(max_workers=1) as pool:
                labels = pool.submit(discover).result(timeout=5)
            assert [label.tagFQN.root for label in labels] == ["Class.Third"]
            assert [record.tag_request.name.root for record in records] == ["Second"]

        assert [record.tag_request.name.root for record in registry.drain()] == ["Third"]
        assert registry.stats()["known_tag_fqns"] == registry.stats()["tag_label_cache"] == 1

    def test_drain_without_definitions_is_empty(self, registry: TagRegistry):
        assert list(registry.drain()) == []

    def test_repeated_definition_after_drain_is_not_reemitted(self, registry: TagRegistry):
        tag = TagDefinition("Class", "Tag", "", "")
        registry.define(tag)
        assert [record.tag_request.name.root for record in registry.drain()] == ["Tag"]
        registry.define(tag)
        assert list(registry.drain()) == []

    @pytest.mark.parametrize("classification,tag", [("class", "Tag"), ("Class", "tag")])
    def test_definition_history_preserves_case_variants(self, registry: TagRegistry, classification, tag):
        registry.define(TagDefinition("Class", "Tag", "", ""))
        assert [record.tag_request.name.root for record in registry.drain()] == ["Tag"]
        registry.define(TagDefinition(classification, tag, "", ""))
        records = list(registry.drain())
        assert [(record.classification_request.name.root, record.tag_request.name.root) for record in records] == [
            (classification, tag)
        ]

    def test_drain_yields_pending_then_clears(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_a"))
        first = list(registry.drain())
        second = list(registry.drain())
        assert len(first) == 1
        assert second == []

    def test_drain_dedupes_same_tag_across_entities(self, registry: TagRegistry):
        for i in range(100):
            registry.attach(**_attach_kwargs(registry, f"svc.db.schema.tbl_{i}"))
        pending = list(registry.drain())
        assert len(pending) == 1

    def test_drain_yields_distinct_payloads_for_distinct_tags(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_1", tag="TagA"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_2", tag="TagB"))
        pending = list(registry.drain())
        assert len(pending) == 2

    def test_drain_does_not_dedup_across_case_variants(self, registry: TagRegistry):
        # OM stores tags case-sensitively; our dedup must follow that rule.
        registry.attach(**_attach_kwargs(registry, "svc.db.t1", tag="Sensitive"))
        registry.attach(**_attach_kwargs(registry, "svc.db.t2", tag="sensitive"))
        pending = list(registry.drain())
        assert len(pending) == 2  # both must PUT — they're distinct tags server-side

    def test_drain_dedupes_same_fqn_across_label_types(self, registry: TagRegistry):
        # Different cache keys (label_type varies) but identical tag_fqn → ONE PUT.
        # Cache key is (class, tag, label_type, state); tag_fqn is class.tag.
        registry.attach(
            **_attach_kwargs(registry, "svc.db.t1"),
            label_type=LabelType.Manual,
        )
        registry.attach(
            **_attach_kwargs(registry, "svc.db.t2"),
            label_type=LabelType.Automated,
        )
        pending = list(registry.drain())
        assert len(pending) == 1, "fqn-level dedup must collapse PUTs across label_type variants"


class TestClearScope:
    def test_clear_scope_drops_descendant_labels(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_2"))
        registry.clear_scope("svc.db.schema")
        assert registry.labels_for("svc.db.schema.tbl_1") == []
        assert registry.labels_for("svc.db.schema.tbl_2") == []

    def test_clear_scope_drops_scope_itself(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema"))
        registry.clear_scope("svc.db.schema")
        assert registry.labels_for("svc.db.schema") == []

    def test_clear_scope_preserves_other_scopes(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema_a.tbl"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema_b.tbl"))
        registry.clear_scope("svc.db.schema_a")
        assert registry.labels_for("svc.db.schema_a.tbl") == []
        assert len(registry.labels_for("svc.db.schema_b.tbl")) == 1

    def test_clear_scope_no_false_prefix_match(self, registry: TagRegistry):
        # 'schema_a' is NOT a prefix of 'schema_alpha' once the FQN
        # separator is taken into account.
        registry.attach(**_attach_kwargs(registry, "svc.db.schema_alpha.tbl"))
        registry.clear_scope("svc.db.schema_a")
        assert len(registry.labels_for("svc.db.schema_alpha.tbl")) == 1

    def test_clear_scope_idempotent_on_unattached_scope(self, registry: TagRegistry):
        registry.clear_scope("svc.db.never_attached")  # must not raise

    @pytest.mark.parametrize("scope_fqn", ["svc.db", "svc.db.schema"])
    def test_attach_after_clear_starts_with_fresh_labels(self, registry: TagRegistry, scope_fqn):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl", tag="First"))
        registry.clear_scope(scope_fqn)
        assert registry.labels_for("svc.db.schema.tbl") == []

        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl", tag="Second"))
        assert [label.tagFQN.root for label in registry.labels_for("svc.db.schema.tbl")] == ["TestClass.Second"]
        registry.clear_scope(scope_fqn)
        assert registry.labels_for("svc.db.schema.tbl") == []


class TestThreadSafety:
    def test_concurrent_attach_same_tag_dedupes_pending(self, registry: TagRegistry):
        def worker(thread_idx: int) -> None:
            for i in range(100):
                registry.attach(
                    **_attach_kwargs(
                        registry,
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
                        registry,
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
            "live_entities": 0,
            "live_labels": 0,
        }

    def test_stats_reflect_attach(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_2"))
        s = registry.stats()
        # The pending definition is not yet part of emission history.
        assert s["known_tag_fqns"] == 0
        assert s["pending"] == 1
        # Two entities, each with one label
        assert s["live_entities"] == 2
        assert s["live_labels"] == 2

    def test_labels_for_does_not_decrease_live_state(self, registry: TagRegistry):
        # labels_for is idempotent (read-and-leave); clear_scope is the
        # only mechanism that reduces live state.
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl"))
        registry.labels_for("svc.db.schema.tbl")
        s = registry.stats()
        assert s["live_entities"] == 1
        assert s["live_labels"] == 1
        assert s["known_tag_fqns"] == 0
        assert s["pending"] == 1

    def test_drain_decreases_pending_only(self, registry: TagRegistry):
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl"))
        list(registry.drain())
        s = registry.stats()
        assert s["pending"] == 0
        assert s["known_tag_fqns"] == 1  # still tracked for dedup

    def test_clear_scope_zeroes_live_state_for_scope(self, registry: TagRegistry):
        # Critical invariant: after clear_scope, no live_entities for that scope.
        for i in range(50):
            registry.attach(**_attach_kwargs(registry, f"svc.db.schema.tbl_{i}"))
        assert registry.stats()["live_entities"] == 50

        registry.clear_scope("svc.db.schema")
        s = registry.stats()
        assert s["live_entities"] == 0
        assert s["live_labels"] == 0


class TestInterning:
    """TagLabel interning — multiple attaches with the same key share one
    underlying ``TagLabel`` instance. Memory bound depends on this; the
    `is`-identity assertion is the load-bearing check."""

    def test_attach_interns_identical_tag_labels(self, registry: TagRegistry):
        # Same (classification, tag, label_type, state) across two entities
        # must return the exact same TagLabel object — not just an equal one.
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_1"))
        registry.attach(**_attach_kwargs(registry, "svc.db.schema.tbl_2"))

        label_1 = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_2 = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_1 is label_2, "expected shared TagLabel instance via interning"

    def test_attach_does_not_intern_across_label_types(self, registry: TagRegistry):
        # Cache key includes label_type — non-default values must not collide.
        registry.attach(
            **_attach_kwargs(registry, "svc.db.schema.tbl_1"),
            label_type=LabelType.Manual,
        )
        registry.attach(
            **_attach_kwargs(registry, "svc.db.schema.tbl_2"),
            label_type=LabelType.Automated,
        )

        label_manual = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_auto = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_manual is not label_auto
        assert label_manual.labelType == LabelType.Manual
        assert label_auto.labelType == LabelType.Automated

    def test_attach_does_not_intern_across_states(self, registry: TagRegistry):
        registry.attach(
            **_attach_kwargs(registry, "svc.db.schema.tbl_1"),
            state=State.Suggested,
        )
        registry.attach(
            **_attach_kwargs(registry, "svc.db.schema.tbl_2"),
            state=State.Confirmed,
        )

        label_suggested = registry.labels_for("svc.db.schema.tbl_1")[0]
        label_confirmed = registry.labels_for("svc.db.schema.tbl_2")[0]

        assert label_suggested is not label_confirmed

    def test_intern_cache_survives_clear_scope(self, registry: TagRegistry):
        # Cache lifetime is registry lifetime, NOT scope lifetime — next scope
        # reuses the same TagLabel instance for the same (class, tag, ...) key.
        registry.attach(**_attach_kwargs(registry, "svc.db.schema_1.tbl"))
        label_first = registry.labels_for("svc.db.schema_1.tbl")[0]

        registry.clear_scope("svc.db.schema_1")

        registry.attach(**_attach_kwargs(registry, "svc.db.schema_2.tbl"))
        label_second = registry.labels_for("svc.db.schema_2.tbl")[0]

        assert label_first is label_second, "intern cache should survive clear_scope"


def test_pending_definitions_survive_history_eviction():
    registry = TagRegistry(cache_size=2)
    for tag in ("A", "B", "C", "A"):
        registry.attach(**_attach_kwargs(registry, f"svc.db.{tag}", tag=tag))
    assert registry.stats()["pending"] == 3
    assert [record.tag_request.name.root for record in registry.drain()] == ["A", "B", "C"]
    assert registry.stats()["known_tag_fqns"] == 2
    assert registry.stats()["tag_label_cache"] == 2
    assert [label.tagFQN.root for label in registry.labels_for("svc.db.A")] == ["TestClass.A", "TestClass.A"]


def test_evicted_definition_is_reemitted_without_losing_live_labels():
    registry = TagRegistry(cache_size=2)
    for tag in ("A", "B", "C"):
        registry.attach(**_attach_kwargs(registry, f"svc.db.{tag}", tag=tag))
        assert [record.tag_request.name.root for record in registry.drain()] == [tag]
    registry.attach(**_attach_kwargs(registry, "svc.db.another", tag="A"))
    assert [record.tag_request.name.root for record in registry.drain()] == ["A"]
    for tag in ("A", "B", "C"):
        assert [label.tagFQN.root for label in registry.labels_for(f"svc.db.{tag}")] == [f"TestClass.{tag}"]


def test_recently_used_definition_is_retained():
    registry = TagRegistry(cache_size=2)
    for tag, expected in (("A", ["A"]), ("B", ["B"]), ("A", []), ("C", ["C"]), ("A", []), ("B", ["B"])):
        registry.attach(**_attach_kwargs(registry, "svc.db.table", tag=tag))
        assert [record.tag_request.name.root for record in registry.drain()] == expected


def test_recently_used_label_stays_interned_after_eviction():
    registry = TagRegistry(cache_size=2)
    for index, name in enumerate(("First", "Second", "First", "Third", "First", "Second")):
        registry.attach(**_attach_kwargs(registry, f"svc.db.schema.table_{index}", tag=name))

    labels = [registry.labels_for(f"svc.db.schema.table_{index}")[0] for index in range(6)]
    assert [label.tagFQN.root for label in labels] == [
        "TestClass.First",
        "TestClass.Second",
        "TestClass.First",
        "TestClass.Third",
        "TestClass.First",
        "TestClass.Second",
    ]
    assert labels[0] is labels[2] is labels[4]
    assert labels[1] is not labels[5]


def test_schema_clear_preserves_parent_and_sibling(registry):
    for entity in ("svc.db", "svc.db.a.table", "svc.db.b.table"):
        registry.attach(**_attach_kwargs(registry, entity))
    registry.clear_scope("svc.db.a")
    assert registry.labels_for("svc.db.a.table") == []
    assert len(registry.labels_for("svc.db")) == 1
    assert len(registry.labels_for("svc.db.b.table")) == 1
    registry.clear_scope("svc.db")
    assert registry.stats()["live_entities"] == 0
    assert registry.stats()["live_labels"] == 0


def test_completed_scopes_release_labels():
    registry = TagRegistry(cache_size=2)
    references = []
    for number in range(30):
        entity_fqn = f"svc.db.schema_{number}"
        registry.attach(**_attach_kwargs(registry, entity_fqn, tag=str(number)))
        references.append(weakref.ref(registry.labels_for(entity_fqn)[0]))
        list(registry.drain())
        registry.clear_scope(entity_fqn)
        assert registry.stats()["live_entities"] == 0
        assert registry.stats()["live_labels"] == 0
    assert all(reference() is None for reference in references[:-2])
    assert all(reference() is not None for reference in references[-2:])
    assert registry.stats()["known_tag_fqns"] == 2
    assert registry.stats()["tag_label_cache"] == 2


def test_scope_cleanup_preserves_pending_definition(registry):
    registry.attach(**_attach_kwargs(registry, "svc.db.schema.table"))
    registry.clear_scope("svc.db")
    assert registry.stats()["live_labels"] == 0
    assert [record.tag_request.name.root for record in registry.drain()] == ["TestTag"]


@pytest.mark.parametrize("cache_size", [0, -1])
def test_registry_rejects_invalid_capacity(cache_size):
    with pytest.raises(ValueError, match="positive"):
        TagRegistry(cache_size=cache_size)


def test_definition_without_entity_is_emitted(registry):
    tag = TagDefinition("Sensitivity", "Restricted", "Sensitivity levels", "Restricted data")
    registry.define(tag)
    records = list(registry.drain())
    assert len(records) == 1
    assert records[0].fqn is None
    assert records[0].classification_request.name.root == "Sensitivity"
    assert records[0].tag_request.name.root == "Restricted"
    assert records[0].tag_request.description.root == "Restricted data"
    assert registry.labels_for("svc.db.schema.table") == []
    assert registry.stats()["live_entities"] == 0


def test_attachment_does_not_queue_a_definition(registry):
    tag = TagDefinition("Sensitivity", "Restricted", "Sensitivity levels", "Restricted data")
    registry.attach(entity_fqn="svc.db.schema.table", tag=tag)
    assert [label.tagFQN.root for label in registry.labels_for("svc.db.schema.table")] == ["Sensitivity.Restricted"]
    assert list(registry.drain()) == []
    registry.clear_scope("svc.db.schema")
    assert registry.labels_for("svc.db.schema.table") == []


def test_standalone_definitions_survive_history_eviction():
    registry = TagRegistry(cache_size=2)
    for name in ("A", "B", "C", "D"):
        registry.define(TagDefinition("Class", name, "", ""))
    assert [record.tag_request.name.root for record in registry.drain()] == ["A", "B", "C", "D"]
    assert registry.stats()["known_tag_fqns"] == 2
