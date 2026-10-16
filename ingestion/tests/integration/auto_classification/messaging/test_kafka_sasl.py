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
Env-var-gated integration test for the AutoClassificationWorkflow over
a SASL-authenticated Kafka cluster.

This test only verifies connectivity and basic sample-data ingestion — it
intentionally disables the PII processor (enableAutoClassification=False) so
that the assertions remain stable regardless of topic content.

Required environment variables:
  KAFKA_SASL_HOST       - Kafka bootstrap servers (e.g. "broker.example.com:9093")
  KAFKA_SASL_USERNAME   - SASL username
  KAFKA_SASL_PASSWORD   - SASL password
  KAFKA_SASL_TOPIC      - Existing topic name to sample (e.g. "my-topic")

Optional:
  KAFKA_SASL_MECHANISM  - SASL mechanism (default: "PLAIN")
  KAFKA_SASL_PROTOCOL   - Security protocol (default: "SASL_PLAINTEXT")
"""

import logging
import os
import uuid

import pytest

from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
    SecurityProtocol,
)
from metadata.generated.schema.entity.services.connections.messaging.saslMechanismType import (
    SaslMechanismType,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus

logger = logging.getLogger(__name__)

REQUIRED_ENV_VARS = [
    "KAFKA_SASL_HOST",
    "KAFKA_SASL_USERNAME",
    "KAFKA_SASL_PASSWORD",
    "KAFKA_SASL_TOPIC",
]

pytestmark = pytest.mark.skipif(
    not all(os.environ.get(v) for v in REQUIRED_ENV_VARS),
    reason=("Kafka SASL integration tests require environment variables: " + ", ".join(REQUIRED_ENV_VARS)),
)


@pytest.fixture(scope="module")
def sasl_messaging_service(metadata):
    mechanism_str = os.environ.get("KAFKA_SASL_MECHANISM", "PLAIN")
    protocol_str = os.environ.get("KAFKA_SASL_PROTOCOL", "SASL_PLAINTEXT")

    service_entity = metadata.create_or_update(
        CreateMessagingServiceRequest(
            name=f"kafka_sasl_test_{uuid.uuid4().hex[:8]}",
            serviceType=MessagingServiceType.Kafka,
            connection=MessagingConnection(
                config=KafkaConnection(
                    bootstrapServers=os.environ["KAFKA_SASL_HOST"],
                    saslUsername=os.environ["KAFKA_SASL_USERNAME"],
                    saslPassword=os.environ["KAFKA_SASL_PASSWORD"],
                    saslMechanism=SaslMechanismType(mechanism_str),
                    securityProtocol=SecurityProtocol(protocol_str),
                )
            ),
        )
    )
    fqn = service_entity.fullyQualifiedName.root
    yield service_entity
    service_entity = metadata.get_by_name(MessagingService, fqn)
    if service_entity:
        metadata.delete(
            entity=MessagingService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def sasl_autoclassification_config(sasl_messaging_service, workflow_config, sink_config):
    topic = os.environ["KAFKA_SASL_TOPIC"]
    return {
        "source": {
            "type": sasl_messaging_service.connection.config.type.value.lower(),
            "serviceName": sasl_messaging_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "topicFilterPattern": {"includes": [f"^{topic}$"]},
                    "storeSampleData": True,
                    "enableAutoClassification": False,
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def run_sasl_autoclassification(run_workflow, sasl_autoclassification_config):
    return run_workflow(AutoClassificationWorkflow, sasl_autoclassification_config, raise_from_status=False)


class TestKafkaSaslAutoClassification:
    def test_workflow_completes_without_auth_errors(self, run_sasl_autoclassification):
        status = run_sasl_autoclassification.result_status()
        assert status is WorkflowResultStatus.SUCCESS, (
            "AutoClassification workflow over SASL Kafka should complete with status SUCCESS. "
            "A FAILURE here typically means authentication was rejected or the broker was unreachable."
        )

    def test_sample_data_exists_on_topic(self, metadata, sasl_messaging_service, run_sasl_autoclassification):
        service_fqn = sasl_messaging_service.fullyQualifiedName.root
        topic_name = os.environ["KAFKA_SASL_TOPIC"]
        topic_fqn = f"{service_fqn}.{topic_name}"

        topic = metadata.get_by_name(entity=Topic, fqn=topic_fqn, fields=["sampleData"])
        assert topic is not None, f"Topic not found in OpenMetadata: {topic_fqn}"
        assert topic.sampleData is not None, "sampleData field is absent on the ingested topic"
        assert topic.sampleData.messages, (
            f"Expected at least one sample message on topic '{topic_name}', but sampleData.messages was empty. "
            "Ensure the topic has consumable messages and the SASL credentials have read access."
        )
