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
        self.assertIsNotNone(
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.get(
                "ssl.ca.location"
            ),
        )
        self.assertIsNotNone(
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.get(
                "ssl.key.location"
            ),
        )
        self.assertIsNotNone(
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.get(
                "ssl.certificate.location"
            ),
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


class MssqlSSLManagerTest(TestCase):
    """
    Tests for MSSQL SSL Manager functionality
    """

    def test_check_ssl_and_init_with_ssl_config(self):
        """Test SSL manager initialization with sslConfig"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_with_ssl = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            encrypt=False,
            trustServerCertificate=False,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection_with_ssl)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)

        ssl_manager.cleanup_temp_files()

    def test_check_ssl_and_init_without_ssl_config(self):
        """Test SSL manager initialization without sslConfig"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_without_ssl = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            encrypt=True,
            trustServerCertificate=True,
        )

        ssl_manager = check_ssl_and_init(connection_without_ssl)

        self.assertIsNone(ssl_manager.ca_file_path)

    def test_setup_ssl_pyodbc_driver(self):
        """Test SSL setup for pyodbc driver"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
            MssqlScheme,
        )

        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pyodbc,
            encrypt=True,
            trustServerCertificate=False,
        )

        ssl_manager = SSLManager(
            ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key")
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(
            updated_connection.connectionArguments.root.get("Encrypt"), "yes"
        )
        self.assertIsNone(
            updated_connection.connectionArguments.root.get("TrustServerCertificate")
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pyodbc_with_trust_certificate(self):
        """Test SSL setup for pyodbc driver with trustServerCertificate"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
            MssqlScheme,
        )

        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pyodbc,
            encrypt=True,
            trustServerCertificate=True,
        )

        ssl_manager = SSLManager(
            ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key")
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(
            updated_connection.connectionArguments.root.get("Encrypt"), "yes"
        )
        self.assertEqual(
            updated_connection.connectionArguments.root.get("TrustServerCertificate"),
            "yes",
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pytds_driver(self):
        """Test SSL setup for pytds driver"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
            MssqlScheme,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pytds,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments.root["cafile"])

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pymssql_driver(self):
        """Test SSL setup for pymssql driver"""
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
            MssqlScheme,
        )

        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pymssql,
        )

        ssl_manager = SSLManager(
            ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key")
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertDictEqual(updated_connection.connectionArguments.root, {})

        ssl_manager.cleanup_temp_files()


class Db2SSLManagerTest(TestCase):
    """
    Tests for DB2 SSL Manager functionality
    """

    def test_check_ssl_and_init_with_ssl_config(self):
        """Test SSL manager initialization with sslConfig and sslMode"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_with_ssl = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.require,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection_with_ssl)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)

        ssl_manager.cleanup_temp_files()

    def test_check_ssl_and_init_with_all_certs(self):
        """Test SSL manager initialization with all certificates"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_with_ssl = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.require,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection_with_ssl)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)
        self.assertIsNotNone(ssl_manager.cert_file_path)
        self.assertIsNotNone(ssl_manager.key_file_path)

        ssl_manager.cleanup_temp_files()

    def test_check_ssl_and_init_without_ssl_mode(self):
        """Test SSL manager initialization without sslMode (disabled by default)"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_without_ssl = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
        )

        ssl_manager = check_ssl_and_init(connection_without_ssl)

        self.assertIsNone(ssl_manager)

    def test_check_ssl_and_init_with_disabled_ssl_mode(self):
        """Test SSL manager initialization with sslMode disabled"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_with_disabled_ssl = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.disable,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection_with_disabled_ssl)

        self.assertIsNone(ssl_manager)

    def test_check_ssl_and_init_with_ssl_mode_but_no_config(self):
        """Test SSL manager initialization with sslMode but no sslConfig"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection_with_ssl_mode_only = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.require,
        )

        ssl_manager = check_ssl_and_init(connection_with_ssl_mode_only)

        self.assertIsNone(ssl_manager)

    def test_setup_ssl_with_ca_certificate(self):
        """Test SSL setup with CA certificate only - params go to connectionOptions"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode

        connection = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.require,
        )

        ssl_manager = SSLManager(ca=SecretStr("CA cert"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionOptions)
        self.assertEqual(
            updated_connection.connectionOptions.root.get("SECURITY"), "SSL"
        )
        self.assertIsNotNone(
            updated_connection.connectionOptions.root.get("SSLServerCertificate")
        )
        self.assertIsNone(
            updated_connection.connectionOptions.root.get("SSLClientKeystoredb")
        )
        self.assertIsNone(
            updated_connection.connectionOptions.root.get("SSLClientKeystash")
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_with_all_certificates(self):
        """Test SSL setup with all certificates (mutual TLS) - params go to connectionOptions"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode

        connection = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.require,
        )

        ssl_manager = SSLManager(
            ca=SecretStr("CA cert"), cert=SecretStr("Client cert"), key=SecretStr("Key")
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionOptions)
        self.assertEqual(
            updated_connection.connectionOptions.root.get("SECURITY"), "SSL"
        )
        self.assertIsNotNone(
            updated_connection.connectionOptions.root.get("SSLServerCertificate")
        )
        self.assertIsNotNone(
            updated_connection.connectionOptions.root.get("SSLClientKeystoredb")
        )
        self.assertIsNotNone(
            updated_connection.connectionOptions.root.get("SSLClientKeystash")
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_with_disabled_mode(self):
        """Test SSL setup when sslMode is disabled - no SSL params added"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode

        connection = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.disable,
        )

        ssl_manager = SSLManager(ca=SecretStr("CA cert"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionOptions)
        self.assertIsNone(updated_connection.connectionOptions.root.get("SECURITY"))
        self.assertIsNone(
            updated_connection.connectionOptions.root.get("SSLServerCertificate")
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_verify_ca_mode(self):
        """Test SSL setup with verify-ca mode - params go to connectionOptions"""
        from metadata.generated.schema.entity.services.connections.database.db2Connection import (
            Db2Connection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = Db2Connection(
            hostPort="localhost:50000",
            database="testdb",
            username="db2inst1",
            password="password",
            sslMode=SslMode.verify_ca,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        self.assertIsNotNone(ssl_manager)

        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertEqual(
            updated_connection.connectionOptions.root.get("SECURITY"), "SSL"
        )
        self.assertIsNotNone(
            updated_connection.connectionOptions.root.get("SSLServerCertificate")
        )

        ssl_manager.cleanup_temp_files()
