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
Test Lightdash API Client
"""

from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch

import requests

from metadata.generated.schema.entity.services.connections.dashboard.lightdashConnection import (
    LightdashConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.lightdash.client import LightdashApiClient
from metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashDashboard,
)


class TestLightdashApiClient(TestCase):
    """Test cases for Lightdash API Client"""

    def setUp(self):
        """Set up test client"""
        mock_config = LightdashConnection(
            hostPort="https://lightdash.example.com",
            apiKey="test_api_key",
            projectUUID="test-project-uuid",
            spaceUUID="test-space-uuid",
        )
        self.client = LightdashApiClient(mock_config)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_success(self, mock_rest):
        """Test successful dashboard list retrieval"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": {
                "name": "Test Space",
                "dashboards": [
                    {
                        "organizationUuid": "org-1",
                        "name": "Dashboard 1",
                        "uuid": "dash-1",
                        "projectUuid": "test-project-uuid",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "spaceUuid": "test-space-uuid",
                        "views": 100.0,
                        "firstViewedAt": "2024-01-01T00:00:00Z",
                    },
                    {
                        "organizationUuid": "org-1",
                        "name": "Dashboard 2",
                        "uuid": "dash-2",
                        "projectUuid": "test-project-uuid",
                        "updatedAt": "2024-01-02T00:00:00Z",
                        "spaceUuid": "test-space-uuid",
                        "views": 50.0,
                        "firstViewedAt": "2024-01-01T00:00:00Z",
                    },
                ],
            }
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)
        client.add_dashboard_lineage = MagicMock()

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 2)
        self.assertIsInstance(dashboards[0], LightdashDashboard)
        self.assertEqual(dashboards[0].name, "Dashboard 1")
        self.assertEqual(dashboards[0].spaceName, "Test Space")
        self.assertEqual(dashboards[1].name, "Dashboard 2")
        client.add_dashboard_lineage.assert_called_once()

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_empty_space(self, mock_rest):
        """Test dashboard list retrieval when space is empty"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": {
                "name": "Empty Space",
                "dashboards": [],
            }
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_no_results_key(self, mock_rest):
        """Test dashboard list retrieval when API returns no 'results' key"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {"status": "error", "message": "Invalid request"}

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_no_dashboards_key(self, mock_rest):
        """Test dashboard list retrieval when results has no 'dashboards' key"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": {
                "name": "Test Space",
                "uuid": "space-uuid",
            }
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_exception_handling(self, mock_rest):
        """Test dashboard list retrieval handles exceptions gracefully"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=Exception("Network error"))

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_success(self, mock_rest):
        """Test test_get_dashboards_list with successful response"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": {
                "name": "Test Space",
                "dashboards": [
                    {
                        "organizationUuid": "org-1",
                        "name": "Dashboard 1",
                        "uuid": "dash-1",
                        "projectUuid": "test-project-uuid",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "spaceUuid": "test-space-uuid",
                        "views": 100.0,
                        "firstViewedAt": "2024-01-01T00:00:00Z",
                    }
                ],
            }
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)
        client.add_dashboard_lineage = MagicMock()

        dashboards = client.test_get_dashboards_list()

        self.assertEqual(len(dashboards), 1)
        self.assertEqual(dashboards[0].name, "Dashboard 1")

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_no_results_returns_empty(self, mock_rest):
        """Test test_get_dashboards_list returns empty list when no 'results' key"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {"status": "error"}

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        dashboards = client.test_get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_raises_on_no_name(self, mock_rest):
        """Test test_get_dashboards_list raises KeyError when no 'name' field"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {"results": {"uuid": "space-uuid", "dashboards": []}}

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        with self.assertRaises(KeyError):
            client.test_get_dashboards_list()

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_raises_on_no_dashboards(self, mock_rest):
        """Test test_get_dashboards_list raises KeyError when no 'dashboards' key"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {"results": {"name": "Test Space", "uuid": "space-uuid"}}

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        with self.assertRaises(KeyError):
            client.test_get_dashboards_list()

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_propagates_exceptions(self, mock_rest):
        """Test test_get_dashboards_list propagates exceptions from client.get()"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(
            side_effect=Exception("404 Not Found: Space does not exist")
        )

        with self.assertRaises(Exception) as context:
            client.test_get_dashboards_list()

        self.assertIn("404 Not Found", str(context.exception))

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_invalid_dashboard_data_fails(self, mock_rest):
        """Test get_dashboards_list returns empty when dashboard data is invalid"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": {
                "name": "Test Space",
                "dashboards": [
                    {
                        "name": "Invalid Dashboard - Missing Required Fields",
                        "uuid": "dash-2",
                    },
                ],
            }
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_charts_list_success(self, mock_rest):
        """Test successful chart list retrieval"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": [
                {
                    "name": "Chart 1",
                    "organizationUuid": "org-1",
                    "uuid": "chart-1",
                    "projectUuid": "test-project-uuid",
                    "spaceUuid": "test-space-uuid",
                    "spaceName": "Test Space",
                }
            ]
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        charts = client.get_charts_list()

        self.assertEqual(len(charts), 1)
        self.assertIsInstance(charts[0], LightdashChart)
        self.assertEqual(charts[0].name, "Chart 1")

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_spaces_success(self, mock_rest):
        """Test successful spaces list retrieval"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {
            "results": [
                {
                    "organizationUuid": "org-1",
                    "projectUuid": "test-project-uuid",
                    "uuid": "space-1",
                    "name": "Space 1",
                    "isPrivate": False,
                }
            ]
        }

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        spaces = client.get_spaces()

        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].name, "Space 1")

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_project_name_success(self, mock_rest):
        """Test successful project name retrieval"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = {"results": {"name": "Test Project", "uuid": "project-uuid"}}

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(return_value=mock_response)

        project_name = client.get_project_name("project-uuid")

        self.assertEqual(project_name, "Test Project")

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_project_name_exception(self, mock_rest):
        """Test project name retrieval handles exceptions"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=Exception("API Error"))

        project_name = client.get_project_name("project-uuid")

        self.assertEqual(project_name, "")

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_http_404_error(self, mock_rest):
        """Test test_get_dashboards_list propagates HTTPError for 404"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Space not found"
        http_error = requests.exceptions.HTTPError(response=mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=http_error)

        with self.assertRaises(requests.exceptions.HTTPError) as context:
            client.test_get_dashboards_list()

        self.assertEqual(context.exception.response.status_code, 404)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_http_401_error(self, mock_rest):
        """Test test_get_dashboards_list propagates HTTPError for 401 unauthorized"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        http_error = requests.exceptions.HTTPError(response=mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=http_error)

        with self.assertRaises(requests.exceptions.HTTPError) as context:
            client.test_get_dashboards_list()

        self.assertEqual(context.exception.response.status_code, 401)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_http_403_error(self, mock_rest):
        """Test test_get_dashboards_list propagates HTTPError for 403 forbidden"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden - insufficient permissions"
        http_error = requests.exceptions.HTTPError(response=mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=http_error)

        with self.assertRaises(requests.exceptions.HTTPError) as context:
            client.test_get_dashboards_list()

        self.assertEqual(context.exception.response.status_code, 403)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_http_500_error(self, mock_rest):
        """Test test_get_dashboards_list propagates HTTPError for 500 server error"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        http_error = requests.exceptions.HTTPError(response=mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=http_error)

        with self.assertRaises(requests.exceptions.HTTPError) as context:
            client.test_get_dashboards_list()

        self.assertEqual(context.exception.response.status_code, 500)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_test_get_dashboards_list_api_error(self, mock_rest):
        """Test test_get_dashboards_list propagates APIError"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 400
        api_error = APIError(
            {"code": 400, "message": "Invalid project or space UUID"}, mock_response
        )

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=api_error)

        with self.assertRaises(APIError) as context:
            client.test_get_dashboards_list()

        self.assertEqual(context.exception.code, 400)
        self.assertIn("Invalid project or space UUID", str(context.exception))

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_handles_http_errors_gracefully(self, mock_rest):
        """Test get_dashboards_list handles HTTPError gracefully in ingestion mode"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 500
        http_error = requests.exceptions.HTTPError(response=mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=http_error)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)

    @patch("metadata.ingestion.source.dashboard.lightdash.client.REST")
    def test_get_dashboards_list_handles_api_errors_gracefully(self, mock_rest):
        """Test get_dashboards_list handles APIError gracefully in ingestion mode"""
        mock_rest_instance = Mock()
        mock_rest.return_value = mock_rest_instance

        mock_response = Mock()
        mock_response.status_code = 400
        api_error = APIError({"code": 400, "message": "Bad request"}, mock_response)

        client = LightdashApiClient(self.client.config)
        client.client = mock_rest_instance
        client.client.get = MagicMock(side_effect=api_error)

        dashboards = client.get_dashboards_list()

        self.assertEqual(len(dashboards), 0)
