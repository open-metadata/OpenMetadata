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
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.azuresql.connection import get_connection_url
from metadata.ingestion.source.database.mysql.connection import MySQLConnection
from metadata.ingestion.source.database.postgres.connection import (
    get_connection as postgres_get_connection,
)


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
        connection = MysqlConnection(
            username="openmetadata_user",
            authType=BasicAuth(password="openmetadata_password"),
            hostPort="localhost:3306",
            databaseSchema="openmetadata_db",
        )
        engine_connection = MySQLConnection(connection).client
        self.assertEqual(
            str(engine_connection.url),
            "mysql+pymysql://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db",
        )
        connection = MysqlConnection(
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
                str(engine_connection.url),
                "mysql+pymysql://openmetadata_user:mocked_token@localhost:3306/openmetadata_db",
            )

    def test_get_connection_url_postgres(self):
        connection = PostgresConnection(
            username="openmetadata_user",
            authType=BasicAuth(password="openmetadata_password"),
            hostPort="localhost:3306",
            database="openmetadata_db",
        )
        engine_connection = postgres_get_connection(connection)
        self.assertEqual(
            str(engine_connection.url),
            "postgresql+psycopg2://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db",
        )
        connection = PostgresConnection(
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
            engine_connection = postgres_get_connection(connection)
            self.assertEqual(
                str(engine_connection.url),
                "postgresql+psycopg2://openmetadata_user:mocked_token@localhost:3306/openmetadata_db",
            )
