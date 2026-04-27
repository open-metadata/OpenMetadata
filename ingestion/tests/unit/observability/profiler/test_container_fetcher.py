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

"""
Validate Container entity fetcher filtering strategies
"""
import uuid

from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.storageServiceAutoClassificationPipeline import (
    StorageServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.status import Status
from metadata.profiler.source.fetcher.fetcher_strategy import StorageFetcherStrategy

# Test containers with different characteristics
STRUCTURED_CONTAINER = Container(
    id=uuid.uuid4(),
    service=EntityReference(
        id=Uuid(root=uuid.uuid4()),
        type="storage",
        fullyQualifiedName="s3_service",
        name="s3_service",
    ),
    name="structured_bucket",
    fullyQualifiedName=FullyQualifiedEntityName(root="s3_service.structured_bucket"),
    dataModel=ContainerDataModel(columns=[]),
)

UNSTRUCTURED_CONTAINER = Container(
    id=uuid.uuid4(),
    service=EntityReference(
        id=Uuid(root=uuid.uuid4()),
        type="storage",
        fullyQualifiedName="s3_service",
        name="s3_service",
    ),
    name="unstructured_bucket",
    fullyQualifiedName=FullyQualifiedEntityName(root="s3_service.unstructured_bucket"),
    dataModel=None,
)

TAGGED_CONTAINER = Container(
    id=uuid.uuid4(),
    service=EntityReference(
        id=Uuid(root=uuid.uuid4()),
        type="storage",
        fullyQualifiedName="s3_service",
        name="s3_service",
    ),
    name="tagged_container",
    fullyQualifiedName=FullyQualifiedEntityName(root="s3_service.tagged_container"),
    dataModel=ContainerDataModel(columns=[]),
    tags=[
        TagLabel(
            labelType="Manual",
            name="pii",
            tagFQN="PII.Sensitive",
            state="Confirmed",
            source="Classification",
        )
    ],
)


def get_storage_fetcher(source_config):
    """Create storage fetcher for testing"""
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type="s3",
            serviceName="s3_service",
            sourceConfig=SourceConfig(
                config=source_config,
            ),
        ),
        workflowConfig=WorkflowConfig(
            openMetadataServerConfig=OpenMetadataConnection(
                hostPort="localhost:8585/api",
            )
        ),
    )
    return StorageFetcherStrategy(
        config=workflow_config,
        metadata=...,
        global_profiler_config=...,
        status=Status(),
    )


def test_filter_unstructured_containers():
    """Validate that unstructured containers (without dataModel) are filtered out"""
    config = StorageServiceAutoClassificationPipeline()
    fetcher = get_storage_fetcher(config)

    containers = [STRUCTURED_CONTAINER, UNSTRUCTURED_CONTAINER]
    filtered = fetcher._filter_entities(containers)

    assert STRUCTURED_CONTAINER in filtered
    assert UNSTRUCTURED_CONTAINER not in filtered
    assert len(list(filtered)) == 1


def test_container_filter_pattern_exclude():
    """Validate containerFilterPattern exclude functionality"""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    config = StorageServiceAutoClassificationPipeline(
        containerFilterPattern=FilterPattern(excludes=[".*unstructured.*"])
    )
    fetcher = get_storage_fetcher(config)

    # Container with 'unstructured' in name should be filtered
    assert fetcher._filter_containers(UNSTRUCTURED_CONTAINER)
    assert not fetcher._filter_containers(STRUCTURED_CONTAINER)


def test_container_filter_pattern_include():
    """Validate containerFilterPattern include functionality"""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    config = StorageServiceAutoClassificationPipeline(
        containerFilterPattern=FilterPattern(includes=[".*structured.*"])
    )
    fetcher = get_storage_fetcher(config)

    # Only containers with 'structured' in name should pass
    assert not fetcher._filter_containers(STRUCTURED_CONTAINER)
    assert fetcher._filter_containers(TAGGED_CONTAINER)


def test_classification_filter_pattern():
    """Validate classificationFilterPattern functionality for containers"""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    config = StorageServiceAutoClassificationPipeline(
        classificationFilterPattern=FilterPattern(includes=["PII.*"])
    )
    fetcher = get_storage_fetcher(config)

    # Container with PII tag should pass classification filter
    assert not fetcher.filter_classifications(TAGGED_CONTAINER)
    assert fetcher.filter_classifications(STRUCTURED_CONTAINER)


def test_fqn_filtering():
    """Validate FQN-based filtering for containers"""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    config = StorageServiceAutoClassificationPipeline(
        containerFilterPattern=FilterPattern(includes=["s3_service\\.structured.*"]),
        useFqnForFiltering=True,
    )
    fetcher = get_storage_fetcher(config)

    # Should filter based on FQN, not just name
    assert not fetcher._filter_containers(STRUCTURED_CONTAINER)
    assert fetcher._filter_containers(TAGGED_CONTAINER)


def test_combined_filters():
    """Validate that multiple filters work together"""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    config = StorageServiceAutoClassificationPipeline(
        containerFilterPattern=FilterPattern(excludes=[".*unstructured.*"]),
        classificationFilterPattern=FilterPattern(excludes=["PII.*"]),
    )
    fetcher = get_storage_fetcher(config)

    containers = [STRUCTURED_CONTAINER, UNSTRUCTURED_CONTAINER, TAGGED_CONTAINER]
    filtered = list(fetcher._filter_entities(containers))

    # Should only include STRUCTURED_CONTAINER
    # UNSTRUCTURED_CONTAINER filtered by pattern
    # TAGGED_CONTAINER filtered by classification
    assert STRUCTURED_CONTAINER in filtered
    assert UNSTRUCTURED_CONTAINER not in filtered
    assert TAGGED_CONTAINER not in filtered
    assert len(filtered) == 1
