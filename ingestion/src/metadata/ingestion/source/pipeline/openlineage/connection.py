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
Source connection handler
"""
from typing import Optional, Union

from botocore.client import BaseClient
from confluent_kafka import Consumer as KafkaConsumer
from confluent_kafka import TopicPartition

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    KafkaBrokerConfig,
    KinesisBrokerConfig,
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


def get_connection(
    connection: OpenLineageConnection,
) -> Union[KafkaConsumer, BaseClient]:
    """
    Create connection based on broker config type.
    """
    broker = connection.brokerConfig

    if isinstance(broker, KafkaBrokerConfig):
        return _get_kafka_connection(broker)

    if isinstance(broker, KinesisBrokerConfig):
        return _get_kinesis_connection(broker)

    raise SourceConnectionException(f"Unsupported broker config type: {type(broker)}")


def _get_kafka_connection(broker: KafkaBrokerConfig) -> KafkaConsumer:
    try:
        config = {
            "bootstrap.servers": broker.brokersUrl,
            "group.id": broker.consumerGroupName,
            "auto.offset.reset": broker.consumerOffsets.value,
            "security.protocol": broker.securityProtocol.value,
        }
        if broker.securityProtocol.value in (
            KafkaSecProtocol.SSL.value,
            KafkaSecProtocol.SASL_SSL.value,
        ):
            config.update(
                {
                    "ssl.ca.location": broker.sslConfig.root.caCertificate,
                    "ssl.certificate.location": broker.sslConfig.root.sslCertificate,
                    "ssl.key.location": broker.sslConfig.root.sslKey,
                }
            )
        if broker.securityProtocol.value in (
            KafkaSecProtocol.SASL_PLAINTEXT.value,
            KafkaSecProtocol.SASL_SSL.value,
        ):
            config.update(
                {
                    "sasl.mechanism": broker.saslConfig.saslMechanism.value,
                    "sasl.username": broker.saslConfig.saslUsername,
                    "sasl.password": broker.saslConfig.saslPassword,
                }
            )

        kafka_consumer = KafkaConsumer(config)
        kafka_consumer.subscribe([broker.topicName])

        return kafka_consumer
    except Exception as exc:
        msg = f"Unknown error connecting with Kafka broker: {exc}."
        raise SourceConnectionException(msg)


def _get_kinesis_connection(broker: KinesisBrokerConfig):
    try:
        return AWSClient(broker.awsConfig).get_kinesis_client()
    except Exception as exc:
        msg = f"Unknown error connecting with Kinesis: {exc}."
        raise SourceConnectionException(msg)


def test_connection(
    metadata: OpenMetadata,
    client: Union[KafkaConsumer, object],
    service_connection: OpenLineageConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    broker = service_connection.brokerConfig

    if isinstance(broker, KafkaBrokerConfig):

        def custom_executor():
            _ = client.get_watermark_offsets(TopicPartition(broker.topicName, 0))

        test_fn = {"CheckBrokerConnectivity": custom_executor}

    elif isinstance(broker, KinesisBrokerConfig):

        def custom_executor():
            client.describe_stream_summary(StreamName=broker.streamName)

        test_fn = {"CheckBrokerConnectivity": custom_executor}

    else:
        raise SourceConnectionException(
            f"Unsupported broker config type: {type(broker)}"
        )

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
