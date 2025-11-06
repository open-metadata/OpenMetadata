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
Unit tests for Application private config retrieval from secrets manager
"""
import json
from unittest import TestCase
from unittest.mock import MagicMock

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.models.custom_pydantic import _CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.application import AppRunner

MOCK_PIPELINE_FQN = "OpenMetadata.CollateAIApplication"


class MockAppRunner(AppRunner):
    """Mock AppRunner for testing"""

    def __init__(
        self,
        config: OpenMetadataApplicationConfig,
        metadata: OpenMetadata,
    ):
        self.app_config = config.appConfig.root if config.appConfig else None
        self.metadata = metadata
        # Use applicationFqn from config
        self.private_config = self._retrieve_app_private_config(
            config.appPrivateConfig.root if config.appPrivateConfig else None,
            config.applicationFqn.root if config.applicationFqn else None,
        )

    def run(self) -> None:
        pass

    def close(self) -> None:
        pass


class TestApplicationPrivateConfig(TestCase):
    """Test cases for Application private config retrieval"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock(spec=OpenMetadata)

        # Create a basic config
        self.workflow_config = WorkflowConfig(
            openMetadataServerConfig=OpenMetadataConnection(
                hostPort="http://localhost:8585/api"
            )
        )

        self.app_config = {
            "sourcePythonClass": "test.MockAppRunner",
            "workflowConfig": self.workflow_config,
            "applicationFqn": MOCK_PIPELINE_FQN,
        }

    def test_retrieve_app_private_config_success(self):
        """Test successful retrieval of private config from API with dict"""
        # Mock app with dict private config
        mock_app = MagicMock()
        mock_app.privateConfiguration.root = {
            "waiiInstance": "http://localhost:9859/api/abc",
            "collateURL": "http://localhost:8585",
            "token": "test_token_123",
            "limits": {
                "billingCycleStart": "2024-10-23",
                "actions": {"descriptions": 10, "queries": 0},
            },
        }
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Verify app was fetched during init
        self.mock_metadata.get_by_name.assert_called()

        # Verify returned config from init
        self.assertIsNotNone(runner.private_config)
        self.assertEqual(
            runner.private_config["waiiInstance"], "http://localhost:9859/api/abc"
        )
        self.assertEqual(runner.private_config["collateURL"], "http://localhost:8585")
        self.assertEqual(
            runner.private_config["token"].get_secret_value(), "test_token_123"
        )
        self.assertEqual(
            runner.private_config["limits"]["billingCycleStart"], "2024-10-23"
        )

    def test_retrieve_app_private_config_with_secret_string(self):
        """Test successful retrieval of private config from API with _CustomSecretStr"""
        # Mock app with _CustomSecretStr private config
        mock_app = MagicMock()
        mock_secret_str = MagicMock(spec=_CustomSecretStr)
        mock_secret_str.get_secret_value.return_value = json.dumps(
            {
                "token": "test_token_456",
                "collateURL": "http://localhost:8585",
            }
        )
        mock_app.privateConfiguration.root = mock_secret_str
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Verify app was fetched during init
        self.mock_metadata.get_by_name.assert_called()

        # Verify returned config
        self.assertIsNotNone(runner.private_config)
        self.assertEqual(
            runner.private_config["token"].get_secret_value(), "test_token_456"
        )
        self.assertEqual(runner.private_config["collateURL"], "http://localhost:8585")

    def test_retrieve_app_private_config_with_dict(self):
        """Test when app is not found or has no private config"""
        # Mock app with no privateConfiguration
        mock_app = MagicMock()
        mock_app.privateConfiguration = None
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None when no privateConfiguration
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_with_none(self):
        """Test when applicationFqn is None"""
        # Create config without applicationFqn
        config_without_fqn = {
            "sourcePythonClass": "test.MockAppRunner",
            "workflowConfig": self.workflow_config,
        }
        config = OpenMetadataApplicationConfig.model_validate(config_without_fqn)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None when applicationFqn is not present
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_with_empty_string(self):
        """Test when private config root is not dict or _CustomSecretStr"""
        # Mock app with invalid privateConfiguration type (string)
        mock_app = MagicMock()
        mock_app.privateConfiguration.root = "some_string_value"
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None for invalid type
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_with_invalid_type(self):
        """Test when private config root is an invalid type (integer)"""
        # Mock app with invalid privateConfiguration type (integer)
        mock_app = MagicMock()
        mock_app.privateConfiguration.root = 123
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None for invalid type
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_no_secret_found(self):
        """Test when _CustomSecretStr returns None"""
        # Mock app with _CustomSecretStr that returns None
        mock_app = MagicMock()
        mock_secret_str = MagicMock(spec=_CustomSecretStr)
        mock_secret_str.get_secret_value.return_value = None
        mock_app.privateConfiguration.root = mock_secret_str
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None when secret value is None
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_json_error(self):
        """Test when _CustomSecretStr returns invalid JSON"""
        # Mock app with _CustomSecretStr that returns invalid JSON
        mock_app = MagicMock()
        mock_secret_str = MagicMock(spec=_CustomSecretStr)
        mock_secret_str.get_secret_value.return_value = "invalid json content"
        mock_app.privateConfiguration.root = mock_secret_str
        self.mock_metadata.get_by_name.return_value = mock_app

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None due to JSON parsing error
        self.assertIsNone(runner.private_config)

    def test_retrieve_app_private_config_exception(self):
        """Test when get_by_name raises an exception"""
        # Mock metadata.get_by_name to raise an exception
        self.mock_metadata.get_by_name.side_effect = Exception("API connection error")

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Should return None due to exception
        self.assertIsNone(runner.private_config)
