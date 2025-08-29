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
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
from metadata.workflow.application import AppRunner


class MockAppRunner(AppRunner):
    """Mock AppRunner for testing"""

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
            "ingestionPipelineFQN": "OpenMetadata.CollateAIApplication",
        }

    @patch.object(SecretsManagerFactory, "get_secrets_manager")
    def test_retrieve_app_private_config_success(self, mock_get_secrets_manager):
        """Test successful retrieval of private config from secrets manager"""
        # Mock secrets manager
        mock_secrets_manager = MagicMock()
        mock_secrets_manager.get_string_value.return_value = json.dumps(
            {
                "waiiInstance": "http://localhost:9859/api/abc",
                "collateURL": "http://localhost:8585",
                "token": "test_token_123",
                "limits": {
                    "billingCycleStart": "2024-10-23",
                    "actions": {"descriptions": 10, "queries": 0},
                },
            }
        )
        mock_get_secrets_manager.return_value = mock_secrets_manager

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test retrieval with secret key
        secret_key = "external-app-collateaiapplication-private-config"
        private_config = runner._retrieve_app_private_config(secret_key)

        # Verify secrets manager was called with correct secret ID
        mock_secrets_manager.get_string_value.assert_called_with(secret_key)

        # Verify returned config
        self.assertIsNotNone(private_config)
        self.assertEqual(
            private_config["waiiInstance"], "http://localhost:9859/api/abc"
        )
        self.assertEqual(private_config["collateURL"], "http://localhost:8585")
        self.assertEqual(private_config["token"].get_secret_value(), "test_token_123")
        self.assertEqual(private_config["limits"]["billingCycleStart"], "2024-10-23")

    @patch.object(SecretsManagerFactory, "get_secrets_manager")
    def test_retrieve_app_private_config_with_secret_prefix(
        self, mock_get_secrets_manager
    ):
        """Test successful retrieval of private config with secret: prefix"""
        # Mock secrets manager
        mock_secrets_manager = MagicMock()
        mock_secrets_manager.get_string_value.return_value = json.dumps(
            {
                "token": "test_token_456",
                "collateURL": "http://localhost:8585",
            }
        )
        mock_get_secrets_manager.return_value = mock_secrets_manager

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test retrieval with secret: prefix
        secret_key_with_prefix = "secret:my-app-private-config"
        private_config = runner._retrieve_app_private_config(secret_key_with_prefix)

        # Verify secrets manager was called with secret key without prefix
        mock_secrets_manager.get_string_value.assert_called_with(
            "my-app-private-config"
        )

        # Verify returned config
        self.assertIsNotNone(private_config)
        self.assertEqual(private_config["token"].get_secret_value(), "test_token_456")

    def test_retrieve_app_private_config_with_dict(self):
        """Test when private config is already a dictionary"""
        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test with dictionary input
        dict_config = {
            "token": "test_token_789",
            "collateURL": "http://localhost:8585",
        }
        private_config = runner._retrieve_app_private_config(dict_config)

        # Should return the same dictionary
        self.assertEqual(private_config, dict_config)

    def test_retrieve_app_private_config_with_none(self):
        """Test when private config is None"""
        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test with None input
        private_config = runner._retrieve_app_private_config(None)

        # Should return None
        self.assertIsNone(private_config)

    def test_retrieve_app_private_config_with_empty_string(self):
        """Test when private config is empty string"""
        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test with empty string
        private_config = runner._retrieve_app_private_config("")

        # Should return None
        self.assertIsNone(private_config)

    def test_retrieve_app_private_config_with_invalid_type(self):
        """Test when private config has invalid type"""
        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test with invalid type (integer)
        private_config = runner._retrieve_app_private_config(123)

        # Should return None
        self.assertIsNone(private_config)

    @patch.object(SecretsManagerFactory, "get_secrets_manager")
    def test_retrieve_app_private_config_no_secret_found(
        self, mock_get_secrets_manager
    ):
        """Test when no secret is found in secrets manager"""
        # Mock secrets manager to return None
        mock_secrets_manager = MagicMock()
        mock_secrets_manager.get_string_value.return_value = None
        mock_get_secrets_manager.return_value = mock_secrets_manager

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test retrieval when secret doesn't exist
        private_config = runner._retrieve_app_private_config("non-existent-secret")

        # Should return None
        self.assertIsNone(private_config)

    @patch.object(SecretsManagerFactory, "get_secrets_manager")
    def test_retrieve_app_private_config_json_error(self, mock_get_secrets_manager):
        """Test when secrets manager returns invalid JSON"""
        # Mock secrets manager to return invalid JSON
        mock_secrets_manager = MagicMock()
        mock_secrets_manager.get_string_value.return_value = "invalid json content"
        mock_get_secrets_manager.return_value = mock_secrets_manager

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test retrieval with invalid JSON
        private_config = runner._retrieve_app_private_config("secret-with-invalid-json")

        # Should return None due to JSON parsing error
        self.assertIsNone(private_config)

    @patch.object(SecretsManagerFactory, "get_secrets_manager")
    def test_retrieve_app_private_config_exception(self, mock_get_secrets_manager):
        """Test when secrets manager raises an exception"""
        # Mock secrets manager to raise an exception
        mock_secrets_manager = MagicMock()
        mock_secrets_manager.get_string_value.side_effect = Exception(
            "Connection error"
        )
        mock_get_secrets_manager.return_value = mock_secrets_manager

        config = OpenMetadataApplicationConfig.model_validate(self.app_config)
        runner = MockAppRunner(config=config, metadata=self.mock_metadata)

        # Test retrieval when exception occurs
        private_config = runner._retrieve_app_private_config("secret-key")

        # Should return None due to exception
        self.assertIsNone(private_config)
