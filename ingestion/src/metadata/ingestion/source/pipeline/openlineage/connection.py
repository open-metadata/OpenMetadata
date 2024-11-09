#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""
from typing import Optional

from confluent_kafka import Consumer as KafkaConsumer
from confluent_kafka import TopicPartition

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    SecurityProtocol as KafkaSecProtocol,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection(connection: OpenLineageConnection) -> KafkaConsumer:
    """
    Create connection
    """
    try:
        config = {
            "bootstrap.servers": connection.brokersUrl,
            "group.id": connection.consumerGroupName,
            "auto.offset.reset": connection.consumerOffsets.value,
        }
        if connection.securityProtocol.value == KafkaSecProtocol.SSL.value:
            config.update(
                {
                    "security.protocol": connection.securityProtocol.value,
                    "ssl.ca.location": connection.sslConfig.root.caCertificate,
                    "ssl.certificate.location": connection.sslConfig.root.sslCertificate,
                    "ssl.key.location": connection.sslConfig.root.sslKey,
                }
            )
        elif connection.securityProtocol.value == KafkaSecProtocol.SASL_SSL.value:
            config.update(
                {
                    "security.protocol": connection.securityProtocol.value,
                    "sasl.mechanism": connection.saslConfig.saslMechanism.value,
                    "sasl.username": connection.saslConfig.saslUsername,
                    "sasl.password": connection.saslConfig.saslPassword,
                }
            )

        kafka_consumer = KafkaConsumer(config)
        kafka_consumer.subscribe([connection.topicName])

        return kafka_consumer
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg)


def test_connection(
    metadata: OpenMetadata,
    client: KafkaConsumer,
    service_connection: OpenLineageConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        _ = client.get_watermark_offsets(
            TopicPartition(service_connection.topicName, 0)
        )

    test_fn = {"GetWatermarkOffsets": custom_executor}

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
