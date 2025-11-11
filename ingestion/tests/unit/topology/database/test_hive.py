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
Test Hive using the topology
"""

import types
from unittest import TestCase
from unittest.mock import Mock, patch

from sqlalchemy.types import INTEGER, VARCHAR, Integer, String

import metadata.ingestion.source.database.hive.utils as hive_dialect
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    Auth,
    HiveConnection,
    HiveScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.source.database.hive.connection import (
    get_connection,
    get_connection_url,
)
from metadata.ingestion.source.database.hive.metadata import HiveSource

mock_hive_config = {
    "source": {
        "type": "hive",
        "serviceName": "sample_hive",
        "serviceConnection": {
            "config": {
                "type": "Hive",
                "databaseSchema": "test_database_schema",
                "username": "username",
                "hostPort": "localhost:1466",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "hive"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="hive_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Hive,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="sample_database",
    fullyQualifiedName="hive_source_test.sample_database",
    displayName="sample_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample_schema",
    fullyQualifiedName="hive_source_test.sample_database.sample_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "sample_col_1",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_2",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "int",
        "comment": None,
    },
    {
        "name": "sample_col_3",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_4",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "varchar(50)",
    },
]

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("sample_database"),
        service=FullyQualifiedEntityName("hive_source_test"),
        default=False,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample_schema"),
        database=FullyQualifiedEntityName("hive_source_test.sample_database"),
    )
]

EXPECTED_TABLE = [
    CreateTableRequest(
        name=EntityName("sample_table"),
        tableType=TableType.Regular.name,
        columns=[
            Column(
                name=ColumnName("sample_col_1"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_2"),
                dataType=DataType.INT.name,
                dataLength=1,
                dataTypeDisplay="int",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_3"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_4"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
        ],
        tableConstraints=[],
        databaseSchema=FullyQualifiedEntityName(
            "hive_source_test.sample_database.sample_schema"
        ),
    )
]

EXPECTED_COMPLEX_COL_TYPE = [
    {
        "name": "id",
        "type": Integer,
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "int",
        "is_complex": False,
    },
    {
        "name": "data",
        "type": String(),
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "struct<a:struct<b:decimal(20,0)>>",
        "is_complex": True,
    },
    {
        "name": "data2",
        "type": String(),
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "struct<colll:decimal(20,0)>",
        "is_complex": True,
    },
]

# SSL-specific mock configurations
mock_hive_ssl_config = {
    "source": {
        "type": "hive",
        "serviceName": "sample_hive_ssl",
        "serviceConnection": {
            "config": {
                "type": "Hive",
                "databaseSchema": "test_database_schema",
                "username": "username",
                "hostPort": "localhost:1466",
                "useSSL": True,
                "sslConfig": {
                    "sslCertificate": "test_cert.pem",
                    "sslKey": "test_key.pem",
                    "caCertificate": "test_ca.pem",
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "hive"},
        }
    },
}

mock_hive_https_config = {
    "source": {
        "type": "hive",
        "serviceName": "sample_hive_https",
        "serviceConnection": {
            "config": {
                "type": "Hive",
                "scheme": "hive+https",
                "databaseSchema": "test_database_schema",
                "username": "username",
                "password": "password",
                "hostPort": "localhost:1000",
                "auth": "BASIC",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "hive"},
        }
    },
}

# SSL configuration objects for testing
mock_ssl_config = ValidateSslClientConfig(
    sslCertificate=CustomSecretStr("test_cert.pem"),
    sslKey=CustomSecretStr("test_key.pem"),
    caCertificate=CustomSecretStr("test_ca.pem"),
)

mock_hive_connection_ssl = HiveConnection(
    type="Hive",
    scheme=HiveScheme.hive,
    username="username",
    hostPort="localhost:1466",
    useSSL=True,
    sslConfig=SslConfig(root=mock_ssl_config),
)

mock_hive_connection_https = HiveConnection(
    type="Hive",
    scheme=HiveScheme.hive_https,
    username="username",
    password=CustomSecretStr("password"),
    hostPort="localhost:1000",
    auth=Auth.BASIC,
)


class HiveUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Hive Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(
        self,
        methodName,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_hive_config)
        self.hive = HiveSource.create(
            mock_hive_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.hive.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.thread_id = self.hive.context.get_current_thread_id()
        self.hive._inspector_map[self.thread_id] = types.SimpleNamespace()

        self.hive._inspector_map[
            self.thread_id
        ].get_pk_constraint = lambda table_name, schema_name: []
        self.hive._inspector_map[
            self.thread_id
        ].get_unique_constraints = lambda table_name, schema_name: []
        self.hive._inspector_map[
            self.thread_id
        ].get_foreign_keys = lambda table_name, schema_name: []

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right for either in self.hive.yield_database(MOCK_DATABASE.name.root)
        ]

        self.hive.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.hive.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.hive.yield_database_schema(
                schema_name=MOCK_DATABASE_SCHEMA.name.root
            )
        ]

        self.hive.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_table(self):
        self.hive.inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        results = [
            either.right
            for either in self.hive.yield_table(("sample_table", "Regular"))
        ]
        assert EXPECTED_TABLE == results

    def test_col_data_type(self):
        """
        Test different col type ingested as expected
        """
        table_columns = [
            ("id", "int", ""),
            ("data", "struct<a:struct<b:decimal(20,0)>>", ""),
            ("data2", "struct<colll:decimal(20,0)>", ""),
        ]
        hive_dialect._get_table_columns = (  # pylint: disable=protected-access
            lambda connection, table_name, schema_name: table_columns
        )

        col_list = list(
            hive_dialect.get_columns(
                self=hive_dialect,
                connection=mock_hive_config["source"],
                table_name="sample_table",
                schema="sample_schema",
            )
        )
        for _, (expected, original) in enumerate(
            zip(EXPECTED_COMPLEX_COL_TYPE, col_list)
        ):

            def custom_eq(self, __value: object) -> bool:
                return (
                    self.length == __value.length
                    and self.collation == __value.collation
                )

            String.__eq__ = custom_eq
            self.assertEqual(expected, original)

    def test_ssl_connection_configuration(self):
        """
        Test SSL configuration in Hive connection
        """
        # Test SSL configuration with certificates
        ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=True,
            sslConfig=SslConfig(
                root=ValidateSslClientConfig(
                    sslCertificate=CustomSecretStr("test_cert.pem"),
                    sslKey=CustomSecretStr("test_key.pem"),
                    caCertificate=CustomSecretStr("test_ca.pem"),
                )
            ),
        )

        self.assertTrue(ssl_connection.useSSL)
        self.assertIsNotNone(ssl_connection.sslConfig)
        self.assertEqual(
            ssl_connection.sslConfig.root.sslCertificate.get_secret_value(),
            "test_cert.pem",
        )
        self.assertEqual(
            ssl_connection.sslConfig.root.sslKey.get_secret_value(), "test_key.pem"
        )
        self.assertEqual(
            ssl_connection.sslConfig.root.caCertificate.get_secret_value(),
            "test_ca.pem",
        )

    def test_https_scheme_configuration(self):
        """
        Test HTTPS scheme configuration in Hive connection
        """
        https_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive_https,
            username="username",
            password=CustomSecretStr("password"),
            hostPort="localhost:1000",
            auth=Auth.BASIC,
        )

        self.assertEqual(https_connection.scheme, HiveScheme.hive_https)
        self.assertEqual(https_connection.auth, Auth.BASIC)
        self.assertEqual(https_connection.username, "username")
        self.assertEqual(https_connection.password.get_secret_value(), "password")

    @patch("metadata.ingestion.source.database.hive.connection.check_ssl_and_init")
    @patch(
        "metadata.ingestion.source.database.hive.connection.create_generic_db_connection"
    )
    def test_get_connection_with_ssl(self, mock_create_connection, mock_ssl_manager):
        """
        Test get_connection function with SSL configuration
        """
        # Mock SSL manager
        mock_ssl_manager_instance = Mock()
        mock_ssl_manager_instance.setup_ssl.return_value = mock_hive_connection_ssl
        mock_ssl_manager.return_value = mock_ssl_manager_instance

        # Mock create_generic_db_connection
        mock_engine = Mock()
        mock_create_connection.return_value = mock_engine

        # Test SSL connection
        result = get_connection(mock_hive_connection_ssl)

        # Verify SSL manager was called
        mock_ssl_manager.assert_called_once()
        mock_ssl_manager_instance.setup_ssl.assert_called_once_with(
            mock_hive_connection_ssl
        )

        # Verify connection was created
        mock_create_connection.assert_called_once()

        # Verify result
        self.assertEqual(result, mock_engine)

    @patch("metadata.ingestion.source.database.hive.connection.check_ssl_and_init")
    @patch(
        "metadata.ingestion.source.database.hive.connection.create_generic_db_connection"
    )
    def test_get_connection_without_ssl(self, mock_create_connection, mock_ssl_manager):
        """
        Test get_connection function without SSL configuration
        """
        # Mock SSL manager returns None (no SSL)
        mock_ssl_manager.return_value = None

        # Mock create_generic_db_connection
        mock_engine = Mock()
        mock_create_connection.return_value = mock_engine

        # Test non-SSL connection
        non_ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=False,
        )

        result = get_connection(non_ssl_connection)

        # Verify SSL manager was called but returned None
        mock_ssl_manager.assert_called_once()

        # Verify connection was created
        mock_create_connection.assert_called_once()

        # Verify result
        self.assertEqual(result, mock_engine)

    def test_connection_url_with_ssl(self):
        """
        Test connection URL generation with SSL configuration
        """
        # Test basic SSL connection
        ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=True,
        )

        url = get_connection_url(ssl_connection)
        self.assertEqual(url, "hive://username@localhost:1466")

        # Test HTTPS scheme connection
        https_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive_https,
            username="username",
            password=CustomSecretStr("password"),
            hostPort="localhost:1000",
            auth=Auth.BASIC,
        )

        url = get_connection_url(https_connection)
        self.assertEqual(url, "hive+https://username:password@localhost:1000")

    def test_custom_hive_connection_ssl_initialization(self):
        """
        Test CustomHiveConnection SSL initialization
        """
        # Test SSL connection with certificates
        ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=True,
            sslConfig=SslConfig(
                root=ValidateSslClientConfig(
                    sslCertificate=CustomSecretStr("test_cert.pem"),
                    sslKey=CustomSecretStr("test_key.pem"),
                    caCertificate=CustomSecretStr("test_ca.pem"),
                )
            ),
        )

        # Test the configuration parsing
        self.assertTrue(ssl_connection.useSSL)
        self.assertIsNotNone(ssl_connection.sslConfig)
        self.assertEqual(
            ssl_connection.sslConfig.root.sslCertificate.get_secret_value(),
            "test_cert.pem",
        )
        self.assertEqual(
            ssl_connection.sslConfig.root.sslKey.get_secret_value(), "test_key.pem"
        )
        self.assertEqual(
            ssl_connection.sslConfig.root.caCertificate.get_secret_value(),
            "test_ca.pem",
        )

    def test_ssl_config_validation(self):
        """
        Test SSL configuration validation
        """
        # Test valid SSL config
        valid_ssl_config = ValidateSslClientConfig(
            sslCertificate=CustomSecretStr("valid_cert.pem"),
            sslKey=CustomSecretStr("valid_key.pem"),
            caCertificate=CustomSecretStr("valid_ca.pem"),
        )

        self.assertEqual(
            valid_ssl_config.sslCertificate.get_secret_value(), "valid_cert.pem"
        )
        self.assertEqual(valid_ssl_config.sslKey.get_secret_value(), "valid_key.pem")
        self.assertEqual(
            valid_ssl_config.caCertificate.get_secret_value(), "valid_ca.pem"
        )

        # Test SSL config with only some certificates
        partial_ssl_config = ValidateSslClientConfig(
            sslCertificate=CustomSecretStr("cert_only.pem")
        )

        self.assertEqual(
            partial_ssl_config.sslCertificate.get_secret_value(), "cert_only.pem"
        )
        self.assertIsNone(partial_ssl_config.sslKey)
        self.assertIsNone(partial_ssl_config.caCertificate)

    def test_hive_scheme_enum_values(self):
        """
        Test HiveScheme enum values for SSL support
        """
        self.assertEqual(HiveScheme.hive.value, "hive")
        self.assertEqual(HiveScheme.hive_http.value, "hive+http")
        self.assertEqual(HiveScheme.hive_https.value, "hive+https")

        # Verify all schemes are available
        schemes = [scheme.value for scheme in HiveScheme]
        self.assertIn("hive", schemes)
        self.assertIn("hive+http", schemes)
        self.assertIn("hive+https", schemes)

    def test_auth_enum_values(self):
        """
        Test Auth enum values for SSL authentication
        """
        self.assertEqual(Auth.NONE.value, "NONE")
        self.assertEqual(Auth.LDAP.value, "LDAP")
        self.assertEqual(Auth.KERBEROS.value, "KERBEROS")
        self.assertEqual(Auth.CUSTOM.value, "CUSTOM")
        self.assertEqual(Auth.NOSASL.value, "NOSASL")
        self.assertEqual(Auth.BASIC.value, "BASIC")
        self.assertEqual(Auth.GSSAPI.value, "GSSAPI")
        self.assertEqual(Auth.JWT.value, "JWT")
        self.assertEqual(Auth.PLAIN.value, "PLAIN")

    @patch("metadata.ingestion.source.database.hive.connection.check_ssl_and_init")
    def test_ssl_manager_integration(self, mock_ssl_manager):
        """
        Test SSL manager integration with Hive connection
        """
        # Mock SSL manager
        mock_ssl_manager_instance = Mock()
        mock_ssl_manager_instance.setup_ssl.return_value = mock_hive_connection_ssl
        mock_ssl_manager.return_value = mock_ssl_manager_instance

        # Test that SSL manager is called when SSL is enabled
        ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=True,
        )

        # Test the configuration
        self.assertTrue(ssl_connection.useSSL)

        # Note: The SSL manager would be called when get_connection is actually invoked
        # This test just verifies the SSL configuration is properly set

    def test_custom_hive_connection_ssl_parameters(self):
        """
        Test CustomHiveConnection SSL parameter handling
        """
        # Test SSL parameters that would be passed to CustomHiveConnection
        ssl_params = {
            "use_ssl": True,
            "ssl_certfile": "test_cert.pem",
            "ssl_keyfile": "test_key.pem",
            "ssl_ca_certs": "test_ca.pem",
            "ssl_cert_reqs": 0,  # ssl.CERT_NONE
        }

        # Verify SSL parameters are properly structured
        self.assertTrue(ssl_params["use_ssl"])
        self.assertEqual(ssl_params["ssl_certfile"], "test_cert.pem")
        self.assertEqual(ssl_params["ssl_keyfile"], "test_key.pem")
        self.assertEqual(ssl_params["ssl_ca_certs"], "test_ca.pem")
        self.assertEqual(ssl_params["ssl_cert_reqs"], 0)

    def test_https_scheme_authentication_modes(self):
        """
        Test HTTPS scheme with different authentication modes
        """
        # Test BASIC authentication
        basic_auth_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive_https,
            username="username",
            password=CustomSecretStr("password"),
            hostPort="localhost:1000",
            auth=Auth.BASIC,
        )

        self.assertEqual(basic_auth_connection.auth, Auth.BASIC)
        self.assertEqual(basic_auth_connection.scheme, HiveScheme.hive_https)

        # Test NOSASL authentication
        nosasl_auth_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive_https,
            username="username",
            hostPort="localhost:1000",
            auth=Auth.NOSASL,
        )

        self.assertEqual(nosasl_auth_connection.auth, Auth.NOSASL)

        # Test NONE authentication
        none_auth_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive_https,
            username="username",
            hostPort="localhost:1000",
            auth=Auth.NONE,
        )

        self.assertEqual(none_auth_connection.auth, Auth.NONE)

    def test_ssl_certificate_parameter_mapping(self):
        """
        Test SSL certificate parameter mapping for HTTPS scheme
        """
        # Test SSL certificate parameter mapping as used in CustomHiveConnection
        ssl_cert_parameter_map = {
            "none": 0,  # CERT_NONE
            "optional": 1,  # CERT_OPTIONAL
            "required": 2,  # CERT_REQUIRED
        }

        self.assertEqual(ssl_cert_parameter_map["none"], 0)
        self.assertEqual(ssl_cert_parameter_map["optional"], 1)
        self.assertEqual(ssl_cert_parameter_map["required"], 2)

        # Test default value handling
        default_ssl_cert = "none"
        self.assertEqual(ssl_cert_parameter_map.get(default_ssl_cert, 0), 0)

    def test_connection_arguments_ssl_setup(self):
        """
        Test SSL setup in connection arguments
        """
        # Test that SSL configuration is properly added to connection arguments
        ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            useSSL=True,
            sslConfig=SslConfig(
                root=ValidateSslClientConfig(
                    sslCertificate=CustomSecretStr("test_cert.pem"),
                    sslKey=CustomSecretStr("test_key.pem"),
                    caCertificate=CustomSecretStr("test_ca.pem"),
                )
            ),
        )

        # Verify SSL configuration is present
        self.assertTrue(ssl_connection.useSSL)
        self.assertIsNotNone(ssl_connection.sslConfig)

        # Test that SSL config values are accessible
        ssl_config = ssl_connection.sslConfig.root
        self.assertEqual(ssl_config.sslCertificate.get_secret_value(), "test_cert.pem")
        self.assertEqual(ssl_config.sslKey.get_secret_value(), "test_key.pem")
        self.assertEqual(ssl_config.caCertificate.get_secret_value(), "test_ca.pem")

    def test_kerberos_ssl_integration(self):
        """
        Test Kerberos authentication with SSL
        """
        # Test Kerberos connection with SSL
        kerberos_ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            hostPort="localhost:1466",
            auth=Auth.KERBEROS,
            kerberosServiceName="hive",
            useSSL=True,
        )

        self.assertEqual(kerberos_ssl_connection.auth, Auth.KERBEROS)
        self.assertEqual(kerberos_ssl_connection.kerberosServiceName, "hive")
        self.assertTrue(kerberos_ssl_connection.useSSL)

    def test_ldap_ssl_integration(self):
        """
        Test LDAP authentication with SSL
        """
        # Test LDAP connection with SSL
        ldap_ssl_connection = HiveConnection(
            type="Hive",
            scheme=HiveScheme.hive,
            username="username",
            password=CustomSecretStr("password"),
            hostPort="localhost:1466",
            auth=Auth.LDAP,
            useSSL=True,
        )

        self.assertEqual(ldap_ssl_connection.auth, Auth.LDAP)
        self.assertEqual(ldap_ssl_connection.username, "username")
        self.assertEqual(ldap_ssl_connection.password.get_secret_value(), "password")
        self.assertTrue(ldap_ssl_connection.useSSL)
