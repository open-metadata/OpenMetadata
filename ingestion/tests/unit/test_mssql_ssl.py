"""
Test MSSQL SSL configuration
"""

from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
    MssqlScheme,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init


class MssqlSSLManagerTest(TestCase):
    """
    Tests for MSSQL SSL Manager functionality
    """

    def test_check_ssl_and_init_with_ssl_config(self):
        """Test SSL manager initialization with sslConfig"""
        connection_with_ssl = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            encrypt=True,
            trustServerCertificate=False,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslKey": "sslKeyData",
                "sslCertificate": "sslCertificateData",
            },
        )

        ssl_manager = check_ssl_and_init(connection_with_ssl)

        self.assertIsNotNone(ssl_manager)
        self.assertIsNotNone(ssl_manager.ca_file_path)
        self.assertIsNotNone(ssl_manager.key_file_path)
        self.assertIsNotNone(ssl_manager.cert_file_path)

        ssl_manager.cleanup_temp_files()

    def test_check_ssl_and_init_without_ssl_config(self):
        """Test SSL manager initialization without sslConfig"""
        connection_without_ssl = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            encrypt=True,
            trustServerCertificate=True,
        )

        ssl_manager = check_ssl_and_init(connection_without_ssl)

        self.assertIsNone(ssl_manager)

    def test_setup_ssl_pyodbc_driver(self):
        """Test SSL setup for pyodbc driver"""
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
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
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
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
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
        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pytds,
            encrypt=True,
        )

        ssl_manager = SSLManager(
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(
            updated_connection.connectionArguments.root.get("encryption"), "on"
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_pymssql_driver(self):
        """Test SSL setup for pymssql driver"""
        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pymssql,
            encrypt=True,
            trustServerCertificate=True,
        )

        ssl_manager = SSLManager(
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertEqual(
            updated_connection.connectionArguments.root.get("encrypt"), True
        )
        self.assertEqual(
            updated_connection.connectionArguments.root.get("trust_server_certificate"),
            True,
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_with_certificates(self):
        """Test SSL setup with certificate files"""
        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pyodbc,
            encrypt=True,
            sslConfig={
                "caCertificate": "caCertificateData",
                "sslKey": "sslKeyData",
                "sslCertificate": "sslCertificateData",
            },
        )

        ssl_manager = SSLManager(
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertIn("ssl", updated_connection.connectionArguments.root)
        self.assertIsNotNone(
            updated_connection.connectionArguments.root["ssl"].get("ssl_ca")
        )
        self.assertIsNotNone(
            updated_connection.connectionArguments.root["ssl"].get("ssl_cert")
        )
        self.assertIsNotNone(
            updated_connection.connectionArguments.root["ssl"].get("ssl_key")
        )

        ssl_manager.cleanup_temp_files()

    def test_setup_ssl_no_encryption(self):
        """Test that SSL is not configured when encrypt is False"""
        connection = MssqlConnection(
            hostPort="localhost:1433",
            database="testdb",
            username="sa",
            password="password",
            scheme=MssqlScheme.mssql_pyodbc,
            encrypt=False,
        )

        ssl_manager = SSLManager(
            ca=CustomSecretStr("CA cert"),
            cert=CustomSecretStr("Cert"),
            key=CustomSecretStr("Key"),
        )
        updated_connection = ssl_manager.setup_ssl(connection)

        self.assertIsNotNone(updated_connection.connectionArguments)
        self.assertIsNone(updated_connection.connectionArguments.root.get("Encrypt"))

        ssl_manager.cleanup_temp_files()
