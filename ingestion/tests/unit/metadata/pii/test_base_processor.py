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
"""Tests for the sampler-to-auto-classification bridge."""

import uuid
from collections.abc import Sequence
from itertools import pairwise
from typing import Any
from unittest.mock import Mock

import pytest

from metadata.generated.schema.entity.data.container import Container, ContainerDataModel
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table, TableData
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.generated.schema.type.schema import Topic as MessageSchema
from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.sampler.models import SampleData, SamplerResponse


class RecordingClassificationProcessor(AutoClassificationProcessor):
    def __init__(self, config: OpenMetadataWorkflowConfig):
        super().__init__(config=config, metadata=Mock(spec=OpenMetadata))
        self.classifier_inputs: list[tuple[Column, list[Any]]] = []

    def create_column_tag_labels(self, column: Column, sample_data: Sequence[Any]) -> Sequence[TagLabel]:
        self.classifier_inputs.append((column, list(sample_data)))
        return [
            TagLabel(
                tagFQN="PII.Email",
                source=TagSource.Classification,
                state=State.Suggested,
                labelType=LabelType.Generated,
            )
        ]


@pytest.fixture
def workflow_config() -> OpenMetadataWorkflowConfig:
    return OpenMetadataWorkflowConfig(
        source=Source(
            type="postgres",
            sourceConfig=SourceConfig(config=DatabaseServiceAutoClassificationPipeline(enableAutoClassification=True)),
        ),
        workflowConfig=WorkflowConfig.model_construct(),
    )


def _column(name: str) -> Column:
    return Column(
        name=ColumnName(root=name),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"service.database.schema.table.{name}"),
    )


def _table(columns: list[Column]) -> Table:
    return Table(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root="table"),
        fullyQualifiedName=FullyQualifiedEntityName(root="service.database.schema.table"),
        columns=columns,
    )


def _container(columns: list[Column]) -> Container:
    return Container(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root="container"),
        fullyQualifiedName=FullyQualifiedEntityName(root="service.container"),
        service=EntityReference(id=Uuid(root=uuid.uuid4()), type="storageService"),
        dataModel=ContainerDataModel(columns=columns),
    )


def _topic(field: FieldModel) -> Topic:
    return Topic(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root="topic"),
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic"),
        service=EntityReference(id=Uuid(root=uuid.uuid4()), type="messagingService"),
        partitions=1,
        messageSchema=MessageSchema(schemaFields=[field]),
    )


def _table_case():
    column = _column("email")
    return _table([column]), column


def _container_case():
    column = Column(
        name=ColumnName(root="email"),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.container.email"),
    )
    return _container([column]), column


def _topic_case():
    field = FieldModel(
        name="email",
        dataType=DataTypeTopic.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.email"),
    )
    return _topic(field), field


def _nested_columns(fqn_prefix: str) -> tuple[list[Column], list[Column]]:
    id_column = Column(
        name=ColumnName(root="id"),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.id"),
    )
    nested_email = Column(
        name=ColumnName(root="email"),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.contact.email"),
    )
    city = Column(
        name=ColumnName(root="city"),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.contact.address.city"),
    )
    postal_code = Column(
        name=ColumnName(root="postal_code"),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.contact.address.postal_code"),
    )
    address = Column(
        name=ColumnName(root="address"),
        dataType=DataType.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.contact.address"),
        children=[city, postal_code],
    )
    parent = Column(
        name=ColumnName(root="contact"),
        dataType=DataType.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn_prefix}.contact"),
        children=[nested_email, address],
    )
    return [id_column, parent], [id_column, nested_email, city, postal_code]


def _nested_table_case():
    columns, leaves = _nested_columns("service.database.schema.table")
    return _table(columns), leaves


def _nested_container_case():
    columns, leaves = _nested_columns("service.container")
    return _container(columns), leaves


def _nested_topic_case():
    email = FieldModel(
        name="email",
        dataType=DataTypeTopic.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.contact.email"),
    )
    city = FieldModel(
        name="city",
        dataType=DataTypeTopic.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.contact.address.city"),
    )
    postal_code = FieldModel(
        name="postal_code",
        dataType=DataTypeTopic.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.contact.address.postal_code"),
    )
    address = FieldModel(
        name="address",
        dataType=DataTypeTopic.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.contact.address"),
        children=[city, postal_code],
    )
    parent = FieldModel(
        name="contact",
        dataType=DataTypeTopic.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.topic.contact"),
        children=[email, address],
    )
    return _topic(parent), [email, city, postal_code]


