#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Definition registration through the five service-family source adapters."""

from unittest.mock import MagicMock

import pytest
from tenacity import wait_none

from metadata.domain.tags import TagCanonicalizer, TagDefinition
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.redash.metadata import RedashSource
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.ingestion.source.pipeline.prefect.metadata import PrefectSource
from metadata.ingestion.source.storage.s3.metadata import S3Source

from ...utils.drive_tags import TaggedDriveSource  # noqa: TID252


@pytest.fixture(params=[MysqlSource, PrefectSource, S3Source, TaggedDriveSource, RedashSource])
def source(request, monkeypatch):
    monkeypatch.setattr(TagCanonicalizer._es_search.retry, "wait", wait_none())
    instance = object.__new__(request.param)
    Source.__init__(instance)
    instance.metadata = MagicMock(spec=OpenMetadata)
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.return_value = object()
    return instance


def test_none_mapper_output_does_not_initialize_a_registry(source):
    assert list(source.register_tag(definition=None)) == []
    assert "tags_registry" not in vars(source)
    source.metadata.es_search_from_fqn.assert_not_called()
    source.metadata.get_by_name.assert_not_called()


def test_definition_only_registration_leaves_publication_to_the_source_stage(source):
    assert list(source.register_tag(definition=TagDefinition("Custom", "Shared", "Native class", "Native tag"))) == []
    assert source.tags_registry.stats()["pending"] == 1
    assert source.tags_registry.stats()["live_entities"] == 0
    [record] = list(source.tags_registry.drain())
    assert record.classification_request.name.root == "Custom"
    assert record.classification_request.description.root == "Native class"
    assert record.tag_request.name.root == "Shared"
    assert record.tag_request.description.root == "Native tag"
    assert list(source.tags_registry.drain()) == []
    source.metadata.get_by_name.assert_not_called()


def test_parent_and_child_keep_independent_labels_with_one_definition(source):
    for entity_fqn in ("my_service.my_parent", "my_service.my_parent.my_child"):
        assert (
            list(source.register_tag(definition=TagDefinition("Custom", "Shared", "", ""), entity_fqn=entity_fqn)) == []
        )
    assert source.tags_registry.stats()["pending"] == 1
    assert source.tags_registry.stats()["live_entities"] == 2
    assert len(list(source.tags_registry.drain())) == 1
    for entity_fqn in ("my_service.my_parent", "my_service.my_parent.my_child"):
        assert [tag.tagFQN.root for tag in source.tags_registry.labels_for(entity_fqn)] == ["Custom.Shared"]
    source.tags_registry.clear_scope("my_service.my_parent.my_child")
    assert [tag.tagFQN.root for tag in source.tags_registry.labels_for("my_service.my_parent")] == ["Custom.Shared"]
    assert source.tags_registry.labels_for("my_service.my_parent.my_child") == []


def test_registration_error_preserves_other_tags_and_does_not_publish_successes_early(source):
    def search(**kwargs):
        if kwargs["fqn_search_string"] == "Custom.Unavailable":
            raise ConnectionError("Search unavailable")
        return []

    source.metadata.es_search_from_fqn.side_effect = search

    def native_tags():
        for name in ("First", "Unavailable", "Last"):
            yield from source.register_tag(
                definition=TagDefinition("Custom", name, "", ""), entity_fqn="my_service.my_asset"
            )

    stream = native_tags()
    error = next(stream)
    assert error.right is None
    assert error.left is not None
    assert "Custom.Unavailable" in error.left.error
    assert error.left.name == "my_service.my_asset"
    assert source.tags_registry.stats()["pending"] == 1
    assert list(stream) == []
    assert [record.tag_request.name.root for record in source.tags_registry.drain()] == ["First", "Last"]
    assert [tag.tagFQN.root for tag in source.tags_registry.labels_for("my_service.my_asset")] == [
        "Custom.First",
        "Custom.Last",
    ]
