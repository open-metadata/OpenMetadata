import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow


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
