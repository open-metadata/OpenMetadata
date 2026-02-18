#  Copyright 2022 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import os
from unittest import mock

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.ingestion.ometa.auth_provider import OpenMetadataAuthenticationProvider
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager
from metadata.utils.secrets.db_secrets_manager import DBSecretsManager
from metadata.utils.singleton import Singleton


@pytest.fixture
def local_server_config():
    """Configuration for local DB secrets manager."""
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        enableVersionValidation=False,
    )


@pytest.fixture
def aws_server_config():
    """Configuration for AWS secrets manager."""
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        secretsManagerProvider=SecretsManagerProvider.aws,
        secretsManagerLoader=SecretsManagerClientLoader.noop,
        enableVersionValidation=False,
    )


@pytest.fixture(autouse=True)
def cleanup_singleton():
    """Clear singleton instances before each test."""
    Singleton.clear_all()
    yield
    Singleton.clear_all()


class TestOMetaSecretsManagerAPI:
    """
    Secrets Manager API integration tests.
    Tests secrets manager initialization and configuration.

    Uses fixtures:
    - local_server_config: Config for local DB secrets manager
    - aws_server_config: Config for AWS secrets manager
    - cleanup_singleton: Auto-cleanup singleton instances
    """

    def test_ometa_with_local_secret_manager(self, local_server_config):
        """Test initialization with local DB secrets manager."""
        metadata = OpenMetadata(local_server_config)

        assert type(metadata.secrets_manager_client) is DBSecretsManager
        assert type(metadata._auth_provider) is OpenMetadataAuthenticationProvider

    @mock.patch.dict(os.environ, {"AWS_DEFAULT_REGION": "us-east-2"}, clear=True)
    def test_ometa_with_aws_secret_manager(self, aws_server_config):
        """Test initialization with AWS secrets manager."""
        metadata = OpenMetadata(aws_server_config)

        assert type(metadata.secrets_manager_client) is AWSSecretsManager
        assert type(metadata._auth_provider) is OpenMetadataAuthenticationProvider
