"""
Manage SSL test cases
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource


class KafkaSourceSSLTest(TestCase):
    @patch(
        "metadata.ingestion.source.messaging.messaging_service.MessagingServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.messaging.kafka.metadata.SSLManager")
    def test_init(self, mock_ssl_manager, test_connection):
        test_connection.return_value = True
        config = WorkflowSource(
            **{
                "type": "kafka",
                "serviceName": "local_kafka",
                "serviceConnection": {
                    "config": {
                        "type": "Kafka",
                        "bootstrapServers": "localhost:9092",
                    }
                },
                "sourceConfig": {"config": {"type": "MessagingMetadata"}},
            }
        )
        metadata = OpenMetadata(
            OpenMetadataConnection(
                hostPort="http://localhost:8585/api",
                authProvider="openmetadata",
                securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
            )
        )
        kafka_source = KafkaSource(config, metadata)

        self.assertIsNone(kafka_source.ssl_manager)
        mock_ssl_manager.assert_not_called()

        config_with_ssl = WorkflowSource(
            **{
                "type": "kafka",
                "serviceName": "local_kafka",
                "serviceConnection": {
                    "config": {
                        "type": "Kafka",
                        "bootstrapServers": "localhost:9092",
                        "schemaRegistrySSL": {
                            "caCertificate": "caCertificateData",
                            "sslKey": "sslKeyData",
                            "sslCertificate": "sslCertificateData",
                        },
                    },
                },
                "sourceConfig": {"config": {"type": "MessagingMetadata"}},
            }
        )
        kafka_source_with_ssl = KafkaSource(config_with_ssl, metadata)

        self.assertIsNotNone(kafka_source_with_ssl.ssl_manager)
        self.assertEqual(
            kafka_source_with_ssl.service_connection.schemaRegistrySSL.root.caCertificate.get_secret_value(),
            "caCertificateData",
        )
        self.assertEqual(
            kafka_source_with_ssl.service_connection.schemaRegistrySSL.root.sslKey.get_secret_value(),
            "sslKeyData",
        )
        self.assertEqual(
            kafka_source_with_ssl.service_connection.schemaRegistrySSL.root.sslCertificate.get_secret_value(),
            "sslCertificateData",
        )
