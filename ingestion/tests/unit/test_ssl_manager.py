"""
Manage SSL test cases
"""

import os
from unittest import TestCase
from unittest.mock import patch

from pydantic import SecretStr

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
from metadata.ingestion.source.database.cassandra.metadata import CassandraSource
from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource
from metadata.utils.ssl_manager import SSLManager


class SSLManagerTest(TestCase):
    """
    Tests to verify the functionality of SSLManager
    """

    def setUp(self):
        self.ca = SecretStr("CA certificate content")
        self.key = SecretStr("Private key content")
        self.cert = SecretStr("Certificate content")
        self.ssl_manager = SSLManager(self.ca, self.key, self.cert)

    def tearDown(self):
        self.ssl_manager.cleanup_temp_files()

    def test_create_temp_file(self):
        content = SecretStr("Test content")
        temp_file = self.ssl_manager.create_temp_file(content)
        self.assertTrue(os.path.exists(temp_file))
        with open(temp_file, "r", encoding="UTF-8") as file:
            file_content = file.read()
        self.assertEqual(file_content, content.get_secret_value())
        content = SecretStr("")
        temp_file = self.ssl_manager.create_temp_file(content)
        self.assertTrue(os.path.exists(temp_file))
        with open(temp_file, "r", encoding="UTF-8") as file:
            file_content = file.read()
        self.assertEqual(file_content, content.get_secret_value())
        with self.assertRaises(AttributeError):
            content = None
            self.ssl_manager.create_temp_file(content)

    def test_cleanup_temp_files(self):
        temp_file = self.ssl_manager.create_temp_file(SecretStr("Test content"))
        self.ssl_manager.cleanup_temp_files()
        self.assertFalse(os.path.exists(temp_file))


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


class CassandraSourceSSLTest(TestCase):
    @patch("metadata.utils.ssl_manager.SSLManager.setup_ssl")
    @patch(
        "metadata.ingestion.source.database.cassandra.metadata.CassandraSource.test_connection"
    )
    @patch("metadata.ingestion.source.database.cassandra.connection.get_connection")
    def test_init(self, get_connection, test_connection, setup_ssl):
        get_connection.return_value = True
        test_connection.return_value = True
        setup_ssl.side_effect = lambda x: x

        config = WorkflowSource(
            **{
                "type": "cassandra",
                "serviceName": "local_cassandra",
                "serviceConnection": {
                    "config": {
                        "type": "Cassandra",
                        "hostPort": "localhost:9042",
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            }
        )
        metadata = OpenMetadata(
            OpenMetadataConnection(
                hostPort="http://localhost:8585/api",
                authProvider="openmetadata",
                securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
            )
        )
        cassandra_source = CassandraSource(config, metadata)
        self.assertIsNone(cassandra_source.ssl_manager)

        config_with_ssl = WorkflowSource(
            **{
                "type": "cassandra",
                "serviceName": "local_cassandra",
                "serviceConnection": {
                    "config": {
                        "type": "Cassandra",
                        "hostPort": "localhost:9042",
                        "sslConfig": {
                            "caCertificate": "caCertificateData",
                            "sslKey": "sslKeyData",
                            "sslCertificate": "sslCertificateData",
                        },
                        "sslMode": "allow",
                    },
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            }
        )
        cassandra_source_with_ssl = CassandraSource(config_with_ssl, metadata)

        self.assertIsNotNone(cassandra_source_with_ssl.ssl_manager)
        self.assertEqual(
            cassandra_source_with_ssl.service_connection.sslConfig.root.caCertificate.get_secret_value(),
            "caCertificateData",
        )
        self.assertEqual(
            cassandra_source_with_ssl.service_connection.sslConfig.root.sslKey.get_secret_value(),
            "sslKeyData",
        )
        self.assertEqual(
            cassandra_source_with_ssl.service_connection.sslConfig.root.sslCertificate.get_secret_value(),
            "sslCertificateData",
        )
