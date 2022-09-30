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
Test AWS Secrets Manager
"""
from abc import ABC, abstractmethod
from copy import deepcopy
from typing import Any, Dict
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.bot import BotType
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.utils.secrets.aws_based_secrets_manager import AWSBasedSecretsManager
from metadata.utils.singleton import Singleton

from .test_secrets_manager import (
    AUTH_PROVIDER_CONFIG,
    DATABASE_CONNECTION,
    DATABASE_CONNECTION_CONFIG,
    DBT_SOURCE_CONFIG,
    TestSecretsManager,
)


class AWSBasedSecretsManager(object):
    class TestCase(TestSecretsManager.External, ABC):
        @classmethod
        def setUp(cls) -> None:
            Singleton.clear_all()

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_add_service_config_connection(self, mocked_get_client):

            aws_manager = self.build_secret_manager(
                mocked_get_client, self.build_response_value(DATABASE_CONNECTION_CONFIG)
            )
            expected_service_connection = self.service_connection

            actual_service_connection: ServiceConnection = (
                aws_manager.retrieve_service_connection(self.service, self.service_type)
            )

            self.assert_client_called_once(
                aws_manager, "/openmetadata/service/database/mysql/test_service"
            )
            self.assertEqual(expected_service_connection, actual_service_connection)
            assert id(actual_service_connection.__root__.config) != id(
                expected_service_connection.__root__.config
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_fails_add_service_config_connection_when_not_stored(
            self, mocked_get_client
        ):
            aws_manager = self.build_secret_manager(mocked_get_client, {})

            with self.assertRaises(ValueError) as value_error:
                aws_manager.retrieve_service_connection(self.service, self.service_type)
            self.assertTrue(
                "/openmetadata/service/database/mysql/test_service"
                in str(value_error.exception)
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_add_auth_provider_security_config(self, mocked_get_client):
            aws_manager = self.build_secret_manager(
                mocked_get_client,
                self.build_response_value("google"),
                self.build_response_value(AUTH_PROVIDER_CONFIG),
            )
            actual_om_connection = deepcopy(self.om_connection)
            actual_om_connection.securityConfig = None

            aws_manager.add_auth_provider_security_config(
                actual_om_connection, BotType.ingestion_bot.value
            )

            self.assert_client_called_once(
                aws_manager,
                "/openmetadata/bot/ingestion-bot/auth-provider",
                "/openmetadata/bot/ingestion-bot",
            )
            self.assertEqual(
                self.auth_provider_config, actual_om_connection.securityConfig
            )
            assert id(self.auth_provider_config) != id(
                actual_om_connection.securityConfig
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_fails_add_auth_provider_security_config(
            self, mocked_get_client
        ):
            aws_manager = self.build_secret_manager(mocked_get_client, {})

            with self.assertRaises(ValueError) as value_error:
                aws_manager.add_auth_provider_security_config(
                    self.om_connection, BotType.ingestion_bot.value
                )
            self.assertTrue(
                "/openmetadata/bot/ingestion-bot" in str(value_error.exception)
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_retrieve_dbt_source_config(self, mocked_get_client):
            aws_manager = self.build_secret_manager(
                mocked_get_client, self.build_response_value(DBT_SOURCE_CONFIG)
            )
            source_config = SourceConfig()
            source_config.config = DatabaseServiceMetadataPipeline(
                dbtConfigSource=self.dbt_source_config
            )

            actual_dbt_source_config = aws_manager.retrieve_dbt_source_config(
                source_config, "test-pipeline"
            )

            self.assert_client_called_once(
                aws_manager, "/openmetadata/database-metadata-pipeline/test-pipeline"
            )
            self.assertEqual(self.dbt_source_config.dict(), actual_dbt_source_config)

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_aws_manager_fails_retrieve_dbt_source_config_when_not_stored(
            self, mocked_get_client
        ):
            aws_manager = self.build_secret_manager(mocked_get_client, {})

            source_config = SourceConfig()
            source_config.config = DatabaseServiceMetadataPipeline(
                dbtConfigSource=self.dbt_source_config
            )

            with self.assertRaises(ValueError) as value_error:
                aws_manager.retrieve_dbt_source_config(source_config, "test-pipeline")
            self.assertTrue(
                "/openmetadata/database-metadata-pipeline/test-pipeline"
                in str(value_error.exception)
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_retrieve_temp_service_test_connection(
            self, mocked_get_client
        ):

            aws_manager = self.build_secret_manager(
                mocked_get_client, self.build_response_value(DATABASE_CONNECTION)
            )
            expected_service_connection = self.service.connection

            actual_service_connection: DatabaseConnection = (
                aws_manager.retrieve_temp_service_test_connection(
                    self.service.connection, "Database"
                )
            )

            self.assert_client_called_once(
                aws_manager, "/openmetadata/test-connection-temp/database"
            )
            self.assertEqual(expected_service_connection, actual_service_connection)
            assert id(actual_service_connection.config) != id(
                expected_service_connection.config
            )

        @patch("metadata.clients.aws_client.AWSClient.get_client")
        def test_aws_manager_fails_retrieve_temp_service_test_connection(
            self, mocked_get_client
        ):
            aws_manager = self.build_secret_manager(mocked_get_client, {})

            with self.assertRaises(ValueError) as value_error:
                aws_manager.retrieve_temp_service_test_connection(
                    self.service.connection, self.service_type
                )
            self.assertTrue(
                "/openmetadata/test-connection-temp/database"
                in str(value_error.exception)
            )

        @abstractmethod
        def build_secret_manager(
            self,
            mocked_get_client: Mock,
            expected_json_2: Dict[str, Any],
            expected_json_1: Dict[str, Any],
        ) -> AWSBasedSecretsManager:
            pass

        @staticmethod
        @abstractmethod
        def assert_client_called_once(
            aws_manager: AWSBasedSecretsManager,
            expected_call_1: str,
            expected_call_2: str,
        ) -> None:
            pass

        @staticmethod
        @abstractmethod
        def build_response_value(json_value: Any):
            pass
