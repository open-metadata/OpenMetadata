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
"""DTO processing, canonicalization and eager registration contracts."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from threading import Event
from uuid import UUID

import pytest
from tenacity import wait_none

from metadata.domain.tags import Canonical, TagAssignment, TagCanonicalizer, TagDefinition, TagRegistry
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.tagLabel import LabelType, State


@pytest.fixture(autouse=True)
def no_retry_wait(monkeypatch):
    monkeypatch.setattr(TagCanonicalizer._es_search.retry, "wait", wait_none())


@pytest.mark.parametrize("operation", ["register", "attach"])
def test_filtered_input_is_an_eager_noop(tag_metadata, operation):
    registry = TagRegistry(metadata=tag_metadata)
    assert getattr(registry, operation)(None) is None
    assert list(registry.drain()) == []
    assert registry.stats()["live_entities"] == 0
    tag_metadata.es_search_from_fqn.assert_not_called()
    tag_metadata.get_by_name.assert_not_called()


@pytest.mark.parametrize(
    "classification, tag_name",
    [("Class", ""), ("Class", "  "), ("", "Value"), ('Bad"Class', "Value"), ("Class", "a::b"), ("Class", "x" * 257)],
)
@pytest.mark.parametrize("operation", ["register", "attach"])
def test_invalid_names_skip_before_external_reads(tag_metadata, classification, tag_name, operation):
    registry = TagRegistry(metadata=tag_metadata)
    value = (
        TagDefinition(classification, tag_name, "Source classification", "Source tag")
        if operation == "register"
        else TagAssignment(classification, tag_name, "my_service.my_table")
    )
    assert getattr(registry, operation)(value) is None
    assert list(registry.drain()) == []
    assert registry.labels_for("my_service.my_table") == []
    tag_metadata.es_search_from_fqn.assert_not_called()
    tag_metadata.get_by_name.assert_not_called()


def system_entities():
    classification = Classification(id=UUID(int=1), name="PII", description="System classification", provider="system")
    tag = Tag(
        id=UUID(int=2),
        name="Sensitive",
        description="System tag",
        provider="system",
        classification={"id": str(UUID(int=1)), "type": "classification", "name": "PII"},
    )
    return classification, tag


def test_register_resolves_once_and_uses_one_identity_for_definition_and_assignment(tag_metadata):
    classification, tag = system_entities()
    tag_metadata.es_search_from_fqn.side_effect = [[classification], [tag]]
    registry = TagRegistry(metadata=tag_metadata)
    error = registry.register(
        TagDefinition("pii", "sensitive", "Source classification", "Source tag"),
        entity_fqn="my_service.my_table",
        label_type=LabelType.Manual,
        state=State.Confirmed,
    )
    assert error is None
    records = list(registry.drain())
    assert len(records) == 1
    assert records[0].classification_request.name.root == "PII"
    assert records[0].classification_request.description.root == "System classification"
    assert records[0].tag_request.name.root == "Sensitive"
    assert records[0].tag_request.description.root == "System tag"
    labels = registry.labels_for("my_service.my_table")
    assert len(labels) == 1
    assert labels[0].tagFQN.root == "PII.Sensitive"
    assert labels[0].labelType == LabelType.Manual
    assert labels[0].state == State.Confirmed
    assert tag_metadata.es_search_from_fqn.call_count == 2


def test_attach_canonicalizes_existing_reference_without_definition(tag_metadata):
    classification, tag = system_entities()
    tag_metadata.es_search_from_fqn.side_effect = [[classification], [tag]]
    registry = TagRegistry(metadata=tag_metadata)
    assert registry.attach(TagAssignment("pii", "sensitive", "my_service.my_table")) is None
    assert list(registry.drain()) == []
    assert [label.tagFQN.root for label in registry.labels_for("my_service.my_table")] == ["PII.Sensitive"]


def test_custom_miss_keeps_each_calls_spelling_and_descriptions(tag_metadata):
    registry = TagRegistry(metadata=tag_metadata)
    assert registry.register(TagDefinition("Custom", "Shared", "First classification", "First tag")) is None
    assert registry.register(TagDefinition("CUSTOM", "shared", "Second classification", "Second tag")) is None
    records = list(registry.drain())
    assert [
        (
            r.classification_request.name.root,
            r.classification_request.description.root,
            r.tag_request.name.root,
            r.tag_request.description.root,
        )
        for r in records
    ] == [
        ("Custom", "First classification", "Shared", "First tag"),
        ("CUSTOM", "Second classification", "shared", "Second tag"),
    ]
    assert registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("operation", ["register", "attach"])
def test_exhausted_lookup_returns_error_without_discarding_prior_state(tag_metadata, operation):
    registry = TagRegistry(metadata=tag_metadata)
    assert registry.register(TagDefinition("Custom", "Present", "", ""), entity_fqn="my_service.first") is None
    tag_metadata.es_search_from_fqn.side_effect = ConnectionError("Search unavailable")
    value = (
        TagDefinition("Other", "Unavailable", "", "")
        if operation == "register"
        else TagAssignment("Other", "Unavailable", "my_service.second")
    )
    error = (
        registry.register(value, entity_fqn="my_service.second") if operation == "register" else registry.attach(value)
    )
    assert error is not None
    assert error.name == "my_service.second"
    assert "Other.Unavailable" in error.error
    assert "Search unavailable" in error.error
    assert error.stackTrace
    assert registry.stats()["pending"] == 1
    assert registry.stats()["live_labels"] == 1
    assert registry.labels_for("my_service.second") == []
    assert [record.tag_request.name.root for record in registry.drain()] == ["Present"]
    assert [label.tagFQN.root for label in registry.labels_for("my_service.first")] == ["Custom.Present"]


def test_label_preparation_failure_does_not_queue_a_definition(tag_metadata):
    registry = TagRegistry(metadata=tag_metadata)
    error = registry.register(
        TagDefinition("Custom", "New", "", ""), entity_fqn="my_service.my_table", label_type="invalid"
    )
    assert error is not None
    assert list(registry.drain()) == []
    assert registry.stats()["live_entities"] == 0


def test_injected_policy_applies_to_both_operations(tag_metadata):
    class SourcePolicy(TagCanonicalizer):
        def resolve(self, **kwargs):
            raise AssertionError("Registration must use the primitive policy methods")

        def classification(self, name, default_description):
            return Canonical("SourceClass", "Resolved classification")

        def tag(self, classification_name, tag_name, default_tag_description):
            return Canonical("SourceTag", "Resolved tag")

    registry = TagRegistry(metadata=tag_metadata, canonicalizer=SourcePolicy(tag_metadata))
    assert registry.register(TagDefinition("native", "first", "", ""), entity_fqn="my_service.first") is None
    assert registry.attach(TagAssignment("native", "second", "my_service.second")) is None
    [record] = list(registry.drain())
    assert record.classification_request.name.root == "SourceClass"
    assert record.classification_request.description.root == "Resolved classification"
    assert record.tag_request.name.root == "SourceTag"
    assert record.tag_request.description.root == "Resolved tag"
    assert [label.tagFQN.root for label in registry.labels_for("my_service.first")] == ["SourceClass.SourceTag"]
    assert [label.tagFQN.root for label in registry.labels_for("my_service.second")] == ["SourceClass.SourceTag"]
    tag_metadata.es_search_from_fqn.assert_not_called()


def test_discovery_and_failed_preparation_do_not_block_or_corrupt_suspended_drain(tag_metadata):
    started, release = Event(), Event()

    def search(**kwargs):
        if kwargs["fqn_search_string"] == "Unavailable":
            started.set()
            assert release.wait(timeout=5)
            raise ConnectionError("Search unavailable")
        return []

    tag_metadata.es_search_from_fqn.side_effect = search
    registry = TagRegistry(metadata=tag_metadata)
    assert registry.register(TagDefinition("Custom", "First", "", "")) is None
    with closing(registry.drain()) as records, ThreadPoolExecutor(max_workers=1) as pool:
        assert next(records).tag_request.name.root == "First"
        failed = pool.submit(
            registry.register, TagDefinition("Unavailable", "Missing", "", ""), entity_fqn="my_service.failed"
        )
        try:
            assert started.wait(timeout=5)
            assert registry.register(TagDefinition("Custom", "Second", "", ""), entity_fqn="my_service.second") is None
        finally:
            release.set()
        assert failed.result(timeout=5) is not None
        assert list(records) == []
    assert [record.tag_request.name.root for record in registry.drain()] == ["Second"]
    assert registry.labels_for("my_service.failed") == []
    assert [label.tagFQN.root for label in registry.labels_for("my_service.second")] == ["Custom.Second"]


def test_warm_assignments_reuse_canonicalization_and_existence_reads(tag_metadata):
    registry = TagRegistry(metadata=tag_metadata)
    for index in range(20):
        assert registry.register(TagDefinition("Custom", f"Tag{index}", "", "")) is None
    assert len(list(registry.drain())) == 20
    assert tag_metadata.es_search_from_fqn.call_count == 21
    for pass_number in range(2):
        for index in range(20):
            entity = f"my_service.pass{pass_number}.table{index}"
            assert registry.attach(TagAssignment("Custom", f"Tag{index}", entity)) is None
            assert [label.tagFQN.root for label in registry.labels_for(entity)] == [f"Custom.Tag{index}"]
        registry.clear_scope(f"my_service.pass{pass_number}")
    assert tag_metadata.es_search_from_fqn.call_count == 21
    assert tag_metadata.get_by_name.call_count == 20
    assert list(registry.drain()) == []
    assert registry.stats()["live_entities"] == 0


def test_failed_tag_keeps_successful_labels_in_the_same_classification(tag_metadata):
    registry = TagRegistry(metadata=tag_metadata)
    assert registry.register(TagDefinition("Custom", "Present", "", ""), entity_fqn="my_service.my_table") is None
    tag_metadata.es_search_from_fqn.side_effect = ConnectionError("Search unavailable")
    error = registry.register(TagDefinition("Custom", "Missing", "", ""), entity_fqn="my_service.my_table")
    assert error is not None
    assert [record.tag_request.name.root for record in registry.drain()] == ["Present"]
    assert [label.tagFQN.root for label in registry.labels_for("my_service.my_table")] == ["Custom.Present"]
