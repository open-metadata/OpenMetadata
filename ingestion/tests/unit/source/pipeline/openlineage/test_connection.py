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
"""Unit tests for OpenLineage connection handling."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.messaging.saslMechanismType import (
    SaslMechanismType,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    KafkaBrokerConfig,
    SecurityProtocol,
)
from metadata.generated.schema.security.sasl.saslClientConfig import SaslClientConfig
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.openlineage.connection import (
    OpenLineageConnection,
    _get_kafka_connection,
)

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.openlineage.connection"

CA_CERT = "-----BEGIN CERTIFICATE-----\nTEST CA CONTENT\n-----END CERTIFICATE-----\n"


def _ssl_broker():
    ssl_config = SslConfig(root=ValidateSslClientConfig(caCertificate=CA_CERT, sslCertificate="CERT", sslKey="KEY"))
    return KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        consumerGroupName="om",
        securityProtocol=SecurityProtocol.SSL,
        sslConfig=ssl_config,
    )


def test_openlineage_connection_is_base_connection():
    assert issubclass(OpenLineageConnection, BaseConnection)


def test_get_client_builds_client():
    service_connection = MagicMock()
    service_connection.brokerConfig = MagicMock(spec=KafkaBrokerConfig)
    with patch(f"{CONNECTION_MODULE}._get_kafka_connection") as mock_kafka:
        mock_kafka.return_value = (MagicMock(), None)
        conn = OpenLineageConnection(service_connection)
        client = conn.client

    assert client is mock_kafka.return_value[0]
    mock_kafka.assert_called_once_with(service_connection.brokerConfig)


def test_kafka_ssl_ca_content_is_materialized_as_temp_file():
    """SSL cert content must be written to a temp file whose path is passed to the consumer,
    not the raw (masked) secret — confluent_kafka's ssl.*.location keys are file paths."""
    broker = _ssl_broker()
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as mock_consumer:
        _, ssl_manager = _get_kafka_connection(broker)

    config = mock_consumer.call_args.args[0]
    ca_path = config["ssl.ca.location"]
    assert ca_path is not None
    assert Path(ca_path).is_file()
    assert "TEST CA CONTENT" in Path(ca_path).read_text(encoding="utf-8")
    assert config["ssl.certificate.location"] is not None
    assert config["ssl.key.location"] is not None
    assert ssl_manager is not None
    ssl_manager.cleanup_temp_files()


def test_kafka_ssl_temp_files_cleaned_up_when_consumer_fails():
    """If the consumer cannot be built, the materialized cert temp files must still be
    torn down so repeated failed connects do not orphan cert material in the temp dir."""
    broker = _ssl_broker()
    ssl_manager = MagicMock()
    with (
        patch(f"{CONNECTION_MODULE}.SSLManager", return_value=ssl_manager),
        patch(f"{CONNECTION_MODULE}.KafkaConsumer", side_effect=Exception("boom")),
        pytest.raises(SourceConnectionException),
    ):
        _get_kafka_connection(broker)
    ssl_manager.cleanup_temp_files.assert_called_once()


def test_kafka_sasl_password_is_read_from_secret():
    """The SASL password should be resolved through the secret, not passed as the masked object."""
    sasl_config = SaslClientConfig(
        saslMechanism=SaslMechanismType.PLAIN,
        saslUsername="user",
        saslPassword="super-secret",
    )
    broker = KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        securityProtocol=SecurityProtocol.SASL_PLAINTEXT,
        saslConfig=sasl_config,
    )
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as mock_consumer:
        _, ssl_manager = _get_kafka_connection(broker)

    config = mock_consumer.call_args.args[0]
    assert config["sasl.password"] == "super-secret"
    assert config["sasl.username"] == "user"
    assert ssl_manager is None


def test_kafka_plaintext_skips_ssl_and_sasl():
    broker = KafkaBrokerConfig(
        brokersUrl="broker:9092",
        topicName="openlineage",
        securityProtocol=SecurityProtocol.PLAINTEXT,
    )
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer") as mock_consumer:
        _, ssl_manager = _get_kafka_connection(broker)

    config = mock_consumer.call_args.args[0]
    assert not any(key.startswith("ssl.") for key in config)
    assert not any(key.startswith("sasl.") for key in config)
    assert ssl_manager is None


def test_test_connection_runs_steps():
    service_connection = MagicMock()
    service_connection.brokerConfig = MagicMock(spec=KafkaBrokerConfig)
    conn = OpenLineageConnection(service_connection)
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value
