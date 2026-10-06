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
"""Storage source stage publication and container attachment lifetimes."""

from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import StorageServiceMetadataPipeline
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.storage.s3.metadata import S3Source
from metadata.ingestion.source.storage.s3.models import S3ContainerDetails


@pytest.fixture
def source(existing_tag_lookup) -> S3Source:
    instance = object.__new__(S3Source)
    instance.source_config = StorageServiceMetadataPipeline(includeTags=True)
    instance.status = Status.model_validate({})
    instance.context = TopologyContextManager(instance.topology)
    instance.context.get().upsert("objectstore_service", "demo_service")
    instance.container_source_state = set()
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.side_effect = existing_tag_lookup
    instance.metadata.get_by_id.return_value = Container.model_construct(
        fullyQualifiedName=FullyQualifiedEntityName("demo_service.my_bucket")
    )
    instance.s3_client = MagicMock()
    instance.s3_client.get_bucket_tagging.return_value = {"TagSet": [{"Key": "Team", "Value": "Shared"}]}
    instance.s3_client.get_object_tagging.return_value = {"TagSet": [{"Key": "Team", "Value": "Private"}]}
    return instance


def bucket(name: str = "my_bucket") -> S3ContainerDetails:
    return S3ContainerDetails.model_validate(
        {"name": name, "prefix": "/", "container_fqn": f"demo_service.{name}", "fullPath": f"s3://{name}"}
    )


def file(name: str = "my_file") -> S3ContainerDetails:
    return S3ContainerDetails.model_validate(
        {
            "name": name,
            "prefix": f"path/{name}",
            "container_fqn": f"demo_service.my_bucket.{name}",
            "fullPath": f"s3://my_bucket/path/{name}",
            "leaf_container": True,
            "parent": EntityReference.model_validate({"id": str(UUID(int=1)), "type": "container"}),
        }
    )


def tag_stage(source: Any, details: Any):
    return source._process_stage(source.topology.container.stages[0], details)


def container_stage(source: Any, details: Any):
    return source._process_stage(source.topology.container.stages[1], details)


def definitions(records: Any):
    records = list(records)
    assert all(record.left is None for record in records)
    return [(record.right.classification_request.name.root, record.right.tag_request.name.root) for record in records]


def request(records: Any):
    records = list(records)
    assert len(records) == 1
    assert records[0].left is None
    return records[0].right


def labels(tags: Any) -> list[str]:
    return [tag.tagFQN.root for tag in tags or []]


def test_definitions_are_deduplicated_across_containers(source: Any):
    records = list(tag_stage(source, bucket()))
    assert definitions(records) == [("Team", "Shared")]
    assert records[0].right.classification_request.description.root == "S3 TAG KEY"
    assert records[0].right.tag_request.description.root == "S3 TAG VALUE"
    assert labels(request(container_stage(source, bucket())).tags) == ["Team.Shared"]
    assert definitions(tag_stage(source, bucket("other_bucket"))) == []
    assert labels(request(container_stage(source, bucket("other_bucket"))).tags) == ["Team.Shared"]
    assert source.tags_registry.stats()["pending"] == 0


@pytest.mark.parametrize("finish", ["exhaust", "close"])
def test_container_scope_lives_until_the_request_is_consumed(source: Any, finish: str):
    list(tag_stage(source, bucket()))
    stream = container_stage(source, bucket())
    emitted = next(stream)
    assert labels(emitted.right.tags) == ["Team.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 1
    if finish == "close":
        stream.close()
    else:
        assert list(stream) == []
    assert source.tags_registry.stats()["live_entities"] == 0
    assert labels(emitted.right.tags) == ["Team.Shared"]


def test_interrupted_tag_publication_releases_labels_and_can_be_retried(source: Any):
    stream = tag_stage(source, bucket())
    assert next(stream).right.tag_request.name.root == "Shared"
    stream.close()
    assert source.tags_registry.stats()["live_entities"] == 0
    assert definitions(tag_stage(source, bucket("other_bucket"))) == [("Team", "Shared")]
    assert labels(request(container_stage(source, bucket("other_bucket"))).tags) == ["Team.Shared"]


def test_failed_container_registration_releases_labels(source: Any):
    list(tag_stage(source, file()))
    source.metadata.get_by_id.side_effect = RuntimeError("Parent unavailable")
    stream = source.yield_container_details(file())
    assert labels(next(stream).right.tags) == ["Team.Private"]
    with pytest.raises(RuntimeError, match="Parent unavailable"):
        next(stream)
    assert source.tags_registry.stats()["live_entities"] == 0


def test_container_stages_release_attachments_between_buckets(source: Any):
    for index in range(30):
        source.s3_client.get_bucket_tagging.return_value = {"TagSet": [{"Key": "Category", "Value": f"value_{index}"}]}
        details = bucket(f"my_bucket_{index}")
        assert definitions(tag_stage(source, details)) == [("Category", f"value_{index}")]
        assert source.tags_registry.stats()["live_entities"] == 1
        assert labels(request(container_stage(source, details)).tags) == [f"Category.value_{index}"]
        assert source.tags_registry.stats()["live_entities"] == 0
    assert source.tags_registry.stats()["pending"] == 0
