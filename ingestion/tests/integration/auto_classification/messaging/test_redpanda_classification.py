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
Integration tests for Redpanda auto-classification workflow.

Redpanda is Kafka-protocol compatible, so RedpandaSampler delegates to KafkaSampler.
These tests verify that the delegation works correctly with the same fixtures.
"""

import pytest

pytest.importorskip("confluent_kafka", reason="confluent_kafka not installed; skipping Redpanda tests")

from ingestion.tests.integration.auto_classification.messaging.conftest import (
    PII_TOPIC_NAME,
)
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.messagingService import MessagingServiceType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus


@pytest.fixture(scope="module")
def redpanda_service_name():
    import uuid

    return f"redpanda_autoclassification_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def redpanda_messaging_service(metadata, kafka_container, redpanda_service_name):
    """Register a MessagingService as Redpanda (but use same Kafka container)."""
    from metadata.generated.schema.api.services.createMessagingService import (
        CreateMessagingServiceRequest,
    )
    from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
        KafkaConnection,
    )
    from metadata.generated.schema.entity.services.messagingService import (
        MessagingConnection,
        MessagingService,
    )

    service_entity = metadata.create_or_update(
        CreateMessagingServiceRequest(
            name=redpanda_service_name,
            serviceType=MessagingServiceType.Redpanda,
            connection=MessagingConnection(
                config=KafkaConnection(
                    bootstrapServers=kafka_container.get_bootstrap_server(),
                )
            ),
        )
    )
    yield service_entity
    fresh = metadata.get_by_name(MessagingService, service_entity.fullyQualifiedName.root)
    if fresh:
        metadata.delete(
            entity=MessagingService,
            entity_id=fresh.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def redpanda_autoclassification_config_pii(
    redpanda_messaging_service, kafka_container, bot_workflow_config, sink_config
):
    return {
        "source": {
            "type": "redpanda",
            "serviceName": redpanda_messaging_service.fullyQualifiedName.root,
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": kafka_container.get_bootstrap_server(),
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "topicFilterPattern": {"includes": [f"^{PII_TOPIC_NAME}$"]},
                    "storeSampleData": True,
                    "sampleDataCount": 50,
                    "enableAutoClassification": True,
                    "confidence": 80,
                }
            },
        },
        "processor": {"type": "tag-pii-processor", "config": {}},
        "sink": sink_config,
        "workflowConfig": bot_workflow_config,
    }


@pytest.fixture(scope="module")
def run_redpanda_autoclassification_pii(
    pii_classification,
    sensitive_pii_tag,
    non_sensitive_pii_tag,
    kafka_pii_topic,
    run_workflow,
    redpanda_autoclassification_config_pii,
):
    from metadata.workflow.classification import AutoClassificationWorkflow

    return run_workflow(AutoClassificationWorkflow, redpanda_autoclassification_config_pii)


class TestRedpandaAutoClassification:
    """Tests that Redpanda (Kafka-protocol compatible) works with auto-classification."""

    def test_redpanda_workflow_completes_successfully(
        self,
        run_redpanda_autoclassification_pii,
    ):
        assert run_redpanda_autoclassification_pii.result_status() is WorkflowResultStatus.SUCCESS

    def test_redpanda_sample_data_stored(
        self,
        metadata: OpenMetadata,
        redpanda_messaging_service,
        run_redpanda_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{redpanda_messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["sampleData"],
        )
        assert topic is not None
        assert topic.sampleData is not None
        assert len(topic.sampleData.messages) > 0

    def test_redpanda_pii_field_tagged(
        self,
        metadata: OpenMetadata,
        redpanda_messaging_service,
        run_redpanda_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{redpanda_messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["messageSchema"],
        )
        fields = topic.messageSchema.schemaFields
        email_field = next((f for f in fields if f.name.root == "email"), None)
        assert email_field is not None
        assert email_field.tags is not None
        assert any(tag.tagFQN.root == "PII.Sensitive" for tag in email_field.tags)
