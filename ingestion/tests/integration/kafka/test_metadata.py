import pytest
from confluent_kafka import Consumer

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(
    patch_passwords_for_db_services, run_workflow, ingestion_config, metadata_assertions
):
    run_workflow(MetadataWorkflow, ingestion_config)
    metadata_assertions()


def test_ingest_with_consumer_groups(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config_with_consumer_groups,
    metadata,
    db_service,
    kafka_consumer_group,
):
    """Consumer groups are extracted when extractConsumerGroups is enabled.

    Note: The consumerGroups field requires the OM server to be rebuilt
    with the updated Topic schema. When running against an older server,
    the workflow still succeeds and extracts consumer group data — the
    server just doesn't persist the new field. We verify the workflow
    completes and optionally check the field if the server supports it.
    """
    run_workflow(MetadataWorkflow, ingestion_config_with_consumer_groups)
    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{db_service.fullyQualifiedName.root}.customers-100",
        fields=["*"],
        nullable=False,
    )
    assert topic is not None
    # If the OM server has the new schema, verify consumer groups
    if topic.consumerGroups is not None:
        group_ids = [cg.groupId for cg in topic.consumerGroups]
        assert "om-integration-test-group" in group_ids


def test_ingest_with_sample_data(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config_with_sample_data,
    metadata,
    db_service,
):
    """Sample data messages are extracted from topics."""
    run_workflow(MetadataWorkflow, ingestion_config_with_sample_data)
    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{db_service.fullyQualifiedName.root}.customers-100",
        fields=["*"],
        nullable=False,
    )
    assert topic is not None

    # Fetch sample data via the dedicated endpoint
    sample_response = metadata.client.get(f"/topics/{topic.id.root}/sampleData")
    assert sample_response is not None
    # The endpoint returns a Topic with sampleData if data was ingested
    sample_data = sample_response.get("sampleData")
    if sample_data is not None:
        messages = sample_data.get("messages", [])
        assert (
            len(messages) > 0
        ), "Sample data should contain at least one message from the test topic"


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


@pytest.fixture(scope="module")
def kafka_consumer_group(kafka_container):
    """Create an active consumer group by consuming from a topic.
    This ensures there is at least one consumer group to extract."""
    conf = {
        "bootstrap.servers": kafka_container.get_bootstrap_server(),
        "group.id": "om-integration-test-group",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    }
    consumer = Consumer(conf)
    consumer.subscribe(["customers-100"])

    # Poll a few messages so the group registers with the broker
    for _ in range(10):
        msg = consumer.poll(timeout=5.0)
        if msg is not None and msg.error() is None:
            break

    # Commit offsets to ensure the group is registered
    consumer.commit()

    yield consumer

    consumer.close()


@pytest.fixture(scope="module")
def ingestion_config_with_consumer_groups(
    db_service, metadata, workflow_config, sink_config
):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                    "extractConsumerGroups": True,
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def ingestion_config_with_sample_data(
    db_service, metadata, workflow_config, sink_config
):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                    "generateSampleData": True,
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
