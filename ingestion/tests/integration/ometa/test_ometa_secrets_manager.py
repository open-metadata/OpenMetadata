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

from unittest import TestCase

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.googleSSOClientConfig import (
    GoogleSSOClientConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.ingestion.ometa.auth_provider import (
    GoogleAuthenticationProvider,
    NoOpAuthenticationProvider,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager
from metadata.utils.secrets.noop_secrets_manager import NoopSecretsManager
from metadata.utils.singleton import Singleton


class OMetaSecretManagerTest(TestCase):
    metadata: OpenMetadata
    aws_server_config: OpenMetadataConnection
    local_server_config: OpenMetadataConnection

    @classmethod
    def setUp(cls) -> None:
        Singleton.clear_all()
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
        assert type(self.metadata.secrets_manager_client) is NoopSecretsManager
        assert type(self.metadata._auth_provider) is NoOpAuthenticationProvider

    def test_ometa_with_local_secret_manager_with_google_auth(self):
        self.local_server_config.authProvider = AuthProvider.google
        self.local_server_config.securityConfig = GoogleSSOClientConfig(
            secretKey="/fake/path"
        )
        self._init_local_secret_manager()
        assert type(self.metadata.secrets_manager_client) is NoopSecretsManager
        assert type(self.metadata._auth_provider) is GoogleAuthenticationProvider

    def test_ometa_with_aws_secret_manager(self):
        self._init_aws_secret_manager()
        assert type(self.metadata.secrets_manager_client) is AWSSecretsManager
        assert type(self.metadata._auth_provider) is NoOpAuthenticationProvider

    def _init_local_secret_manager(self):
        self.metadata = OpenMetadata(self.local_server_config)

    def _init_aws_secret_manager(self):
        self.metadata = OpenMetadata(self.aws_server_config)
