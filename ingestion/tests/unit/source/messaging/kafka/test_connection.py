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
"""Unit tests for Kafka connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.messaging.kafka.connection import KafkaConnection

CONNECTION_MODULE = "metadata.ingestion.source.messaging.kafka.connection"


def test_kafka_connection_is_base_connection():
    assert issubclass(KafkaConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = KafkaConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_test_connection_runs_steps():
    conn = KafkaConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value


def _kafka_config(**overrides):
    from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
        KafkaConnection as KafkaConnectionConfig,
    )

    return KafkaConnectionConfig(bootstrapServers="localhost:9092", **overrides)


def test_consumer_is_built_without_a_schema_registry():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    # The consumer is built lazily, so it must be touched inside the patch or the
    # factory resolves the real Consumer and dials a broker.
    with patch(f"{CONNECTION_MODULE}.AdminClient"), patch(f"{CONNECTION_MODULE}.Consumer") as mock_consumer:
        client = get_connection(_kafka_config())

        assert client.schema_registry_client is None
        assert client.consumer_client is mock_consumer.return_value
        consumer_config = mock_consumer.call_args.args[0]
        assert consumer_config["bootstrap.servers"] == "localhost:9092"
        assert "value.deserializer" not in consumer_config


def test_admin_client_does_not_inherit_consumer_only_settings():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    with (
        patch(f"{CONNECTION_MODULE}.AdminClient") as mock_admin,
        patch(f"{CONNECTION_MODULE}.Consumer"),
    ):
        get_connection(_kafka_config())

    admin_config = mock_admin.call_args.args[0]
    assert "group.id" not in admin_config
    assert "enable.auto.commit" not in admin_config


def test_consumer_is_not_built_until_it_is_used():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    with patch(f"{CONNECTION_MODULE}.AdminClient"), patch(f"{CONNECTION_MODULE}.Consumer") as mock_consumer:
        client = get_connection(_kafka_config())
        mock_consumer.assert_not_called()

        assert client.consumer_client is mock_consumer.return_value
        assert client.consumer_client is mock_consumer.return_value
        mock_consumer.assert_called_once()


def test_close_consumer_is_a_no_op_when_none_was_built():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    with patch(f"{CONNECTION_MODULE}.AdminClient"), patch(f"{CONNECTION_MODULE}.Consumer") as mock_consumer:
        client = get_connection(_kafka_config())
        client.close_consumer()

    mock_consumer.return_value.close.assert_not_called()


def test_close_consumer_releases_a_built_consumer():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    with patch(f"{CONNECTION_MODULE}.AdminClient"), patch(f"{CONNECTION_MODULE}.Consumer") as mock_consumer:
        client = get_connection(_kafka_config())
        client.consumer_client  # noqa: B018
        client.close_consumer()

    mock_consumer.return_value.close.assert_called_once()


def test_secret_references_in_config_maps_are_resolved():
    """Map entries arrive as `secret:` references when an external secrets manager is
    configured; they must be resolved before the dict reaches librdkafka."""
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    config = _kafka_config(
        consumerConfig={
            "sasl.oauthbearer.client.secret": "secret:/om/messaging/prod_kafka/consumerconfig/additionalproperties/sasl_oauthbearer_client_secret",
            "session.timeout.ms": 6000,
        },
        schemaRegistryConfig={
            "basic.auth.user.info": "secret:/om/messaging/prod_kafka/schemaregistryconfig/additionalproperties/basic_auth_user_info",
        },
        schemaRegistryURL="https://registry.example.com",
    )
    secrets_manager = MagicMock()
    secrets_manager.get_string_value.side_effect = lambda secret_id: f"resolved:{secret_id}"

    with (
        patch(f"{CONNECTION_MODULE}.AdminClient") as mock_admin,
        patch(f"{CONNECTION_MODULE}.SchemaRegistryClient") as mock_registry,
        patch("metadata.utils.secrets.secrets_manager_factory.SecretsManagerFactory") as mock_factory,
    ):
        mock_factory.return_value.get_secrets_manager.return_value = secrets_manager
        get_connection(config)

    admin_config = mock_admin.call_args.args[0]
    assert admin_config["sasl.oauthbearer.client.secret"].startswith("resolved:/om/messaging")
    assert admin_config["session.timeout.ms"] == 6000
    registry_config = mock_registry.call_args.args[0]
    assert registry_config["basic.auth.user.info"].startswith("resolved:/om/messaging")


def test_config_maps_pass_through_when_no_secrets_manager_is_configured():
    from metadata.ingestion.source.messaging.kafka.connection import get_connection

    config = _kafka_config(consumerConfig={"ssl.key.password": "secret:/om/messaging/prod/key"})

    with (
        patch(f"{CONNECTION_MODULE}.AdminClient") as mock_admin,
        patch("metadata.utils.secrets.secrets_manager_factory.SecretsManagerFactory") as mock_factory,
    ):
        mock_factory.return_value.get_secrets_manager.return_value = None
        get_connection(config)

    admin_config = mock_admin.call_args.args[0]
    assert admin_config["ssl.key.password"] == "secret:/om/messaging/prod/key"
