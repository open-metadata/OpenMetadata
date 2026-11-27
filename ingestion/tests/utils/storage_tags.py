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
"""Shared S3 fixtures and storage tag assertions."""

from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import StorageServiceMetadataPipeline
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.storage.s3.metadata import S3Source
from metadata.ingestion.source.storage.s3.models import S3ContainerDetails


def make_s3_source(existing_tag_lookup) -> S3Source:
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
