#  Copyright 2022 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Test Secrets Manager Utils
"""
import json
import uuid
from copy import deepcopy
from typing import Any, Dict
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
    DbtHttpConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.security.client.googleSSOClientConfig import (
    GoogleSSOClientConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets_manager import (
    AUTH_PROVIDER_MAPPING,
    AWSSecretsManager,
    Singleton,
    get_secrets_manager,
)

DATABASE_CONNECTION = {"username": "test", "hostPort": "localhost:3306"}

DATABASE_SERVICE = {
    "id": uuid.uuid4(),
    "name": "test_service",
    "serviceType": DatabaseServiceType.Mysql,
    "connection": DatabaseConnection(),
}

AUTH_PROVIDER_CONFIG = {"secretKey": "/fake/path"}

DBT_SOURCE_CONFIG = {
    "dbtCatalogHttpPath": "/fake/path",
    "dbtManifestHttpPath": "/fake/path",
}


class TestSecretsManager(TestCase):
    service_type: str = "database"
    service: DatabaseService
    service_connection: ServiceConnection
    database_connection = MysqlConnection(**DATABASE_CONNECTION)
    auth_provider_config = GoogleSSOClientConfig(**AUTH_PROVIDER_CONFIG)
    om_connection: OpenMetadataConnection
    dbt_source_config: DbtHttpConfig

    @classmethod
    def setUpClass(cls) -> None:
        cls.service = DatabaseService(**DATABASE_SERVICE)
        cls.service.connection = DatabaseConnection(config=cls.database_connection)
        cls.service_connection = ServiceConnection(__root__=cls.service.connection)
        cls.om_connection = OpenMetadataConnection(
            authProvider=AuthProvider.google,
            hostPort="http://localhost:8585/api",
        )
        cls.dbt_source_config = DbtHttpConfig.parse_obj(DBT_SOURCE_CONFIG)

    @classmethod
    def setUp(cls) -> None:
        Singleton.clear_all()

    def test_local_manager_add_service_config_connection(self):
        local_manager = get_secrets_manager(
            self._build_open_metadata_connection(SecretsManagerProvider.local), None
        )
        expected_service_connection = self.service_connection

        actual_service_connection: ServiceConnection = (
            local_manager.retrieve_service_connection(self.service, self.service_type)
        )

        self.assertEqual(actual_service_connection, expected_service_connection)
        assert id(actual_service_connection.__root__.config) == id(
            expected_service_connection.__root__.config
        )

    def test_local_manager_add_auth_provider_security_config(self):
        local_manager = get_secrets_manager(
            self._build_open_metadata_connection(SecretsManagerProvider.local), None
        )
        actual_om_connection = deepcopy(self.om_connection)
        actual_om_connection.securityConfig = self.auth_provider_config

        local_manager.add_auth_provider_security_config(actual_om_connection)

        self.assertEqual(self.auth_provider_config, actual_om_connection.securityConfig)
        assert id(self.auth_provider_config) == id(actual_om_connection.securityConfig)

    def test_local_manager_retrieve_dbt_source_config(self):
        local_manager = get_secrets_manager(
            self._build_open_metadata_connection(SecretsManagerProvider.local), None
        )
        source_config = SourceConfig()
        source_config.config = DatabaseServiceMetadataPipeline(
            dbtConfigSource=self.dbt_source_config
        )

        actual_dbt_source_config = local_manager.retrieve_dbt_source_config(
            source_config, "test-pipeline"
        )

        self.assertEqual(self.dbt_source_config.dict(), actual_dbt_source_config)

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_add_service_config_connection(self, boto3_mock):
        aws_manager = self._build_secret_manager(
            boto3_mock, {"SecretString": json.dumps(DATABASE_CONNECTION)}
        )
        expected_service_connection = self.service_connection

        actual_service_connection: ServiceConnection = (
            aws_manager.retrieve_service_connection(self.service, self.service_type)
        )

        expected_call = {
            "SecretId": "/openmetadata/service/database/mysql/test_service"
        }
        aws_manager.secretsmanager_client.get_secret_value.assert_called_once_with(
            **expected_call
        )
        self.assertEqual(expected_service_connection, actual_service_connection)
        assert id(actual_service_connection.__root__.config) != id(
            expected_service_connection.__root__.config
        )

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_fails_add_service_config_connection_when_not_stored(
        self, mocked_boto3
    ):
        aws_manager = self._build_secret_manager(mocked_boto3, {})

        with self.assertRaises(ValueError) as value_error:
            aws_manager.retrieve_service_connection(self.service, self.service_type)
            self.assertEqual(
                "[SecretString] not present in the response.", value_error.exception
            )

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_add_auth_provider_security_config(self, boto3_mock):
        aws_manager = self._build_secret_manager(
            boto3_mock, {"SecretString": json.dumps(AUTH_PROVIDER_CONFIG)}
        )
        actual_om_connection = deepcopy(self.om_connection)
        actual_om_connection.securityConfig = None

        aws_manager.add_auth_provider_security_config(actual_om_connection)

        expected_call = {"SecretId": "/openmetadata/auth-provider/google"}
        aws_manager.secretsmanager_client.get_secret_value.assert_called_once_with(
            **expected_call
        )
        self.assertEqual(self.auth_provider_config, actual_om_connection.securityConfig)
        assert id(self.auth_provider_config) != id(actual_om_connection.securityConfig)

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_retrieve_dbt_source_config(self, boto3_mock):
        aws_manager = self._build_secret_manager(
            boto3_mock, {"SecretString": json.dumps(DBT_SOURCE_CONFIG)}
        )
        source_config = SourceConfig()
        source_config.config = DatabaseServiceMetadataPipeline(
            dbtConfigSource=self.dbt_source_config
        )

        actual_dbt_source_config = aws_manager.retrieve_dbt_source_config(
            source_config, "test-pipeline"
        )

        expected_call = {
            "SecretId": "/openmetadata/database-metadata-pipeline/test-pipeline"
        }
        aws_manager.secretsmanager_client.get_secret_value.assert_called_once_with(
            **expected_call
        )
        self.assertEqual(self.dbt_source_config.dict(), actual_dbt_source_config)

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_fails_add_auth_provider_security_config(self, mocked_boto3):
        aws_manager = self._build_secret_manager(mocked_boto3, {})

        with self.assertRaises(ValueError) as value_error:
            aws_manager.add_auth_provider_security_config(self.om_connection)
            self.assertEqual(
                "[SecretString] not present in the response.", value_error.exception
            )

    @patch("metadata.utils.secrets_manager.boto3")
    def test_aws_manager_aws_manager_fails_retrieve_dbt_source_config_when_not_stored(
        self, mocked_boto3
    ):
        aws_manager = self._build_secret_manager(mocked_boto3, {})

        source_config = SourceConfig()
        source_config.config = DatabaseServiceMetadataPipeline(
            dbtConfigSource=self.dbt_source_config
        )

        with self.assertRaises(ValueError) as value_error:
            aws_manager.retrieve_dbt_source_config(source_config, "test-pipeline")
            self.assertEqual(
                "[SecretString] not present in the response.", value_error.exception
            )

    def test_get_not_implemented_secret_manager(self):
        with self.assertRaises(NotImplementedError) as not_implemented_error:
            om_connection: OpenMetadataConnection = (
                self._build_open_metadata_connection(SecretsManagerProvider.local)
            )
            om_connection.secretsManagerProvider = "aws"
            get_secrets_manager(om_connection)
            self.assertEqual(
                "[any] is not implemented.", not_implemented_error.exception
            )

    def test_all_auth_provider_has_auth_client(self):
        auth_provider_with_client = [
            e for e in AuthProvider if e is not AuthProvider.no_auth
        ]
        for auth_provider in auth_provider_with_client:
            assert AUTH_PROVIDER_MAPPING.get(auth_provider, None) is not None

    def _build_secret_manager(
        self, mocked_boto3: Mock, expected_json: Dict[str, Any]
    ) -> AWSSecretsManager:
        self._init_boto3_mock(mocked_boto3, expected_json)
        return AWSSecretsManager(
            AWSCredentials(
                awsAccessKeyId="fake_key",
                awsSecretAccessKey="fake_access",
                awsRegion="fake-region",
            ),
            "openmetadata",
        )

    @staticmethod
    def _build_open_metadata_connection(
        secret_manager_provider: SecretsManagerProvider,
    ) -> OpenMetadataConnection:
        return OpenMetadataConnection(
            secretsManagerProvider=secret_manager_provider,
            clusterName="openmetadata",
            hostPort="http://localhost:8585/api",
        )

    @staticmethod
    def _init_boto3_mock(boto3_mock: Mock, client_return: Dict[str, Any]):
        mocked_client = Mock()
        boto3_session = Mock()
        mocked_client.get_secret_value = Mock(return_value=client_return)
        boto3_session.client = Mock(return_value=mocked_client)
        boto3_mock.Session = Mock(return_value=boto3_session)
