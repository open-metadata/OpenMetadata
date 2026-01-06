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
Test Lightdash API Client functionality
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.dashboard.lightdashConnection import (
    LightdashConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.lightdash.client import LightdashApiClient


class TestLightdashApiClient(TestCase):
    """Test Lightdash API Client functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = LightdashConnection(
            type="Lightdash",
            hostPort="https://app.lightdash.cloud",
            apiKey="test_api_key_123456",
            projectUUID="project-uuid-123",
            spaceUUID="space-uuid-456",
        )

        # Create client with mocked REST client
        with patch("metadata.ingestion.source.dashboard.lightdash.client.REST"):
            self.client = LightdashApiClient(self.config)
            self.client.client = MagicMock()

    def test_client_initialization(self):
        """Test client initialization with correct config"""
        with patch(
            "metadata.ingestion.source.dashboard.lightdash.client.REST"
        ) as mock_rest:
            client = LightdashApiClient(self.config)

            # Verify REST client was initialized with correct config
            mock_rest.assert_called_once()
            call_args = mock_rest.call_args[0][0]

            self.assertEqual(call_args.base_url, "https://app.lightdash.cloud")
            self.assertEqual(call_args.api_version, "")
            self.assertEqual(call_args.auth_header, "Authorization")
            self.assertEqual(call_args.auth_token_mode, "ApiKey")

    def test_get_dashboards_list_success(self):
        """Test fetching dashboards with successful response"""
        mock_response = {
            "results": {
                "name": "Test Space",
                "dashboards": [
                    {
                        "organizationUuid": "org-uuid-1",
                        "name": "Dashboard 1",
                        "uuid": "dash-uuid-1",
                        "projectUuid": "project-uuid-123",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "spaceUuid": "space-uuid-456",
                        "views": 10,
                        "firstViewedAt": "2024-01-01T00:00:00Z",
                    },
                    {
                        "organizationUuid": "org-uuid-1",
                        "name": "Dashboard 2",
                        "uuid": "dash-uuid-2",
                        "projectUuid": "project-uuid-123",
                        "updatedAt": "2024-01-02T00:00:00Z",
                        "spaceUuid": "space-uuid-456",
                        "views": 5,
                        "firstViewedAt": "2024-01-02T00:00:00Z",
                    },
                ],
            }
        }

        # Mock add_dashboard_lineage to avoid additional API calls
        self.client.add_dashboard_lineage = MagicMock()
        self.client.client.get = MagicMock(return_value=mock_response)

        dashboards = self.client.get_dashboards_list()

        self.assertEqual(len(dashboards), 2)
        self.assertEqual(dashboards[0].name, "Dashboard 1")
        self.assertEqual(dashboards[0].uuid, "dash-uuid-1")
        self.assertEqual(dashboards[0].spaceName, "Test Space")
        self.assertEqual(dashboards[1].name, "Dashboard 2")

        # Verify add_dashboard_lineage was called
        self.client.add_dashboard_lineage.assert_called_once()

    def test_get_dashboards_list_empty_dashboards(self):
        """Test fetching dashboards when no dashboards exist"""
        mock_response = {
            "results": {
                "name": "Empty Space",
                "dashboards": [],
            }
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        dashboards = self.client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    def test_get_dashboards_list_no_results(self):
        """Test fetching dashboards when API returns no results"""
        mock_response = {"results": None}

        self.client.client.get = MagicMock(return_value=mock_response)

        dashboards = self.client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    def test_get_dashboards_list_api_error(self):
        """Test handling API errors when fetching dashboards"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        dashboards = self.client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    def test_get_dashboards_list_network_error(self):
        """Test handling network errors when fetching dashboards"""
        self.client.client.get = MagicMock(
            side_effect=ConnectionError("Network unreachable")
        )

        dashboards = self.client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    def test_get_dashboards_list_test_conn_success(self):
        """Test test connection method with successful response"""
        mock_response = {
            "results": {
                "name": "Test Space",
                "dashboards": [
                    {
                        "organizationUuid": "org-uuid-1",
                        "name": "Dashboard 1",
                        "uuid": "dash-uuid-1",
                        "projectUuid": "project-uuid-123",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "spaceUuid": "space-uuid-456",
                        "views": 10,
                        "firstViewedAt": "2024-01-01T00:00:00Z",
                    }
                ],
            }
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        dashboards = self.client.get_dashboards_list_test_conn()

        self.assertEqual(len(dashboards), 1)
        self.assertEqual(dashboards[0].name, "Dashboard 1")

    def test_get_dashboards_list_test_conn_no_results_raises_error(self):
        """Test test connection method raises error when API returns no results"""
        mock_response = {"results": None}

        self.client.client.get = MagicMock(return_value=mock_response)

        with self.assertRaises(ValueError) as context:
            self.client.get_dashboards_list_test_conn()

        error_message = str(context.exception)
        self.assertIn("Failed to fetch dashboard list", error_message)
        self.assertIn("project-uuid-123", error_message)
        self.assertIn("space-uuid-456", error_message)

    def test_get_dashboards_list_test_conn_api_error_raises(self):
        """Test test connection method raises API errors"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        with self.assertRaises(APIError):
            self.client.get_dashboards_list_test_conn()

    def test_get_dashboards_list_test_conn_network_error_raises(self):
        """Test test connection method raises network errors"""
        self.client.client.get = MagicMock(
            side_effect=ConnectionError("Network unreachable")
        )

        with self.assertRaises(ConnectionError):
            self.client.get_dashboards_list_test_conn()

    def test_get_dashboards_list_test_conn_empty_dashboards(self):
        """Test test connection method with empty dashboards (should succeed)"""
        mock_response = {
            "results": {
                "name": "Empty Space",
                "dashboards": [],
            }
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        dashboards = self.client.get_dashboards_list_test_conn()

        # Empty dashboards is a valid response, not an error
        self.assertEqual(len(dashboards), 0)

    def test_get_spaces_success(self):
        """Test fetching spaces with successful response"""
        mock_response = {
            "results": [
                {
                    "organizationUuid": "org-uuid-1",
                    "projectUuid": "project-uuid-123",
                    "uuid": "space-uuid-1",
                    "name": "Space 1",
                    "isPrivate": False,
                },
                {
                    "organizationUuid": "org-uuid-1",
                    "projectUuid": "project-uuid-123",
                    "uuid": "space-uuid-2",
                    "name": "Space 2",
                    "isPrivate": True,
                },
            ]
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        spaces = self.client.get_spaces()

        self.assertEqual(len(spaces), 2)
        self.assertEqual(spaces[0].name, "Space 1")
        self.assertEqual(spaces[1].name, "Space 2")

    def test_get_spaces_empty_response(self):
        """Test fetching spaces with empty response"""
        mock_response = {"results": []}

        self.client.client.get = MagicMock(return_value=mock_response)

        spaces = self.client.get_spaces()

        self.assertEqual(len(spaces), 0)

    def test_get_spaces_api_error(self):
        """Test handling API errors when fetching spaces"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        spaces = self.client.get_spaces()

        self.assertEqual(len(spaces), 0)

    def test_get_charts_list_success(self):
        """Test fetching charts with successful response"""
        mock_response = {
            "results": [
                {
                    "name": "Chart 1",
                    "organizationUuid": "org-uuid-1",
                    "uuid": "chart-uuid-1",
                    "projectUuid": "project-uuid-123",
                    "spaceUuid": "space-uuid-456",
                    "spaceName": "Test Space",
                },
                {
                    "name": "Chart 2",
                    "organizationUuid": "org-uuid-1",
                    "uuid": "chart-uuid-2",
                    "projectUuid": "project-uuid-123",
                    "spaceUuid": "space-uuid-456",
                    "spaceName": "Test Space",
                },
            ]
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        charts = self.client.get_charts_list()

        self.assertEqual(len(charts), 2)
        self.assertEqual(charts[0].name, "Chart 1")
        self.assertEqual(charts[1].name, "Chart 2")

    def test_get_charts_list_api_error(self):
        """Test handling API errors when fetching charts"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        charts = self.client.get_charts_list()

        self.assertEqual(len(charts), 0)

    def test_get_project_name_success(self):
        """Test fetching project name with successful response"""
        mock_response = {"results": {"name": "Test Project"}}

        self.client.client.get = MagicMock(return_value=mock_response)

        project_name = self.client.get_project_name("project-uuid-123")

        self.assertEqual(project_name, "Test Project")

    def test_get_project_name_api_error(self):
        """Test handling API errors when fetching project name"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        project_name = self.client.get_project_name("project-uuid-123")

        self.assertEqual(project_name, "")


if __name__ == "__main__":
    import unittest

    unittest.main()
