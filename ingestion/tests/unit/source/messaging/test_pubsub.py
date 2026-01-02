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
Unit tests for Google Cloud Pub/Sub connector
"""
import os
from unittest.mock import MagicMock, patch

import pytest
from google.protobuf.duration_pb2 import Duration

from metadata.ingestion.source.messaging.pubsub.models import (
    PubSubBigQueryConfig,
    PubSubSchemaInfo,
    PubSubSubscription,
    PubSubTopicMetadata,
)


class TestPubSubModels:
    """Test Pub/Sub Pydantic models"""

    def test_pubsub_bigquery_config_all_fields(self):
        """Test PubSubBigQueryConfig with all fields"""
        config = PubSubBigQueryConfig(
            table="project.dataset.table",
            use_topic_schema=True,
            write_metadata=True,
            drop_unknown_fields=False,
        )
        assert config.table == "project.dataset.table"
        assert config.use_topic_schema is True
        assert config.write_metadata is True
        assert config.drop_unknown_fields is False

    def test_pubsub_bigquery_config_optional_fields(self):
        """Test PubSubBigQueryConfig with only required fields"""
        config = PubSubBigQueryConfig()
        assert config.table is None
        assert config.use_topic_schema is None
        assert config.write_metadata is None
        assert config.drop_unknown_fields is None

    def test_pubsub_subscription_all_fields(self):
        """Test PubSubSubscription with all fields"""
        bigquery_config = PubSubBigQueryConfig(table="project.dataset.table")
        subscription = PubSubSubscription(
            name="test-subscription",
            ack_deadline_seconds=60,
            message_retention_duration="604800s",
            dead_letter_topic="projects/test/topics/dead-letter",
            push_endpoint="https://example.com/push",
            filter='attributes.type = "test"',
            bigquery_config=bigquery_config,
            enable_exactly_once_delivery=True,
        )
        assert subscription.name == "test-subscription"
        assert subscription.ack_deadline_seconds == 60
        assert subscription.message_retention_duration == "604800s"
        assert subscription.dead_letter_topic == "projects/test/topics/dead-letter"
        assert subscription.push_endpoint == "https://example.com/push"
        assert subscription.filter == 'attributes.type = "test"'
        assert subscription.bigquery_config.table == "project.dataset.table"
        assert subscription.enable_exactly_once_delivery is True

    def test_pubsub_subscription_minimal(self):
        """Test PubSubSubscription with only required fields"""
        subscription = PubSubSubscription(name="minimal-subscription")
        assert subscription.name == "minimal-subscription"
        assert subscription.ack_deadline_seconds is None
        assert subscription.bigquery_config is None

    def test_pubsub_schema_info(self):
        """Test PubSubSchemaInfo model"""
        schema_info = PubSubSchemaInfo(
            name="test-schema",
            schema_type="AVRO",
            definition='{"type": "record", "name": "Test"}',
            revision_id="abc123",
        )
        assert schema_info.name == "test-schema"
        assert schema_info.schema_type == "AVRO"
        assert schema_info.definition == '{"type": "record", "name": "Test"}'
        assert schema_info.revision_id == "abc123"

    def test_pubsub_topic_metadata_all_fields(self):
        """Test PubSubTopicMetadata with all fields"""
        schema_info = PubSubSchemaInfo(name="schema", schema_type="AVRO")
        subscription = PubSubSubscription(name="sub1")

        metadata = PubSubTopicMetadata(
            name="projects/test/topics/test-topic",
            labels={"env": "test", "team": "data"},
            message_retention_duration="604800s",
            schema_settings=schema_info,
            subscriptions=[subscription],
            ordering_enabled=True,
            kms_key_name="projects/test/locations/us/keyRings/ring/cryptoKeys/key",
        )
        assert metadata.name == "projects/test/topics/test-topic"
        assert metadata.labels == {"env": "test", "team": "data"}
        assert metadata.message_retention_duration == "604800s"
        assert metadata.schema_settings.name == "schema"
        assert len(metadata.subscriptions) == 1
        assert metadata.ordering_enabled is True
        assert "keyRings" in metadata.kms_key_name

    def test_pubsub_topic_metadata_minimal(self):
        """Test PubSubTopicMetadata with only required fields"""
        metadata = PubSubTopicMetadata(name="projects/test/topics/minimal")
        assert metadata.name == "projects/test/topics/minimal"
        assert metadata.labels is None
        assert metadata.subscriptions is None
        assert metadata.ordering_enabled is False


class TestPubSubConnection:
    """Test Pub/Sub connection handling"""

    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.set_google_credentials"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.PublisherClient"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.SubscriberClient"
    )
    @patch("metadata.ingestion.source.messaging.pubsub.connection.SchemaServiceClient")
    def test_get_connection_with_project_id(
        self, mock_schema_client, mock_subscriber, mock_publisher, mock_set_creds
    ):
        """Test get_connection with explicit project ID"""
        from metadata.ingestion.source.messaging.pubsub.connection import (
            PubSubClient,
            get_connection,
        )

        mock_connection = MagicMock()
        mock_connection.projectId = "test-project"
        mock_connection.gcpConfig = MagicMock()
        mock_connection.useEmulator = False
        mock_connection.hostPort = None
        mock_connection.schemaRegistryEnabled = True

        client = get_connection(mock_connection)

        assert isinstance(client, PubSubClient)
        assert client.project_id == "test-project"
        mock_set_creds.assert_called_once_with(mock_connection.gcpConfig)
        mock_publisher.assert_called_once()
        mock_subscriber.assert_called_once()
        mock_schema_client.assert_called_once()

    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.set_google_credentials"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.PublisherClient"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.SubscriberClient"
    )
    def test_get_connection_without_schema_registry(
        self, mock_subscriber, mock_publisher, mock_set_creds
    ):
        """Test get_connection with schema registry disabled"""
        from metadata.ingestion.source.messaging.pubsub.connection import get_connection

        mock_connection = MagicMock()
        mock_connection.projectId = "test-project"
        mock_connection.gcpConfig = MagicMock()
        mock_connection.useEmulator = False
        mock_connection.hostPort = None
        mock_connection.schemaRegistryEnabled = False

        client = get_connection(mock_connection)

        assert client.schema_client is None

    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.set_google_credentials"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.PublisherClient"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.SubscriberClient"
    )
    def test_get_connection_with_emulator(
        self, mock_subscriber, mock_publisher, mock_set_creds
    ):
        """Test get_connection with emulator enabled"""
        from metadata.ingestion.source.messaging.pubsub.connection import (
            PUBSUB_EMULATOR_HOST,
            get_connection,
        )

        mock_connection = MagicMock()
        mock_connection.projectId = "test-project"
        mock_connection.gcpConfig = MagicMock()
        mock_connection.useEmulator = True
        mock_connection.hostPort = "localhost:8085"
        mock_connection.schemaRegistryEnabled = False

        get_connection(mock_connection)

        assert os.environ.get(PUBSUB_EMULATOR_HOST) == "localhost:8085"

        del os.environ[PUBSUB_EMULATOR_HOST]

    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.set_google_credentials"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.PublisherClient"
    )
    @patch(
        "metadata.ingestion.source.messaging.pubsub.connection.pubsub_v1.SubscriberClient"
    )
    def test_get_connection_missing_project_id_raises(
        self, mock_subscriber, mock_publisher, mock_set_creds
    ):
        """Test get_connection raises ValueError when project ID is missing"""
        from metadata.ingestion.source.messaging.pubsub.connection import get_connection

        mock_connection = MagicMock()
        mock_connection.projectId = None
        mock_connection.gcpConfig = MagicMock()
        mock_connection.gcpConfig.gcpConfig = None
        mock_connection.useEmulator = False
        mock_connection.hostPort = None
        mock_connection.schemaRegistryEnabled = False

        with pytest.raises(ValueError, match="Project ID is required"):
            get_connection(mock_connection)

    def test_get_project_id_from_connection(self):
        """Test _get_project_id extracts project ID from connection config"""
        from metadata.ingestion.source.messaging.pubsub.connection import (
            _get_project_id,
        )

        mock_connection = MagicMock()
        mock_connection.projectId = "explicit-project"

        result = _get_project_id(mock_connection)
        assert result == "explicit-project"

    def test_get_project_id_from_credentials(self):
        """Test _get_project_id extracts project ID from GCP credentials"""
        from metadata.generated.schema.security.credentials.gcpValues import (
            GcpCredentialsValues,
            SingleProjectId,
        )
        from metadata.ingestion.source.messaging.pubsub.connection import (
            _get_project_id,
        )

        mock_connection = MagicMock()
        mock_connection.projectId = None
        mock_connection.gcpConfig = MagicMock()
        mock_connection.gcpConfig.gcpConfig = GcpCredentialsValues(
            projectId=SingleProjectId("credentials-project"),
            privateKey="fake-key",
            clientEmail="test@example.iam.gserviceaccount.com",
        )

        result = _get_project_id(mock_connection)
        assert result == "credentials-project"

    def test_get_project_id_returns_none_when_missing(self):
        """Test _get_project_id returns None when project ID cannot be determined"""
        from metadata.ingestion.source.messaging.pubsub.connection import (
            _get_project_id,
        )

        mock_connection = MagicMock()
        mock_connection.projectId = None
        mock_connection.gcpConfig = None

        result = _get_project_id(mock_connection)
        assert result is None


class TestPubSubMetadataParsing:
    """Test Pub/Sub metadata parsing utilities"""

    @pytest.fixture
    def pubsub_source_class(self):
        """Import PubsubSource class"""
        from metadata.ingestion.source.messaging.pubsub.metadata import PubsubSource

        return PubsubSource

    def test_format_duration_with_protobuf_duration(self, pubsub_source_class):
        """Test _format_duration with protobuf Duration object"""
        duration = Duration(seconds=604800, nanos=0)
        result = pubsub_source_class._format_duration(None, duration)
        assert result == "604800.0s"

    def test_format_duration_with_nanos(self, pubsub_source_class):
        """Test _format_duration with nanoseconds"""
        duration = Duration(seconds=100, nanos=500000000)
        result = pubsub_source_class._format_duration(None, duration)
        assert result == "100.5s"

    def test_format_duration_with_string(self, pubsub_source_class):
        """Test _format_duration with string input"""
        result = pubsub_source_class._format_duration(None, "604800s")
        assert result == "604800s"

    def test_format_duration_with_none(self, pubsub_source_class):
        """Test _format_duration with None input"""
        result = pubsub_source_class._format_duration(None, None)
        assert result is None

    def test_parse_retention_with_protobuf_duration(self, pubsub_source_class):
        """Test _parse_retention with protobuf Duration object"""
        duration = Duration(seconds=604800, nanos=0)
        result = pubsub_source_class._parse_retention(None, duration)
        assert result == 604800000.0

    def test_parse_retention_with_string_seconds_suffix(self, pubsub_source_class):
        """Test _parse_retention with string ending in 's'"""
        result = pubsub_source_class._parse_retention(None, "604800s")
        assert result == 604800000.0

    def test_parse_retention_with_string_seconds_word(self, pubsub_source_class):
        """Test _parse_retention with string containing 'seconds'"""
        result = pubsub_source_class._parse_retention(None, "604800 seconds")
        assert result == 604800000.0

    def test_parse_retention_with_none(self, pubsub_source_class):
        """Test _parse_retention with None input"""
        result = pubsub_source_class._parse_retention(None, None)
        assert result == 0.0

    def test_parse_retention_with_invalid_string(self, pubsub_source_class):
        """Test _parse_retention with invalid string"""
        result = pubsub_source_class._parse_retention(None, "invalid")
        assert result == 0.0

    def test_map_schema_type_avro(self, pubsub_source_class):
        """Test _map_schema_type for AVRO"""
        from metadata.generated.schema.type.schema import SchemaType

        result = pubsub_source_class._map_schema_type(None, "AVRO")
        assert result == SchemaType.Avro

    def test_map_schema_type_protobuf(self, pubsub_source_class):
        """Test _map_schema_type for PROTOCOL_BUFFER"""
        from metadata.generated.schema.type.schema import SchemaType

        result = pubsub_source_class._map_schema_type(None, "PROTOCOL_BUFFER")
        assert result == SchemaType.Protobuf

    def test_map_schema_type_unknown(self, pubsub_source_class):
        """Test _map_schema_type for unknown type"""
        from metadata.generated.schema.type.schema import SchemaType

        result = pubsub_source_class._map_schema_type(None, "UNKNOWN")
        assert result == SchemaType.Other


class TestPubSubSourceCreation:
    """Test PubsubSource.create() method"""

    def test_create_with_invalid_connection_type_raises(self):
        """Test create() raises InvalidSourceException for wrong connection type"""
        from metadata.ingestion.api.steps import InvalidSourceException
        from metadata.ingestion.source.messaging.pubsub.metadata import PubsubSource

        config_dict = {
            "type": "pubsub",
            "serviceName": "test-pubsub",
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": "localhost:9092",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                }
            },
        }

        mock_metadata = MagicMock()

        with pytest.raises(InvalidSourceException):
            PubsubSource.create(config_dict, mock_metadata)


class TestPubSubEdgeCases:
    """Test edge cases and error handling"""

    def test_subscription_with_empty_push_config(self):
        """Test handling subscription with empty push config"""
        subscription = PubSubSubscription(
            name="test-sub",
            push_endpoint=None,
        )
        assert subscription.push_endpoint is None

    def test_topic_metadata_with_empty_labels(self):
        """Test handling topic with empty labels dict"""
        metadata = PubSubTopicMetadata(
            name="test-topic",
            labels={},
        )
        assert metadata.labels == {}

    def test_topic_metadata_with_multiple_subscriptions(self):
        """Test topic with multiple subscriptions"""
        subscriptions = [PubSubSubscription(name=f"sub-{i}") for i in range(5)]
        metadata = PubSubTopicMetadata(
            name="test-topic",
            subscriptions=subscriptions,
        )
        assert len(metadata.subscriptions) == 5
        assert metadata.subscriptions[0].name == "sub-0"
        assert metadata.subscriptions[4].name == "sub-4"

    def test_bigquery_config_table_parsing(self):
        """Test BigQuery table FQN parsing"""
        config = PubSubBigQueryConfig(
            table="project.dataset.table",
        )
        parts = config.table.split(".")
        assert len(parts) == 3
        assert parts[0] == "project"
        assert parts[1] == "dataset"
        assert parts[2] == "table"

    def test_schema_info_with_complex_definition(self):
        """Test schema info with complex Avro definition"""
        complex_schema = """
        {
            "type": "record",
            "name": "User",
            "namespace": "com.example",
            "fields": [
                {"name": "id", "type": "long"},
                {"name": "name", "type": "string"},
                {"name": "email", "type": ["null", "string"], "default": null}
            ]
        }
        """
        schema_info = PubSubSchemaInfo(
            name="user-schema",
            schema_type="AVRO",
            definition=complex_schema.strip(),
        )
        assert "record" in schema_info.definition
        assert "User" in schema_info.definition
