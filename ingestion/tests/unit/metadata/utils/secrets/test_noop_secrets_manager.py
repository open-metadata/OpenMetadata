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
Test Local Secrets Manager
"""
from copy import deepcopy

from metadata.generated.schema.entity.bot import BotType
from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.utils.secrets.secrets_manager_factory import (
    get_secrets_manager_from_om_connection,
)

from .test_secrets_manager import TestSecretsManager


class TestLocalSecretsManager(TestSecretsManager.External):
    def test_noop_manager_add_service_config_connection(self):
        noop_manager = get_secrets_manager_from_om_connection(
            self.build_open_metadata_connection(SecretsManagerProvider.noop), None
        )
        expected_service_connection = self.service_connection

        actual_service_connection: ServiceConnection = (
            noop_manager.retrieve_service_connection(self.service, self.service_type)
        )

        self.assertEqual(actual_service_connection, expected_service_connection)
        assert id(actual_service_connection.__root__.config) == id(
            expected_service_connection.__root__.config
        )

    def test_noop_manager_add_auth_provider_security_config(self):
        noop_manager = get_secrets_manager_from_om_connection(
            self.build_open_metadata_connection(SecretsManagerProvider.noop), None
        )
        actual_om_connection = deepcopy(self.om_connection)
        actual_om_connection.securityConfig = self.auth_provider_config

        noop_manager.add_auth_provider_security_config(
            actual_om_connection, BotType.ingestion_bot.value
        )

        self.assertEqual(self.auth_provider_config, actual_om_connection.securityConfig)
        assert id(self.auth_provider_config) == id(actual_om_connection.securityConfig)

    def test_noop_manager_retrieve_dbt_source_config(self):
        noop_manager = get_secrets_manager_from_om_connection(
            self.build_open_metadata_connection(SecretsManagerProvider.noop), None
        )
        source_config = SourceConfig()
        source_config.config = DatabaseServiceMetadataPipeline(
            dbtConfigSource=self.dbt_source_config
        )

        actual_dbt_source_config = noop_manager.retrieve_dbt_source_config(
            source_config, "test-pipeline"
        )

        self.assertEqual(self.dbt_source_config.dict(), actual_dbt_source_config)

    def test_noop_manager_retrieve_temp_service_test_connection(self):
        noop_manager = get_secrets_manager_from_om_connection(
            self.build_open_metadata_connection(SecretsManagerProvider.noop), None
        )
        expected_service_connection = self.service.connection

        actual_service_connection: DatabaseConnection = (
            noop_manager.retrieve_temp_service_test_connection(
                self.service.connection, "Database"
            )
        )

        self.assertEqual(actual_service_connection, expected_service_connection)
        assert id(actual_service_connection.config) == id(
            expected_service_connection.config
        )
