"""
Manage SSL test cases
"""

import os
from unittest import TestCase
from unittest.mock import patch

import pytest
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
        self.assertTrue(os.path.exists(temp_file))  # noqa: PTH110
        with open(temp_file, "r", encoding="UTF-8") as file:  # noqa: PTH123
            file_content = file.read()
        self.assertEqual(file_content, content.get_secret_value())
        content = SecretStr("")
        temp_file = self.ssl_manager.create_temp_file(content)
        self.assertTrue(os.path.exists(temp_file))  # noqa: PTH110
        with open(temp_file, "r", encoding="UTF-8") as file:  # noqa: PTH123
            file_content = file.read()
        self.assertEqual(file_content, content.get_secret_value())
        with self.assertRaises(AttributeError):
            content = None
            self.ssl_manager.create_temp_file(content)

    def test_cleanup_temp_files(self):
        temp_file = self.ssl_manager.create_temp_file(SecretStr("Test content"))
        self.ssl_manager.cleanup_temp_files()
        self.assertFalse(os.path.exists(temp_file))  # noqa: PTH110


class KafkaSourceSSLTest(TestCase):
    # Building a KafkaSource runs get_connection for real; without these the test
    # spins up librdkafka clients that background-dial localhost:9092.
    @patch("metadata.ingestion.source.messaging.kafka.connection.Consumer")
    @patch("metadata.ingestion.source.messaging.kafka.connection.AdminClient")
    @patch("metadata.ingestion.source.messaging.messaging_service.MessagingServiceSource.test_connection")
    @patch("metadata.ingestion.source.messaging.kafka.metadata.SSLManager")
    def test_init(self, mock_ssl_manager, test_connection, _admin_client, _consumer):
        test_connection.return_value = True
        config = WorkflowSource(
            **{  # noqa: PIE804
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
            **{  # noqa: PIE804
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
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.model_extra.get("ssl.ca.location"),
        )
        self.assertIsNotNone(
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.model_extra.get("ssl.key.location"),
        )
        self.assertIsNotNone(
            kafka_source_with_ssl.service_connection.schemaRegistryConfig.model_extra.get("ssl.certificate.location"),
        )


class CassandraSourceSSLTest(TestCase):
    @patch("metadata.utils.ssl_manager.SSLManager.setup_ssl")
    @patch("metadata.ingestion.source.database.cassandra.metadata.CassandraSource.test_connection")
    @patch("metadata.ingestion.source.database.cassandra.connection.CassandraConnection._get_client")
    def test_init(self, get_client, test_connection, setup_ssl):
        get_client.return_value = True
        test_connection.return_value = True
        setup_ssl.side_effect = lambda x: x

        config = WorkflowSource(
            **{  # noqa: PIE804
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
            **{  # noqa: PIE804
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


class MatillionSSLManagerTest(TestCase):
    """
    Tests for Matillion SSL Manager with DPC auth variant (no sslConfig)
    """

    def test_check_ssl_and_init_dpc_connection_returns_none(self):
        from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
            MatillionConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MatillionConnection(
            connection={
                "type": "MatillionDPC",
                "clientId": "test-client",
                "clientSecret": "test-secret",
                "region": "us1",
            }
        )

        result = check_ssl_and_init(connection)

        self.assertIsNone(result)

    def test_setup_ssl_dpc_connection_returns_connection_unchanged(self):
        from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
            MatillionConnection,
        )

        connection = MatillionConnection(
            connection={
                "type": "MatillionDPC",
                "clientId": "test-client",
                "clientSecret": "test-secret",
                "region": "us1",
            }
        )

        ssl_manager = SSLManager()
        result = ssl_manager.setup_ssl(connection)

        self.assertIs(result, connection)

    def test_check_ssl_and_init_etl_connection_with_ssl(self):
        from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
            MatillionConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MatillionConnection(
            connection={
                "type": "MatillionETL",
                "hostPort": "https://matillion.example.com",
                "username": "admin",
                "password": "password",
                "sslConfig": {"caCertificate": "caCertificateData"},
            }
        )

        ssl_manager = check_ssl_and_init(connection)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)

        ssl_manager.cleanup_temp_files()

    def test_check_ssl_and_init_etl_connection_without_ssl(self):
        from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
            MatillionConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MatillionConnection(
            connection={
                "type": "MatillionETL",
                "hostPort": "https://matillion.example.com",
                "username": "admin",
                "password": "password",
            }
        )

        result = check_ssl_and_init(connection)

        self.assertIsNone(result)

    def test_check_ssl_and_init_no_connection_returns_none(self):
        from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
            MatillionConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MatillionConnection()

        result = check_ssl_and_init(connection)

        self.assertIsNone(result)


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

        ssl_manager = SSLManager(ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(updated_connection.connectionArguments.root.get("Encrypt"), "yes")
        self.assertIsNone(updated_connection.connectionArguments.root.get("TrustServerCertificate"))

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

        ssl_manager = SSLManager(ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(updated_connection.connectionArguments.root.get("Encrypt"), "yes")
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

    def test_setup_ssl_pytds_client_cert(self):
        """Test SSL setup for pytds driver with mutual TLS (all three certs)"""
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
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertIsNotNone(args.get("cafile"))
        self.assertIsNotNone(args.get("certfile"))
        self.assertIsNotNone(args.get("keyfile"))

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

        ssl_manager = SSLManager(ca=SecretStr("CA cert"), cert=SecretStr("Cert"), key=SecretStr("Key"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertDictEqual(updated_connection.connectionArguments.root, {})

        ssl_manager.cleanup_temp_files()

    def _pytds_connection(self, **kwargs):
        from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
            MssqlConnection,
            MssqlScheme,
        )

        return MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pytds,
            **kwargs,
        )

    def test_setup_ssl_pytds_trust_server_certificate_drops_host_validation(self):
        """pytds always verifies the chain against the CA it is given, so host
        validation is the only check trustServerCertificate can drop."""
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = self._pytds_connection(
            trustServerCertificate=True,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIs(updated_connection.connectionArguments.root["validate_host"], False)

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pytds_keeps_host_validation_by_default(self):
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = self._pytds_connection(sslConfig={"caCertificate": "caCertificateData"})

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertNotIn("validate_host", updated_connection.connectionArguments.root)

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pytds_encrypt_without_a_ca_certificate_warns(self):
        """pytds enables TLS only when a CA certificate is supplied. Encrypt on its
        own cannot be honoured, and the connection must not claim otherwise."""
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = self._pytds_connection(encrypt=True)

        ssl_manager = check_ssl_and_init(connection)
        with patch("metadata.utils.ssl_manager.logger") as mock_logger:
            updated_connection = ssl_manager.setup_ssl(connection)

        self.assertNotIn("cafile", updated_connection.connectionArguments.root)
        mock_logger.warning.assert_called_once()
        self.assertIn("will NOT be encrypted", mock_logger.warning.call_args.args[0])

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pytds_encrypt_with_a_ca_certificate_is_silent(self):
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = self._pytds_connection(encrypt=True, sslConfig={"caCertificate": "caCertificateData"})

        ssl_manager = check_ssl_and_init(connection)
        with patch("metadata.utils.ssl_manager.logger") as mock_logger:
            updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments.root["cafile"])
        mock_logger.warning.assert_not_called()

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pymssql_warns_that_tls_settings_are_inert(self):
        """pymssql takes no TLS parameters: FreeTDS configuration decides."""
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
            scheme=MssqlScheme.mssql_pymssql,
            encrypt=True,
        )

        ssl_manager = check_ssl_and_init(connection)
        with patch("metadata.utils.ssl_manager.logger") as mock_logger:
            updated_connection = ssl_manager.setup_ssl(connection)

        self.assertDictEqual(updated_connection.connectionArguments.root, {})
        mock_logger.warning.assert_called_once()
        self.assertIn("mssql+pymssql", mock_logger.warning.call_args.args[0])

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
        self.assertEqual(updated_connection.connectionOptions.root.get("SECURITY"), "SSL")
        self.assertIsNotNone(updated_connection.connectionOptions.root.get("SSLServerCertificate"))
        self.assertIsNone(updated_connection.connectionOptions.root.get("SSLClientKeystoredb"))
        self.assertIsNone(updated_connection.connectionOptions.root.get("SSLClientKeystash"))

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

        ssl_manager = SSLManager(ca=SecretStr("CA cert"), cert=SecretStr("Client cert"), key=SecretStr("Key"))
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionOptions)
        self.assertEqual(updated_connection.connectionOptions.root.get("SECURITY"), "SSL")
        self.assertIsNotNone(updated_connection.connectionOptions.root.get("SSLServerCertificate"))
        self.assertIsNotNone(updated_connection.connectionOptions.root.get("SSLClientKeystoredb"))
        self.assertIsNotNone(updated_connection.connectionOptions.root.get("SSLClientKeystash"))

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
        self.assertIsNone(updated_connection.connectionOptions.root.get("SSLServerCertificate"))

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

        self.assertEqual(updated_connection.connectionOptions.root.get("SECURITY"), "SSL")
        self.assertIsNotNone(updated_connection.connectionOptions.root.get("SSLServerCertificate"))

        ssl_manager.cleanup_temp_files()


class PostgresSSLManagerTest(TestCase):
    """
    Tests for PostgreSQL SSL Manager functionality — including mutual TLS.
    """

    def test_check_ssl_and_init_all_three_fields(self):
        """All three SSL fields are extracted into SSLManager"""
        from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
            PostgresConnection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = PostgresConnection(
            hostPort="localhost:5432",
            database="testdb",
            username="postgres",
            sslMode=SslMode.verify_ca,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)
        self.assertIsNotNone(ssl_manager.cert_file_path)
        self.assertIsNotNone(ssl_manager.key_file_path)

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_mutual_tls_sets_all_psycopg2_params(self):
        """setup_ssl sets sslrootcert, sslcert, and sslkey in connectionArguments"""
        from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
            PostgresConnection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = PostgresConnection(
            hostPort="localhost:5432",
            database="testdb",
            username="postgres",
            sslMode=SslMode.verify_ca,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertEqual(args.get("sslmode"), "verify-ca")
        self.assertIsNotNone(args.get("sslrootcert"))
        self.assertIsNotNone(args.get("sslcert"))
        self.assertIsNotNone(args.get("sslkey"))

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_ca_only_verify_ca(self):
        """Existing behaviour: CA-only verify-ca sets sslrootcert but not sslcert/sslkey"""
        from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
            PostgresConnection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = PostgresConnection(
            hostPort="localhost:5432",
            database="testdb",
            username="postgres",
            sslMode=SslMode.verify_ca,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertEqual(args.get("sslmode"), "verify-ca")
        self.assertIsNotNone(args.get("sslrootcert"))
        self.assertIsNone(args.get("sslcert"))
        self.assertIsNone(args.get("sslkey"))

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_require_mode_no_ca(self):
        """sslmode=require without CA does not set sslrootcert"""
        from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
            PostgresConnection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = PostgresConnection(
            hostPort="localhost:5432",
            database="testdb",
            username="postgres",
            sslMode=SslMode.require,
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertEqual(args.get("sslmode"), "require")
        self.assertIsNone(args.get("sslrootcert"))
        self.assertIsNone(args.get("sslcert"))
        self.assertIsNone(args.get("sslkey"))

        ssl_manager.cleanup_temp_files()

    def test_redshift_mutual_tls_sets_all_psycopg2_params(self):
        """RedshiftConnection shares the handler — mutual TLS params are set"""
        from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
            RedshiftConnection,
        )
        from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = RedshiftConnection(
            hostPort="localhost:5439",
            database="testdb",
            username="redshift",
            sslMode=SslMode.verify_ca,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertEqual(args.get("sslmode"), "verify-ca")
        self.assertIsNotNone(args.get("sslrootcert"))
        self.assertIsNotNone(args.get("sslcert"))
        self.assertIsNotNone(args.get("sslkey"))

        ssl_manager.cleanup_temp_files()


class HiveSSLManagerTest(TestCase):
    """
    Tests that setup_ssl for HiveConnection produces the kwarg names
    that CustomHiveConnection expects (ssl_certfile, ssl_keyfile, ssl_ca_certs).
    """

    def test_setup_ssl_sets_custom_hive_connection_kwargs(self):
        """ssl_ca_certs / ssl_certfile / ssl_keyfile are set at the top level"""
        from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
            HiveConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = HiveConnection(
            hostPort="localhost:10000",
            useSSL=True,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslCertificate": "sslCertificateData",
                "sslKey": "sslKeyData",
            },
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertIsNotNone(args.get("ssl_ca_certs"))
        self.assertIsNotNone(args.get("ssl_certfile"))
        self.assertIsNotNone(args.get("ssl_keyfile"))
        # Must not fall back to the old MySQL-style nested dict
        self.assertNotIn("ssl", args)

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_ca_only(self):
        """CA-only config sets ssl_ca_certs but not ssl_certfile or ssl_keyfile"""
        from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
            HiveConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = HiveConnection(
            hostPort="localhost:10000",
            useSSL=True,
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)

        args = updated_connection.connectionArguments.root
        self.assertIsNotNone(args.get("ssl_ca_certs"))
        self.assertIsNone(args.get("ssl_certfile"))
        self.assertIsNone(args.get("ssl_keyfile"))
        ssl_manager.cleanup_temp_files()


class MysqlSSLManagerTest(TestCase):
    """
    Tests that setup_ssl for MysqlConnection, DorisConnection, and StarRocksConnection
    uses the PyMySQL ssl dict keys (ca, cert, key) so PyMySQL verifies server certificates.
    """

    def test_setup_ssl_sets_pymysql_ssl_dict_keys(self):
        """MySQL, Doris, and StarRocks populate ssl={'ca': ..., 'cert': ..., 'key': ...}"""
        from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
            DorisConnection,
        )
        from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
            MysqlConnection,
        )
        from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
            StarRocksConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        for connection_cls in (MysqlConnection, DorisConnection, StarRocksConnection):
            with self.subTest(connection_cls=connection_cls.__name__):
                connection = connection_cls(
                    hostPort="localhost:3306",
                    username="user",
                    sslConfig={
                        "caCertificate": "caCertificateData",
                        "sslCertificate": "sslCertificateData",
                        "sslKey": "sslKeyData",
                    },
                )

                ssl_manager = check_ssl_and_init(connection)
                updated_connection = ssl_manager.setup_ssl(connection)

                ssl_args = updated_connection.connectionArguments.root.get("ssl", {})
                self.assertEqual(ssl_args.get("ca"), ssl_manager.ca_file_path)
                self.assertEqual(ssl_args.get("cert"), ssl_manager.cert_file_path)
                self.assertEqual(ssl_args.get("key"), ssl_manager.key_file_path)
                self.assertNotIn("ssl_ca", ssl_args)
                self.assertNotIn("ssl_cert", ssl_args)
                self.assertNotIn("ssl_key", ssl_args)

                ssl_manager.cleanup_temp_files()

    def test_setup_ssl_ca_only_enables_pymysql_verification(self):
        """CA-only config passes 'ca' in the ssl dict so PyMySQL enables CERT_REQUIRED"""
        import ssl

        from pymysql.connections import Connection

        from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
            MysqlConnection,
        )
        from metadata.utils.ssl_manager import check_ssl_and_init

        connection = MysqlConnection(
            hostPort="localhost:3306",
            username="user",
            sslConfig={"caCertificate": "caCertificateData"},
        )

        ssl_manager = check_ssl_and_init(connection)
        updated_connection = ssl_manager.setup_ssl(connection)
        ssl_args = updated_connection.connectionArguments.root["ssl"]

        self.assertEqual(ssl_args, {"ca": ssl_manager.ca_file_path})
        with patch.object(ssl.SSLContext, "load_verify_locations") as mock_load_verify:
            ctx = Connection._create_ssl_ctx(None, ssl_args)
            mock_load_verify.assert_called_once_with(ssl_manager.ca_file_path, None, None)
        self.assertEqual(ctx.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(ctx.check_hostname)

        ssl_manager.cleanup_temp_files()


@pytest.mark.parametrize("connection_type", ["mysql", "doris", "starrocks"])
@pytest.mark.parametrize("use_top_level_client_cert", [False, True])
def test_pymysql_uses_configured_ca_with_top_level_ssl_options(connection_type, use_top_level_client_cert):
    import ssl

    from pymysql.connections import Connection

    from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
        DorisConnection,
    )
    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
        StarRocksConnection,
    )
    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.utils.ssl_manager import check_ssl_and_init

    connection_cls = {"mysql": MysqlConnection, "doris": DorisConnection, "starrocks": StarRocksConnection}[
        connection_type
    ]
    arguments = {"ssl_verify_cert": True, "ssl_verify_identity": True, "connect_timeout": 5}
    if use_top_level_client_cert:
        arguments.update({"ssl_cert": "client.pem", "ssl_key": "client.key", "ssl_key_password": "password"})
    connection = connection_cls(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        updated = manager.setup_ssl(connection)
        with (
            patch.object(ssl.SSLContext, "load_verify_locations") as load_ca,
            patch.object(ssl.SSLContext, "load_cert_chain") as load_client,
        ):
            client = Connection(
                host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated)
            )

        load_ca.assert_called_once_with(manager.ca_file_path, None, None)
        assert client.ctx.verify_mode == ssl.CERT_REQUIRED
        assert client.ctx.check_hostname
        assert client.connect_timeout == 5
        if use_top_level_client_cert:
            load_client.assert_called_once_with("client.pem", keyfile="client.key", password="password")
        else:
            load_client.assert_not_called()
    finally:
        manager.cleanup_temp_files()


def test_pymysql_loads_configured_ca_when_verification_options_are_top_level():
    from datetime import datetime, timedelta, timezone

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    from pymysql.connections import Connection

    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.utils.ssl_manager import check_ssl_and_init

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "OpenMetadata Test CA")])
    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": certificate.public_bytes(serialization.Encoding.PEM).decode()},
        connectionArguments={"ssl_verify_cert": True, "ssl_verify_identity": True},
    )
    manager = check_ssl_and_init(connection)
    try:
        updated = manager.setup_ssl(connection)
        client = Connection(host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated))
        assert certificate.public_bytes(serialization.Encoding.DER) in client.ctx.get_ca_certs(binary_form=True)
        assert client.ctx.check_hostname
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize(
    ("arguments", "verify", "hostname", "override_ca"),
    [
        ({"ssl_verify_cert": False}, True, True, False),
        ({"ssl_verify_cert": True}, True, False, False),
        ({"ssl_verify_cert": "false"}, False, False, False),
        ({"ssl_cert": "client.pem", "ssl_verify_cert": False}, False, False, False),
        ({"ssl_ca": "override.pem", "ssl_verify_cert": True, "ssl_verify_identity": True}, True, True, True),
    ],
)
def test_pymysql_preserves_explicit_ssl_options(arguments, verify, hostname, override_ca):
    import ssl

    from pymysql.connections import Connection

    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.utils.ssl_manager import check_ssl_and_init

    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        updated = manager.setup_ssl(connection)
        with (
            patch.object(ssl.SSLContext, "load_verify_locations") as load_ca,
            patch.object(ssl.SSLContext, "load_cert_chain"),
        ):
            client = Connection(
                host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated)
            )
        load_ca.assert_called_once_with("override.pem" if override_ca else manager.ca_file_path, None, None)
        assert client.ctx.verify_mode == (ssl.CERT_REQUIRED if verify else ssl.CERT_NONE)
        assert client.ctx.check_hostname is hostname
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("connection_type", ["mysql", "doris", "starrocks"])
def test_ssl_setup_preserves_overrides_when_input_is_reused(connection_type):
    from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
        DorisConnection,
    )
    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
        StarRocksConnection,
    )
    from metadata.utils.ssl_manager import check_ssl_and_init

    connection_cls = {"mysql": MysqlConnection, "doris": DorisConnection, "starrocks": StarRocksConnection}[
        connection_type
    ]
    arguments = {
        "ssl": {"check_hostname": False},
        "ssl_ca": "override.pem",
        "ssl_cert": "override-cert.pem",
        "ssl_key": "override-key.pem",
    }
    connection = connection_cls(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData", "sslCertificate": "certData", "sslKey": "keyData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        first = manager.setup_ssl(connection)
        second = manager.setup_ssl(connection)
        expected = {
            "check_hostname": False,
            "ca": "override.pem",
            "cert": "override-cert.pem",
            "key": "override-key.pem",
        }
        assert first.connectionArguments.root["ssl"] == expected
        assert second.connectionArguments.root["ssl"] == expected
        assert connection.connectionArguments.root == arguments
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("use_top_level_client_cert", [False, True])
def test_pymysql_resolves_top_level_key_password_before_nesting(use_top_level_client_cert):
    import ssl

    from pymysql.connections import Connection

    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
    from metadata.utils.ssl_manager import check_ssl_and_init

    ssl_config = {"caCertificate": "caCertificateData"}
    arguments = {"ssl_key_password": "secret:dbkey"}
    if use_top_level_client_cert:
        arguments.update({"ssl_cert": "client.pem", "ssl_key": "client.key"})
    else:
        ssl_config.update({"sslCertificate": "sslCertificateData", "sslKey": "sslKeyData"})
    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig=ssl_config,
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        with (
            patch.object(SecretsManagerFactory, "get_secrets_manager") as get_secrets_manager,
            patch.object(ssl.SSLContext, "load_verify_locations"),
            patch.object(ssl.SSLContext, "load_cert_chain") as load_client,
        ):
            get_secrets_manager.return_value.get_string_value.return_value = "resolved-password"
            updated = manager.setup_ssl(connection)
            Connection(host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated))
        load_client.assert_called_once_with(
            "client.pem" if use_top_level_client_cert else manager.cert_file_path,
            keyfile="client.key" if use_top_level_client_cert else manager.key_file_path,
            password="resolved-password",
        )
    finally:
        manager.cleanup_temp_files()


