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

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.sampler.messaging.kafka.sampler import KafkaSampler


def test_build_consumer_config_plain_no_auth():
    connection_config = KafkaConnection(bootstrapServers="localhost:9092", type="Kafka")
    entity = MagicMock()
    entity.fullyQualifiedName = FullyQualifiedEntityName("kafka.test-topic")
    sampler = KafkaSampler(
        service_connection_config=connection_config,
        entity=entity,
        ometa_client=MagicMock(),
    )
    config = sampler._build_consumer_config()
    assert config["bootstrap.servers"] == "localhost:9092"
    assert config["group.id"] == "openmetadata-auto-classification"
    assert config["auto.offset.reset"] == "earliest"
    assert config["enable.auto.commit"] is False
    assert "sasl.username" not in config
    assert "sasl.password" not in config
    assert "security.protocol" not in config


def test_build_consumer_config_with_sasl_plaintext():
    connection_config = KafkaConnection(
        bootstrapServers="localhost:9092",
        type="Kafka",
        saslUsername="user",
        saslPassword="pass",
        saslMechanism="PLAIN",
        securityProtocol="SASL_PLAINTEXT",
    )
    entity = MagicMock()
    entity.fullyQualifiedName = FullyQualifiedEntityName("kafka.test-topic")
    sampler = KafkaSampler(
        service_connection_config=connection_config,
        entity=entity,
        ometa_client=MagicMock(),
    )
    config = sampler._build_consumer_config()
    assert config["sasl.username"] == "user"
    assert config["sasl.password"] == "pass"
    assert config["sasl.mechanism"] == "PLAIN"
    assert config["security.protocol"] == "SASL_PLAINTEXT"


def test_build_consumer_config_with_sasl_ssl():
    ssl_config = MagicMock()
    ssl_config.caLocation = "/path/to/ca.pem"
    ssl_config.certificateLocation = "/path/to/cert.pem"
    ssl_config.keyLocation = "/path/to/key.pem"

    connection_config = KafkaConnection(
        bootstrapServers="localhost:9092",
        type="Kafka",
        saslUsername="user",
        saslPassword="pass",
        saslMechanism="PLAIN",
        securityProtocol="SASL_SSL",
    )
    connection_config.consumerConfigSSL = ssl_config

    entity = MagicMock()
    entity.fullyQualifiedName = FullyQualifiedEntityName("kafka.test-topic")
    sampler = KafkaSampler(
        service_connection_config=connection_config,
        entity=entity,
        ometa_client=MagicMock(),
    )
    config = sampler._build_consumer_config()
    assert config["sasl.username"] == "user"
    assert config["sasl.password"] == "pass"
    assert config["security.protocol"] == "SASL_SSL"
    assert config["ssl.ca.location"] == "/path/to/ca.pem"
    assert config["ssl.certificate.location"] == "/path/to/cert.pem"
    assert config["ssl.key.location"] == "/path/to/key.pem"


@patch("metadata.sampler.messaging.kafka.sampler.Consumer")
@patch("metadata.sampler.messaging.kafka.sampler.time.time")
def test_fetch_messages_timeout(mock_time, mock_consumer_class):
    mock_consumer = MagicMock()
    mock_consumer_class.return_value = mock_consumer
    mock_consumer.poll.return_value = None

    time_values = [0.0, 5.0, 10.0, 15.0, 20.0, 25.0, 31.0]
    mock_time.side_effect = time_values

    connection_config = KafkaConnection(bootstrapServers="localhost:9092", type="Kafka")
    entity = MagicMock()
    entity.fullyQualifiedName = FullyQualifiedEntityName("kafka.test-topic")
    sampler = KafkaSampler(
        service_connection_config=connection_config,
        entity=entity,
        ometa_client=MagicMock(),
    )
    messages = sampler._fetch_messages(count=50)

    assert len(messages) == 0
    mock_consumer.close.assert_called_once()


@patch("metadata.sampler.messaging.kafka.sampler.Consumer")
@patch("metadata.sampler.messaging.kafka.sampler.time.time")
def test_fetch_messages_reaches_count_before_timeout(mock_time, mock_consumer_class):
    mock_consumer = MagicMock()
    mock_consumer_class.return_value = mock_consumer

    msg1 = MagicMock()
    msg1.error.return_value = None
    msg1.value.return_value = b'{"test": "data1"}'

    msg2 = MagicMock()
    msg2.error.return_value = None
    msg2.value.return_value = b'{"test": "data2"}'

    msg3 = None

    mock_consumer.poll.side_effect = [msg1, msg2, msg3]
    mock_time.side_effect = [0.0, 1.0, 2.0, 3.0]

    connection_config = KafkaConnection(bootstrapServers="localhost:9092", type="Kafka")
    entity = MagicMock()
    entity.fullyQualifiedName = FullyQualifiedEntityName("kafka.test-topic")
    sampler = KafkaSampler(
        service_connection_config=connection_config,
        entity=entity,
        ometa_client=MagicMock(),
    )
    messages = sampler._fetch_messages(count=2)

    assert len(messages) == 2
    assert messages[0] == {"test": "data1"}
    assert messages[1] == {"test": "data2"}
    mock_consumer.close.assert_called_once()
