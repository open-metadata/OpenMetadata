import json

import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow

from .conftest import LOANS_RECORDS  # noqa: TID252


def test_ingest_metadata(patch_passwords_for_db_services, run_workflow, ingestion_config, metadata_assertions):
    run_workflow(MetadataWorkflow, ingestion_config)
    metadata_assertions()


def test_ingest_protobuf_schema_when_message_name_differs_from_topic(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
    protobuf_topic,
):
    run_workflow(MetadataWorkflow, ingestion_config)

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{db_service.fullyQualifiedName.root}.{protobuf_topic}",
        fields=["*"],
        nullable=False,
    )

    assert topic.messageSchema is not None
    assert topic.messageSchema.schemaType.value == "Protobuf"
    assert len(topic.messageSchema.schemaFields) == 1
    root = topic.messageSchema.schemaFields[0]
    assert root.name.root == "MyLoanRecord"
    assert root.dataType.name == "RECORD"
    assert [(field.name.root, field.dataType.name) for field in root.children] == [
        ("my_field1", "INT"),
        ("my_field2", "DOUBLE"),
        ("my_field3", "STRING"),
    ]


def test_ingest_protobuf_sample_data(
    patch_passwords_for_db_services,
    run_workflow,
    sample_data_ingestion_config,
    metadata,
    db_service,
    protobuf_topic,
):
    run_workflow(MetadataWorkflow, sample_data_ingestion_config)

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{db_service.fullyQualifiedName.root}.{protobuf_topic}",
        nullable=False,
    )
    topic_with_sample_data = metadata.get_topic_sample_data(topic)

    assert topic_with_sample_data is not None
    assert topic_with_sample_data.sampleData is not None
    raw_messages = topic_with_sample_data.sampleData.messages
    assert all(raw_messages), f"Protobuf messages were not decoded: {raw_messages}"
    assert [json.loads(message) for message in raw_messages] == LOANS_RECORDS


@pytest.fixture(
    scope="module",
    params=[
        "customers-100",
        "organizations-100",
        "people-100",
    ],
)
def metadata_assertions(metadata, db_service, request):
    def _assertions():
        topic: Topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{db_service.fullyQualifiedName.root}.{request.param}",
            fields=["*"],
            nullable=False,
        )
        assert topic.messageSchema is not None

    return _assertions
