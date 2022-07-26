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
from copy import copy
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
    SecretsManagerProvider,
)
from metadata.generated.schema.security.client.googleSSOClientConfig import (
    GoogleSSOClientConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.ometa.auth_provider import (
    GoogleAuthenticationProvider,
    NoOpAuthenticationProvider,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.secrets_manager import AWSSecretsManager, LocalSecretsManager


class OMetaSecretManagerTest(TestCase):
    metadata: OpenMetadata
    aws_server_config: OpenMetadataConnection
    local_server_config: OpenMetadataConnection

    @classmethod
    def setUp(cls) -> None:
        cls.local_server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            enableVersionValidation=False,
        )
        cls.aws_server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            secretsManagerProvider=SecretsManagerProvider.aws,
            secretsManagerCredentials=AWSCredentials(
                awsRegion="test", awsSecretAccessKey="test"
            ),
            enableVersionValidation=False,
        )

    def test_ometa_with_local_secret_manager(self):
        self._init_local_secret_manager()
        assert type(self.metadata.secrets_manager_client) is LocalSecretsManager
        assert type(self.metadata._auth_provider) is NoOpAuthenticationProvider

    def test_ometa_with_local_secret_manager_with_google_auth(self):
        self.local_server_config.authProvider = AuthProvider.google
        self.local_server_config.securityConfig = GoogleSSOClientConfig(
            secretKey="/fake/path"
        )
        self._init_local_secret_manager()
        assert type(self.metadata.secrets_manager_client) is LocalSecretsManager
        assert type(self.metadata._auth_provider) is GoogleAuthenticationProvider

    def test_ometa_with_aws_secret_manager(self):
        self._init_aws_secret_manager()
        assert type(self.metadata.secrets_manager_client) is AWSSecretsManager
        assert type(self.metadata._auth_provider) is NoOpAuthenticationProvider

    @patch("metadata.ingestion.ometa.ometa_api.get_secrets_manager")
    def test_ometa_with_aws_secret_manager_with_google_auth(self, secrets_manager_mock):
        security_config = copy(self.aws_server_config)
        security_config.securityConfig = GoogleSSOClientConfig(secretKey="/fake/path")
        secret_client_mock = Mock()
        secret_client_mock.add_auth_provider_security_config.return_value = (
            security_config
        )
        secrets_manager_mock.return_value = secret_client_mock
        self.aws_server_config.authProvider = AuthProvider.google
        self._init_aws_secret_manager()
        assert type(self.metadata._auth_provider) is GoogleAuthenticationProvider

    def _init_local_secret_manager(self):
        self.metadata = OpenMetadata(self.local_server_config)

    def _init_aws_secret_manager(self):
        self.metadata = OpenMetadata(self.aws_server_config)
