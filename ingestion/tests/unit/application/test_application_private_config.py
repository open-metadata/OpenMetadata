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

        # Test retrieval
        private_config = runner._retrieve_app_private_config(
            "OpenMetadata.CollateAIApplication"
        )

        # Verify secrets manager was called with correct secret ID
        mock_secrets_manager.get_string_value.assert_called_with(
            "external-app-collateaiapplication-private-config"
        )

        # Verify returned config
        self.assertIsNotNone(private_config)
        self.assertEqual(
            private_config["waiiInstance"], "http://localhost:9859/api/abc"
        )
        self.assertEqual(private_config["collateURL"], "http://localhost:8585")
        self.assertEqual(private_config["token"].get_secret_value(), "test_token_123")
        self.assertEqual(private_config["limits"]["billingCycleStart"], "2024-10-23")
