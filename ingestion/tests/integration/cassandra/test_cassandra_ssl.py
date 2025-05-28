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
from metadata.ingestion.source.database.cassandra.metadata import CassandraSource


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
