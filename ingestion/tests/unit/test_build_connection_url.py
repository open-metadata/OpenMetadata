import unittest
from unittest.mock import patch

from azure.core.credentials import AccessToken
from azure.identity import ClientSecretCredential

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    Authentication,
    AuthenticationMode,
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MysqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.azuresql.connection import get_connection_url
from metadata.ingestion.source.database.mysql.connection import MySQLConnection
from metadata.ingestion.source.database.postgres.connection import PostgresConnection
from metadata.utils.host_port_utils import clean_host_port


class TestGetConnectionURL(unittest.TestCase):
    def test_get_connection_url_wo_active_directory_password(self):
        connection = AzureSQLConnection(
            driver="SQL Server",
            hostPort="myserver.database.windows.net",
            database="mydb",
            username="myuser",
            password="mypassword",
            authenticationMode=AuthenticationMode(
                authentication=Authentication.ActiveDirectoryPassword,
                encrypt=True,
                trustServerCertificate=False,
                connectionTimeout=45,
            ),
        )
        expected_url = "mssql+pyodbc://?odbc_connect=Driver%3DSQL+Server%3BServer%3Dmyserver.database.windows.net%3BDatabase%3Dmydb%3BUid%3Dmyuser%3BPwd%3Dmypassword%3BEncrypt%3Dyes%3BTrustServerCertificate%3Dno%3BConnection+Timeout%3D45%3BAuthentication%3DActiveDirectoryPassword%3B"
        self.assertEqual(str(get_connection_url(connection)), expected_url)

        connection = AzureSQLConnection(
            driver="SQL Server",
            hostPort="myserver.database.windows.net",
            database="mydb",
            username="myuser",
            password="mypassword",
            authenticationMode=AuthenticationMode(
                authentication=Authentication.ActiveDirectoryPassword,
            ),
        )

        expected_url = "mssql+pyodbc://?odbc_connect=Driver%3DSQL+Server%3BServer%3Dmyserver.database.windows.net%3BDatabase%3Dmydb%3BUid%3Dmyuser%3BPwd%3Dmypassword%3BEncrypt%3Dno%3BTrustServerCertificate%3Dno%3BConnection+Timeout%3D30%3BAuthentication%3DActiveDirectoryPassword%3B"
        self.assertEqual(str(get_connection_url(connection)), expected_url)

    def test_get_connection_url_mysql(self):
        connection = MysqlConnectionConfig(
            username="openmetadata_user",
            authType=BasicAuth(password="openmetadata_password"),
            hostPort="localhost:3306",
            databaseSchema="openmetadata_db",
        )
        engine_connection = MySQLConnection(connection).client
        self.assertEqual(
            engine_connection.url.render_as_string(hide_password=False),
            "mysql+pymysql://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db",
        )
        connection = MysqlConnectionConfig(
            username="openmetadata_user",
            authType=AzureConfigurationSource(
                azureConfig=AzureCredentials(
                    clientId="clientid",
                    tenantId="tenantid",
                    clientSecret="clientsecret",
                    scopes="scope1,scope2",
                )
            ),
            hostPort="localhost:3306",
            databaseSchema="openmetadata_db",
        )
        with patch.object(
            ClientSecretCredential,
            "get_token",
            return_value=AccessToken(token="mocked_token", expires_on=100),
        ):
            engine_connection = MySQLConnection(connection).client
            self.assertEqual(
                engine_connection.url.render_as_string(hide_password=False),
                "mysql+pymysql://openmetadata_user:mocked_token@localhost:3306/openmetadata_db",
            )

    def test_get_connection_url_postgres(self):
        connection = PostgresConnectionConfig(
            username="openmetadata_user",
            authType=BasicAuth(password="openmetadata_password"),
            hostPort="localhost:3306",
            database="openmetadata_db",
        )
        engine_connection = PostgresConnection(connection).client
        self.assertEqual(
            engine_connection.url.render_as_string(hide_password=False),
            "postgresql+psycopg2://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db",
        )
        connection = PostgresConnectionConfig(
            username="openmetadata_user",
            authType=AzureConfigurationSource(
                azureConfig=AzureCredentials(
                    clientId="clientid",
                    tenantId="tenantid",
                    clientSecret="clientsecret",
                    scopes="scope1,scope2",
                )
            ),
            hostPort="localhost:3306",
            database="openmetadata_db",
        )
        with patch.object(
            ClientSecretCredential,
            "get_token",
            return_value=AccessToken(token="mocked_token", expires_on=100),
        ):
            engine_connection = PostgresConnection(connection).client
            self.assertEqual(
                engine_connection.url.render_as_string(hide_password=False),
                "postgresql+psycopg2://openmetadata_user:mocked_token@localhost:3306/openmetadata_db",
            )


class TestCleanHostPortInConnectionURL(unittest.TestCase):
    """
    Integration-style tests verifying that URL-prefixed hostPort values
    produce correct SQLAlchemy connection URLs.
    Issue #24348 — ValueError: invalid literal for int() with base 10.
    """

    def test_clean_host_port_used_in_mysql_url(self):
        """
        MySQL connection with http:// prefix in hostPort must produce
        a valid SQLAlchemy URL after clean_host_port() sanitisation.
        """
        raw = "http://localhost:3306"
        cleaned = clean_host_port(raw)
        self.assertEqual(cleaned, "localhost:3306")
        # Verify it contains no scheme
        self.assertNotIn("http://", cleaned)
        self.assertNotIn("://", cleaned)

    def test_clean_host_port_used_in_postgres_url(self):
        """
        Postgres connection with https:// prefix must be sanitised correctly.
        """
        raw = "https://mydb.example.com:5432"
        cleaned = clean_host_port(raw)
        self.assertEqual(cleaned, "mydb.example.com:5432")
        self.assertNotIn("https://", cleaned)
        self.assertNotIn("://", cleaned)

    def test_clean_host_port_no_change_for_valid_input(self):
        """
        Valid hostPort values must pass through clean_host_port() unchanged.
        """
        valid_inputs = [
            "localhost:3306",
            "mydb.example.com:5432",
            "192.168.1.1:1433",
            "localhost",
        ]
        for value in valid_inputs:
            with self.subTest(value=value):
                self.assertEqual(clean_host_port(value), value)

    def test_clean_host_port_raises_clear_error_for_bad_url(self):
        """
        Invalid URL with scheme but no hostname raises ValueError with
        a message that guides the user to the correct format.
        """
        with self.assertRaises(ValueError) as ctx:
            clean_host_port("http://")
        error_msg = str(ctx.exception)
        self.assertIn("no valid hostname", error_msg)
        self.assertIn("hostname", error_msg)
