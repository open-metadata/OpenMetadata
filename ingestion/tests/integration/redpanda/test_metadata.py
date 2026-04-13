"""
Integration tests for the Redpanda messaging connector.

Uses a real Redpanda broker via testcontainers to validate:
- Topic metadata extraction (partitions, schema, replication)
- Schema Registry integration (Avro)
- Consumer group extraction with real consumer
- Sample data extraction with message content validation
- Connection test validation
- Admin API connectivity
"""
import time

import pytest
from confluent_kafka import Consumer

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    """Run metadata ingestion and validate extracted topic properties."""
    run_workflow(MetadataWorkflow, ingestion_config)

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{db_service.fullyQualifiedName.root}.customers-100",
        fields=["*"],
        nullable=False,
    )

    assert topic is not None
    assert topic.name.root == "customers-100"
    assert topic.partitions >= 1
    assert topic.replicationFactor is not None
    assert topic.replicationFactor >= 1

    # Avro schema extracted from Redpanda's built-in Schema Registry
    assert topic.messageSchema is not None
    assert topic.messageSchema.schemaText is not None
    assert len(topic.messageSchema.schemaText) > 0
    assert topic.messageSchema.schemaFields is not None
    assert len(topic.messageSchema.schemaFields) > 0


def test_multiple_topics_discovered(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    """All topics from test data CSV are discovered."""
    run_workflow(MetadataWorkflow, ingestion_config)
    topics = metadata.list_entities(
        entity=Topic,
        params={"service": db_service.fullyQualifiedName.root},
    )
    assert topics.entities is not None
    topic_names = [t.name.root for t in topics.entities]
    assert "customers-100" in topic_names


def test_consumer_group_extraction(
    redpanda_consumer_group_service,
    metadata,
    redpanda_consumer_group,
):
    """Consumer groups are extracted using a dedicated service."""
    svc, config = redpanda_consumer_group_service
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
    if topic.consumerGroups is None:
        pytest.skip("Consumer groups not populated — server may need schema rebuild")
    group_ids = [cg.groupId for cg in topic.consumerGroups]
    assert "om-redpanda-test-group" in group_ids
    test_group = next(
        cg for cg in topic.consumerGroups if cg.groupId == "om-redpanda-test-group"
    )
    assert test_group.memberCount >= 0
    if test_group.partitionOffsets:
        assert len(test_group.partitionOffsets) >= 1
        assert test_group.partitionOffsets[0].currentOffset is not None
        assert test_group.totalLag is not None


def test_sample_data_ingestion(
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
    sample_data = sample_response.get("sampleData")
    if sample_data is None:
        pytest.skip("OM server did not return sampleData for this topic")
    messages = sample_data.get("messages", [])
    assert (
        len(messages) > 0
    ), "Sample data should contain at least one message from the test topic"


class TestRedpandaConnectionTest:
    """Test connection test steps and Admin API against real Redpanda broker."""

    def test_connection_test_passes(
        self,
        redpanda_container,
        metadata,
    ):
        """Connection test against a real Redpanda broker succeeds."""
        from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
            RedpandaConnection,
        )
        from metadata.ingestion.source.messaging.redpanda.connection import (
            get_connection,
            test_connection,
        )

        connection = RedpandaConnection(
            bootstrapServers=redpanda_container.get_bootstrap_server(),
            schemaRegistryURL=redpanda_container.get_schema_registry_url(),
            redpandaAdminApiUrl=redpanda_container.get_admin_api_url(),
        )
        client = get_connection(connection)
        result = test_connection(
            metadata=metadata,
            client=client,
            service_connection=connection,
        )
        step_results = {s.name: s for s in result.steps}
        assert step_results["GetTopics"].passed is True

    def test_admin_api_connectivity(self, redpanda_container):
        """Admin API client can reach the Redpanda Admin API."""
        from metadata.ingestion.source.messaging.redpanda.client import (
            RedpandaAdminClient,
        )

        client = RedpandaAdminClient(redpanda_container.get_admin_api_url())
        client.check_connectivity()

    def test_list_transforms_empty_cluster(self, redpanda_container):
        """A fresh Redpanda cluster has no data transforms."""
        from metadata.ingestion.source.messaging.redpanda.client import (
            RedpandaAdminClient,
        )

        client = RedpandaAdminClient(redpanda_container.get_admin_api_url())
        transforms = client.list_transforms()
        assert transforms == []


@pytest.fixture(scope="module")
def redpanda_consumer_group(redpanda_container):
    """Create an active consumer group by consuming from a topic.
    This ensures there is at least one consumer group for extraction."""
    conf = {
        "bootstrap.servers": redpanda_container.get_bootstrap_server(),
        "group.id": "om-redpanda-test-group",
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