def test_classifies_metadata_columns_when_sample_fields_are_empty(workflow_config):
    email_column = _column("project_manager_email_md")
    record = SamplerResponse(
        entity=_table([email_column]),
        sample_data=SampleData(data=TableData(columns=[], rows=[])),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == [(email_column, [])]
    assert len(result.column_tags) == 1
    assert result.column_tags[0].column_fqn == email_column.fullyQualifiedName.root
    assert result.column_tags[0].tag_label.tagFQN.root == "PII.Email"


@pytest.mark.parametrize("entity_case", [_table_case, _container_case, _topic_case])
def test_metadata_fallback_supports_each_classifiable_entity(workflow_config, entity_case):
    entity, column = entity_case()
    record = SamplerResponse(
        entity=entity,
        sample_data=SampleData(data=TableData(columns=[], rows=[])),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == [(column, [])]
    assert [column_tag.column_fqn for column_tag in result.column_tags] == [column.fullyQualifiedName.root]


def test_missing_sample_data_uses_metadata_fallback(workflow_config):
    email_column = _column("email")
    record = SamplerResponse(entity=_table([email_column]), sample_data=None)
    processor = RecordingClassificationProcessor(workflow_config)

    processor.run(record)

    assert processor.classifier_inputs == [(email_column, [])]


@pytest.mark.parametrize(
    "entity_case",
    [_nested_table_case, _nested_container_case, _nested_topic_case],
)
def test_classifies_all_metadata_leaves_in_canonical_order(workflow_config, entity_case):
    entity, leaves = entity_case()
    record = SamplerResponse(
        entity=entity,
        sample_data=SampleData(data=TableData(columns=[], rows=[])),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == [(leaf, []) for leaf in leaves]
    assert [column_tag.column_fqn for column_tag in result.column_tags] == [
        leaf.fullyQualifiedName.root for leaf in leaves
    ]


def test_leaf_iteration_treats_depth_limit_as_leaf():
    columns = [_column(f"level_{depth}") for depth in range(4)]
    for parent, child in pairwise(columns):
        parent.dataType = DataType.RECORD
        parent.children = [child]

    leaves = list(RecordingClassificationProcessor._iter_leaf_columns(columns[0], max_depth=2))

    assert leaves == [columns[2]]


def test_leaf_iteration_stops_at_cycles():
    parent = _column("parent")
    child = _column("child")
    parent.dataType = DataType.RECORD
    child.dataType = DataType.RECORD
    parent.children = [child]
    child.children = [parent]

    leaves = list(RecordingClassificationProcessor._iter_leaf_columns(parent))

    assert leaves == []


def test_classifies_only_sampled_fields_with_their_values(workflow_config):
    id_column = _column("id")
    email_column = _column("email")
    other_column = _column("other")
    record = SamplerResponse(
        entity=_table([id_column, email_column, other_column]),
        sample_data=SampleData(
            data=TableData(
                columns=[ColumnName(root="id"), ColumnName(root="email")],
                rows=[[1, "first@example.com"], [2, "second@example.com"]],
            )
        ),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    processor.run(record)

    assert processor.classifier_inputs == [
        (id_column, [1, 2]),
        (email_column, ["first@example.com", "second@example.com"]),
    ]


def test_empty_sample_rows_do_not_expand_sampled_field_selection(workflow_config):
    email_column = _column("email")
    other_column = _column("other")
    record = SamplerResponse(
        entity=_table([email_column, other_column]),
        sample_data=SampleData(
            data=TableData(
                columns=[ColumnName(root="email")],
                rows=[],
            )
        ),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    processor.run(record)

    assert processor.classifier_inputs == [(email_column, [])]


def test_unmatched_sampled_fields_do_not_trigger_metadata_fallback(workflow_config):
    email_column = _column("email")
    record = SamplerResponse(
        entity=_table([email_column]),
        sample_data=SampleData(
            data=TableData(
                columns=[ColumnName(root="missing"), ColumnName(root="missing.nested")],
                rows=[["value", "nested value"]],
            )
        ),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == []
    assert result.column_tags == []


def test_disabled_classification_does_not_process_metadata_fallback(workflow_config):
    workflow_config.source.sourceConfig.config.enableAutoClassification = False
    record = SamplerResponse(
        entity=_table([_column("email")]),
        sample_data=SampleData(data=TableData(columns=[], rows=[])),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == []
    assert result.column_tags is None


def test_entity_without_columns_is_ignored(workflow_config):
    record = SamplerResponse(
        entity=_table([]),
        sample_data=SampleData(data=TableData(columns=[], rows=[])),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    result = processor.run(record)

    assert processor.classifier_inputs == []
    assert result.column_tags is None


def test_sampled_dotted_path_maps_to_canonical_nested_column(workflow_config):
    nested_email = _column("email")
    parent = Column(
        name=ColumnName(root="contact"),
        dataType=DataType.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(root="service.database.schema.table.contact"),
        children=[nested_email],
    )
    record = SamplerResponse(
        entity=_table([parent]),
        sample_data=SampleData(
            data=TableData(
                columns=[ColumnName(root="contact.email")],
                rows=[["first@example.com"], ["second@example.com"]],
            )
        ),
    )
    processor = RecordingClassificationProcessor(workflow_config)

    processor.run(record)

    assert processor.classifier_inputs == [(nested_email, ["first@example.com", "second@example.com"])]
