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

from pathlib import Path
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.services.connections.messaging.saslMechanismType import (
    SaslMechanismType,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    Kafka as KafkaBrokerConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    SecurityProtocol,
)
from metadata.generated.schema.security.sasl.saslClientConfig import SaslClientConfig
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.openlineage.connection import (
    ManagedKafkaConsumer,
    _get_kafka_connection,
)
from metadata.utils.ssl_manager import SSLManager

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.openlineage.connection"
CA_CERT = "-----BEGIN CERTIFICATE-----\nTEST CA CONTENT\n-----END CERTIFICATE-----\n"


def _ssl_broker() -> KafkaBrokerConfig:
    return KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        consumerGroupName="om",
        securityProtocol=SecurityProtocol.SSL,
        sslConfig=SslConfig(
            root=ValidateSslClientConfig(
                caCertificate=CA_CERT,
                sslCertificate="CERT",
                sslKey="KEY",
            )
        ),
    )


def test_kafka_ssl_content_is_materialized_and_removed_on_close():
    broker = _ssl_broker()
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as kafka_consumer:
        consumer = _get_kafka_connection(broker)

    config = kafka_consumer.call_args.args[0]
    ssl_paths = [Path(value) for key, value in config.items() if key.startswith("ssl.")]
    assert all(path.is_file() for path in ssl_paths)
    assert "TEST CA CONTENT" in Path(config["ssl.ca.location"]).read_text(
        encoding="utf-8"
    )

    consumer.close()

    kafka_consumer.return_value.close.assert_called_once_with()
    assert all(not path.exists() for path in ssl_paths)


def test_kafka_ssl_content_is_removed_if_consumer_creation_fails():
    managers = []

    def build_ssl_manager(*args, **kwargs):
        manager = SSLManager(*args, **kwargs)
        managers.append(manager)
        return manager

    with patch(f"{CONNECTION_MODULE}.SSLManager", side_effect=build_ssl_manager), patch(
        f"{CONNECTION_MODULE}.KafkaConsumer",
        side_effect=RuntimeError("connection failed"),
    ), pytest.raises(SourceConnectionException):
        _get_kafka_connection(_ssl_broker())

    assert len(managers) == 1
    assert managers[0].temp_files == []


def test_kafka_sasl_password_is_resolved_from_secret():
    broker = KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        securityProtocol=SecurityProtocol.SASL_PLAINTEXT,
        saslConfig=SaslClientConfig(
            saslMechanism=SaslMechanismType.PLAIN,
            saslUsername="user",
            saslPassword="super-secret",
        ),
    )
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as kafka_consumer:
        consumer = _get_kafka_connection(broker)

    config = kafka_consumer.call_args.args[0]
    assert config["sasl.password"] == "super-secret"
    assert config["sasl.username"] == "user"
    assert isinstance(consumer, ManagedKafkaConsumer)


def test_kafka_plaintext_does_not_create_security_configuration():
    broker = KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        securityProtocol=SecurityProtocol.PLAINTEXT,
    )
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as kafka_consumer:
        _get_kafka_connection(broker)

    config = kafka_consumer.call_args.args[0]
    assert not any(key.startswith("ssl.") for key in config)
    assert not any(key.startswith("sasl.") for key in config)
