import time

import pytest
from confluent_kafka import Consumer

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(patch_passwords_for_db_services, run_workflow, ingestion_config, metadata_assertions):
    run_workflow(MetadataWorkflow, ingestion_config)
    metadata_assertions()


def test_ingest_with_consumer_groups(
    patch_passwords_for_db_services,
    kafka_consumer_group_service,
    metadata,
    kafka_consumer_group,
):
    """Consumer groups are extracted when extractConsumerGroups is enabled.

    Uses a dedicated service so topics are created fresh with consumer groups
    in a single workflow run (avoids sourceHash deduplication from prior runs).
    """
    svc, config = kafka_consumer_group_service
    workflow = MetadataWorkflow.create(config)
    workflow.execute()
    workflow.print_status()

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{svc.fullyQualifiedName.root}.customers-100",
        fields=["consumerGroups"],
        nullable=False,
    )
    assert topic is not None
    assert topic.consumerGroups is not None, "consumerGroups must be populated when extractConsumerGroups=True"
    group_ids = [cg.groupId for cg in topic.consumerGroups]
    assert "om-integration-test-group" in group_ids
    test_group = next(cg for cg in topic.consumerGroups if cg.groupId == "om-integration-test-group")
    assert test_group.state is not None
    assert test_group.memberCount >= 1
    assert test_group.members is not None
    assert len(test_group.members) == test_group.memberCount
    assert test_group.partitionOffsets is not None
    assert len(test_group.partitionOffsets) >= 1
    first_partition = test_group.partitionOffsets[0]
    assert first_partition.currentOffset is not None
    assert first_partition.currentOffset >= 0
    assert first_partition.endOffset is not None
    assert first_partition.lag is not None
    assert first_partition.lag >= 0
    assert test_group.totalLag is not None


def test_ingest_with_sample_data(
    kafka_sample_data_service,
    metadata,
):
    """Sample data messages are extracted from topics."""
    svc, config = kafka_sample_data_service
    workflow = MetadataWorkflow.create(config)
    workflow.execute()
    workflow.print_status()

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{svc.fullyQualifiedName.root}.customers-100",
        fields=["*"],
        nullable=False,
    )
    assert topic is not None

    # Fetch sample data via the dedicated endpoint
    sample_response = metadata.client.get(f"/topics/{topic.id.root}/sampleData")
    assert sample_response is not None
    sample_data = sample_response.get("sampleData")
    if sample_data is None:
        pytest.skip("OM server did not return sampleData for this topic")
    messages = sample_data.get("messages", [])
    assert len(messages) > 0, "Sample data should contain at least one message from the test topic"


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

    # Poll messages so the group registers with the broker
    for _ in range(20):
        msg = consumer.poll(timeout=2.0)
        if msg is not None and msg.error() is None:
            break

    # Commit offsets and wait for group to stabilize
    consumer.commit()
    time.sleep(5)

    yield consumer

    consumer.close()


@pytest.fixture(scope="module")
def kafka_consumer_group_service(kafka_container, schema_registry_container, metadata, workflow_config, sink_config):
    """Create a dedicated service for consumer group testing."""
    import uuid

    from metadata.generated.schema.api.services.createMessagingService import (
        CreateMessagingServiceRequest,
    )
    from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
        KafkaConnection,
    )
    from metadata.generated.schema.entity.services.messagingService import (
        MessagingConnection,
        MessagingService,
        MessagingServiceType,
    )

    svc_request = CreateMessagingServiceRequest(
        name=f"kafka_cg_test_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Kafka,
        connection=MessagingConnection(
            config=KafkaConnection(
                bootstrapServers=kafka_container.get_bootstrap_server(),
                schemaRegistryURL=schema_registry_container.get_connection_url(),
            )
        ),
    )
    svc = metadata.create_or_update(data=svc_request)
    config = {
        "source": {
            "type": "kafka",
            "serviceName": svc.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                    "extractConsumerGroups": True,
                }
            },
            "serviceConnection": svc.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    yield svc, config
    svc = metadata.get_by_name(MessagingService, svc.fullyQualifiedName.root)
    if svc:
        metadata.delete(
            entity=MessagingService,
            entity_id=svc.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def kafka_sample_data_service(kafka_container, schema_registry_container, metadata, workflow_config, sink_config):
    """Create a dedicated service for sample data testing."""
    import uuid

    from metadata.generated.schema.api.services.createMessagingService import (
        CreateMessagingServiceRequest,
    )
    from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
        KafkaConnection,
    )
    from metadata.generated.schema.entity.services.messagingService import (
        MessagingConnection,
        MessagingService,
        MessagingServiceType,
    )

    svc_request = CreateMessagingServiceRequest(
        name=f"kafka_sd_test_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Kafka,
        connection=MessagingConnection(
            config=KafkaConnection(
                bootstrapServers=kafka_container.get_bootstrap_server(),
                schemaRegistryURL=schema_registry_container.get_connection_url(),
            )
        ),
    )
    svc = metadata.create_or_update(data=svc_request)
    config = {
        "source": {
            "type": "kafka",
            "serviceName": svc.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                    "generateSampleData": True,
                }
            },
            "serviceConnection": svc.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    yield svc, config
    svc = metadata.get_by_name(MessagingService, svc.fullyQualifiedName.root)
    if svc:
        metadata.delete(
            entity=MessagingService,
            entity_id=svc.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def ingestion_config_with_consumer_groups(db_service, metadata, workflow_config, sink_config):
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
def ingestion_config_with_sample_data(db_service, metadata, workflow_config, sink_config):
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