def test_ssl_setup_does_not_resolve_unrelated_connection_secrets_twice():
    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
    from metadata.utils.ssl_manager import check_ssl_and_init

    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments={"ssl_verify_cert": True, "init_command": "secret:statement"},
    )
    manager = check_ssl_and_init(connection)
    try:
        with patch.object(SecretsManagerFactory, "get_secrets_manager") as get_secrets_manager:
            get_secrets_manager.return_value.get_string_value.side_effect = {
                "statement": "secret:literal",
                "literal": "wrong value",
            }.get
            updated = manager.setup_ssl(connection)
            assert get_connection_args_common(updated)["init_command"] == "secret:literal"
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("connection_type", ["Doris", "StarRocks"])
def test_mysql_family_source_initializes_ssl_once(connection_type):
    import ssl
    from pathlib import Path

    from pymysql.connections import Connection
    from sqlalchemy import create_engine

    from metadata.ingestion.connections.builders import get_connection_args_common
    from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
    from metadata.ingestion.source.database.doris.metadata import DorisSource
    from metadata.ingestion.source.database.starrocks.metadata import StarRocksSource
    from metadata.utils.secure_tempfile import remove_secret_temp_file, write_secret_temp_file

    source_cls = {"Doris": DorisSource, "StarRocks": StarRocksSource}[connection_type]
    config = WorkflowSource.model_validate(
        {
            "type": connection_type.lower(),
            "serviceName": "test",
            "serviceConnection": {
                "config": {
                    "type": connection_type,
                    "hostPort": "localhost:3306",
                    "username": "user",
                    "sslConfig": {"caCertificate": "caCertificateData"},
                    "connectionArguments": {"ssl_ca": "override.pem", "ssl_verify_cert": True},
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }
    )
    created_paths = []

    def create_temp_file(content):
        path = write_secret_temp_file(content)
        created_paths.append(path)
        return path

    source = None
    try:
        with (
            patch("metadata.utils.ssl_manager.write_secret_temp_file", side_effect=create_temp_file),
            patch("metadata.ingestion.source.database.common_db_source.create_connection", return_value=None),
            patch(
                "metadata.ingestion.source.database.common_db_source.get_connection",
                return_value=create_engine("sqlite://"),
            ),
            patch.object(CommonDbSourceService, "test_connection"),
        ):
            source = source_cls(config, None)
        assert len(created_paths) == 1
        assert Path(created_paths[0]).exists()
        with patch.object(ssl.SSLContext, "load_verify_locations") as load_ca:
            client = Connection(
                host="localhost",
                user="user",
                defer_connect=True,
                **get_connection_args_common(source.service_connection),
            )
        load_ca.assert_called_once_with("override.pem", None, None)
        assert client.ctx.verify_mode == ssl.CERT_REQUIRED
        source.close()
        source = None
        assert not Path(created_paths[0]).exists()
    finally:
        if source:
            source.close()
        for path in created_paths:
            remove_secret_temp_file(path)
