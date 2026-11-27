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
"""S3 tag extraction, asset mapping and GCS no-tag behavior."""

from typing import Any
from uuid import UUID

import pytest
from tenacity import wait_none

from metadata.domain.tags import TagCanonicalizer
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import StorageServiceMetadataPipeline
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.storage.gcs.metadata import GcsSource
from metadata.ingestion.source.storage.gcs.models import GCSContainerDetails

from ....utils.storage_tags import (  # noqa: TID252
    bucket,
    container_stage,
    definitions,
    file,
    labels,
    make_s3_source,
    request,
    tag_stage,
)


@pytest.fixture
def source(existing_tag_lookup):
    return make_s3_source(existing_tag_lookup)


def test_bucket_and_object_labels_keep_their_scopes(source: Any):
    def bucket_tags(**kwargs: str):
        assert kwargs == {"Bucket": "my_bucket"}
        return {"TagSet": [{"Key": "Team", "Value": "Shared"}]}

    def object_tags(**kwargs: str):
        assert kwargs == {"Bucket": "my_bucket", "Key": "path/my_file"}
        return {"TagSet": [{"Key": "Team", "Value": "Private"}]}

    source.s3_client.get_bucket_tagging.side_effect = bucket_tags
    source.s3_client.get_object_tagging.side_effect = object_tags
    assert definitions(tag_stage(source, bucket())) == [("Team", "Shared")]
    bucket_request = request(container_stage(source, bucket()))
    assert labels(bucket_request.tags) == ["Team.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 0

    assert definitions(tag_stage(source, file())) == [("Team", "Private")]
    file_request = request(container_stage(source, file()))
    assert labels(file_request.tags) == ["Team.Private"]
    assert labels(bucket_request.tags) == ["Team.Shared"]
    assert source.get_tag_by_fqn("demo_service.other_bucket") is None
    assert source.tags_registry.stats()["live_labels"] == 0
    assert getattr(source.context.get(), "tags", None) is None
    tag = file_request.tags[0]
    assert (tag.labelType.value, tag.state.value, tag.source.value) == ("Automated", "Suggested", "Classification")


def test_folder_containers_do_not_fetch_or_inherit_tags(source: Any):
    list(tag_stage(source, bucket()))
    request(container_stage(source, bucket()))
    tag_requests: list[dict[str, str]] = []

    def fetch_tags(**kwargs: str):
        tag_requests.append(kwargs)
        return {"TagSet": [{"Key": "Team", "Value": "Private"}]}

    source.s3_client.get_bucket_tagging.side_effect = fetch_tags
    source.s3_client.get_object_tagging.side_effect = fetch_tags
    details = file("my_folder")
    details.leaf_container = False
    assert list(tag_stage(source, details)) == []
    emitted = request(container_stage(source, details))
    assert emitted.name.root == "my_folder"
    assert labels(emitted.tags) == []
    assert tag_requests == []
    assert source.tags_registry.stats()["live_entities"] == 0


def test_quoted_service_registers_the_live_child_fqn_for_stale_deletion(source: Any):
    source.context.get().upsert("objectstore_service", "demo_service.")
    source.metadata.get_by_id.return_value = Container.model_construct(
        fullyQualifiedName=FullyQualifiedEntityName('"demo_service.".my_bucket')
    )
    details = file("my_file.txt")
    details.container_fqn = '"demo_service.".my_bucket."my_file.txt"'
    list(tag_stage(source, details))
    emitted = request(container_stage(source, details))
    assert labels(emitted.tags) == ["Team.Private"]
    assert source.container_source_state == {'"demo_service.".my_bucket."my_file.txt"'}
    assert source.tags_registry.stats()["live_entities"] == 0


def test_disabled_tags_do_not_fetch_or_attach_tags(source: Any):
    source.source_config.includeTags = False
    tag_requests: list[dict[str, str]] = []

    def fetch_tags(**kwargs: str):
        tag_requests.append(kwargs)
        return {"TagSet": [{"Key": "Team", "Value": "Shared"}]}

    source.s3_client.get_bucket_tagging.side_effect = fetch_tags
    source.s3_client.get_object_tagging.side_effect = fetch_tags
    assert list(tag_stage(source, bucket())) == []
    assert list(source.yield_container_tags(file())) == []
    assert labels(request(container_stage(source, bucket())).tags) == []
    assert tag_requests == []
    assert source.tags_registry.stats()["pending"] == 0


def test_empty_or_invalid_tags_do_not_discard_valid_tags(source: Any, caplog: pytest.LogCaptureFixture):
    source.s3_client.get_bucket_tagging.return_value = {
        "TagSet": [
            {"Key": "Team", "Value": ""},
            {"Key": "Team", "Value": " "},
            {"Key": 'bad"name', "Value": "Value"},
            {"Key": "Team", "Value": "Shared"},
        ]
    }
    assert definitions(tag_stage(source, bucket())) == [("Team", "Shared")]
    assert 'bad"name' in caplog.text
    assert labels(request(container_stage(source, bucket())).tags) == ["Team.Shared"]


def test_one_tag_search_failure_does_not_discard_other_tags(source: Any, monkeypatch: pytest.MonkeyPatch):
    source.s3_client.get_bucket_tagging.return_value = {
        "TagSet": [{"Key": "Broken", "Value": "Value"}, {"Key": "Team", "Value": "Shared"}]
    }

    def search(*, fqn_search_string: str, **kwargs: Any):
        if fqn_search_string == "Broken":
            raise RuntimeError("Tag search unavailable")
        return []

    source.metadata.es_search_from_fqn.side_effect = search
    search_with_retry: Any = TagCanonicalizer._es_search
    monkeypatch.setattr(search_with_retry.retry, "wait", wait_none())
    records = list(tag_stage(source, bucket()))
    errors = [record.left for record in records if record.left]
    assert len(errors) == 1
    assert "Tag search unavailable" in errors[0].error
    assert definitions(record for record in records if record.right) == [("Team", "Shared")]
    assert labels(request(container_stage(source, bucket())).tags) == ["Team.Shared"]


def test_system_tag_case_is_resolved_before_publication_and_attachment(source: Any):
    classification = Classification.model_validate(
        {"id": str(UUID(int=2)), "name": "PII", "description": "System classification", "provider": "system"}
    )
    tag = Tag.model_validate(
        {
            "id": str(UUID(int=3)),
            "name": "Sensitive",
            "description": "System tag",
            "provider": "system",
            "classification": {"id": str(UUID(int=2)), "type": "classification", "name": "PII"},
        }
    )
    source.metadata.es_search_from_fqn.side_effect = [[classification], [tag]]
    source.s3_client.get_bucket_tagging.return_value = {"TagSet": [{"Key": "pii", "Value": "sensitive"}]}
    assert definitions(tag_stage(source, bucket())) == [("PII", "Sensitive")]
    assert labels(request(container_stage(source, bucket())).tags) == ["PII.Sensitive"]


def test_quoted_names_and_case_distinct_values_keep_their_identity(source: Any):
    source.s3_client.get_bucket_tagging.return_value = {
        "TagSet": [
            {"Key": "my.class", "Value": "my.tag"},
            {"Key": "Team", "Value": "Shared"},
            {"Key": "Team", "Value": "SHARED"},
        ]
    }
    details = bucket("my.bucket")
    details.container_fqn = 'demo_service."my.bucket"'
    assert definitions(tag_stage(source, details)) == [("my.class", "my.tag"), ("Team", "Shared"), ("Team", "SHARED")]
    assert labels(request(container_stage(source, details)).tags) == [
        '"my.class"."my.tag"',
        "Team.Shared",
        "Team.SHARED",
    ]
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("include_tags", [True, False])
@pytest.mark.parametrize(
    ("service_name", "service_fqn"), [("demo_service", "demo_service"), ("demo_service.", '"demo_service."')]
)
@pytest.mark.parametrize(
    ("name", "parent_suffix", "container_suffix"),
    [
        ("my_bucket", None, "my_bucket"),
        ("my_folder", "my_bucket", "my_bucket.my_folder"),
        ("my_file.csv", "my_bucket.my_folder", 'my_bucket.my_folder."my_file.csv"'),
    ],
)
def test_gcs_containers_preserve_metadata_and_seen_fqns_without_tags(
    source: Any,
    include_tags: bool,
    service_name: str,
    service_fqn: str,
    name: str,
    parent_suffix: str | None,
    container_suffix: str,
):
    gcs = object.__new__(GcsSource)
    gcs.source_config = StorageServiceMetadataPipeline(includeTags=include_tags)
    gcs.context = TopologyContextManager(gcs.topology)
    gcs.context.get().upsert("objectstore_service", service_name)
    gcs.metadata = source.metadata
    gcs.container_source_state = set()
    parent = None
    if parent_suffix:
        parent = EntityReference.model_validate({"id": str(UUID(int=1)), "type": "container"})
        source.metadata.get_by_id.return_value = Container.model_construct(
            fullyQualifiedName=FullyQualifiedEntityName(f"{service_fqn}.{parent_suffix}")
        )
    expected_fqn = f"{service_fqn}.{container_suffix}"
    details = GCSContainerDetails.model_validate(
        {
            "name": name,
            "prefix": "my_prefix/",
            "container_fqn": expected_fqn,
            "parent": parent,
            "number_of_objects": 3,
            "size": 100,
            "file_formats": ["csv"],
            "fullPath": "gs://my_bucket/my_prefix/",
        }
    )
    assert list(tag_stage(gcs, details)) == []
    emitted = request(container_stage(gcs, details))
    assert emitted.name.root == name
    assert emitted.prefix == "my_prefix/"
    assert emitted.parent == parent
    assert emitted.numberOfObjects == 3
    assert emitted.size == 100
    assert [format_.value for format_ in emitted.fileFormats] == ["csv"]
    assert emitted.fullPath == "gs://my_bucket/my_prefix/"
    assert labels(emitted.tags) == []
    assert gcs.container_source_state == {expected_fqn}
    assert gcs.tags_registry.stats()["live_entities"] == 0
    assert gcs.tags_registry.stats()["pending"] == 0
    assert source.tags_registry is not gcs.tags_registry
