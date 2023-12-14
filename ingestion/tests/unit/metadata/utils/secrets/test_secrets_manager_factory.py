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
Test Secrets Manager Factory
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.noop_secrets_manager import DBSecretsManager
from metadata.utils.secrets.secrets_manager_factory import (
    SecretsManagerConfigException,
    SecretsManagerFactory,
)
from metadata.utils.singleton import Singleton


class TestSecretsManagerFactory(TestCase):
    @classmethod
    def setUp(cls) -> None:
        Singleton.clear_all()

    def test_get_not_implemented_secret_manager(self):
        with self.assertRaises(NotImplementedError) as not_implemented_error:
            om_connection: OpenMetadataConnection = self.build_open_metadata_connection(
                SecretsManagerProvider.noop,
                SecretsManagerClientLoader.noop,
            )
            om_connection.secretsManagerProvider = "aws"
            SecretsManagerFactory(
                om_connection.secretsManagerProvider, om_connection.secretsManagerLoader
            )
            self.assertEqual(
                "[any] is not implemented.", not_implemented_error.exception
            )

    def test_invalid_config_secret_manager(self):

        om_connection: OpenMetadataConnection = self.build_open_metadata_connection(
            SecretsManagerProvider.noop,
            SecretsManagerClientLoader.noop,
        )
        om_connection.secretsManagerLoader = "random"

        with self.assertRaises(SecretsManagerConfigException):
            SecretsManagerFactory(
                om_connection.secretsManagerProvider, om_connection.secretsManagerLoader
            )

    def test_get_none_secret_manager(self):
        om_connection: OpenMetadataConnection = self.build_open_metadata_connection(
            SecretsManagerProvider.noop,
            SecretsManagerClientLoader.noop,
        )
        om_connection.secretsManagerProvider = None
        om_connection.secretsManagerLoader = None

        secrets_manager_factory = SecretsManagerFactory(
            om_connection.secretsManagerProvider, om_connection.secretsManagerLoader
        )
        assert secrets_manager_factory.get_secrets_manager() is not None
        assert isinstance(
            secrets_manager_factory.get_secrets_manager(), DBSecretsManager
        )

    @patch("metadata.clients.aws_client.boto3")
    def test_all_providers_has_implementation(self, mocked_boto3):
        mocked_boto3.client.return_value = {}
        secret_manager_providers = [
            secret_manager_provider
            for secret_manager_provider in SecretsManagerProvider
            if secret_manager_provider is not SecretsManagerProvider.in_memory
        ]
        for secret_manager_provider in secret_manager_providers:
            open_metadata_connection: OpenMetadataConnection = OpenMetadataConnection(
                secretsManagerProvider=secret_manager_provider,
                secretsManagerLoader=SecretsManagerClientLoader.env,
                hostPort="http://localhost:8585",
            )
            secrets_manager_factory = SecretsManagerFactory(
                open_metadata_connection.secretsManagerProvider,
                open_metadata_connection.secretsManagerLoader,
            )
            assert secrets_manager_factory.get_secrets_manager() is not None

    @staticmethod
    def build_open_metadata_connection(
        secret_manager_provider: SecretsManagerProvider,
        secret_manager_loader: SecretsManagerClientLoader,
    ) -> OpenMetadataConnection:
        return OpenMetadataConnection(
            secretsManagerProvider=secret_manager_provider,
            secretsManagerLoader=secret_manager_loader,
            hostPort="http://localhost:8585/api",
        )
