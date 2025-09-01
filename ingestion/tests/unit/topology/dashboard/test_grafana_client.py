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
Test Grafana API Client
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

import requests

from metadata.ingestion.source.dashboard.grafana.client import GrafanaApiClient
from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboardResponse,
    GrafanaDatasource,
    GrafanaSearchResult,
)


class TestGrafanaApiClient(TestCase):
    """Test cases for Grafana API Client"""

    def setUp(self):
        """Set up test client"""
        self.client = GrafanaApiClient(
            host_port="https://grafana.example.com",
            api_key="test_api_key",
            verify_ssl=True,
            page_size=2,
        )

    def test_session_initialization(self):
        """Test that session is properly initialized with headers"""
        session = self.client.session
        self.assertEqual(session.headers["Authorization"], "Bearer test_api_key")
        self.assertEqual(session.headers["Accept"], "application/json")
        self.assertEqual(session.headers["Content-Type"], "application/json")
        self.assertTrue(session.verify)

    @patch("requests.Session.request")
    def test_get_folders_pagination(self, mock_request):
        """Test fetching folders with pagination"""
        # Mock two pages of results
        page1_response = MagicMock()
        page1_response.json.return_value = [
            {"id": 1, "uid": "folder-1", "title": "Folder 1"},
            {"id": 2, "uid": "folder-2", "title": "Folder 2"},
        ]

        page2_response = MagicMock()
        page2_response.json.return_value = [
            {"id": 3, "uid": "folder-3", "title": "Folder 3"},
        ]

        mock_request.side_effect = [page1_response, page2_response]

        folders = self.client.get_folders()

        self.assertEqual(len(folders), 3)
        self.assertEqual(folders[0].title, "Folder 1")
        self.assertEqual(folders[2].title, "Folder 3")
        self.assertEqual(mock_request.call_count, 2)

    @patch("requests.Session.request")
    def test_search_dashboards(self, mock_request):
        """Test searching dashboards"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "id": 1,
                "uid": "dash-1",
                "title": "Dashboard 1",
                "uri": "db/dashboard-1",
                "url": "/d/dash-1/dashboard-1",
                "slug": "dashboard-1",
                "type": "dash-db",
                "tags": ["tag1"],
                "isStarred": False,
            }
        ]
        mock_request.return_value = mock_response

        dashboards = self.client.search_dashboards()

        self.assertEqual(len(dashboards), 1)
        self.assertIsInstance(dashboards[0], GrafanaSearchResult)
        self.assertEqual(dashboards[0].title, "Dashboard 1")

        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/search",
            timeout=30,
            params={"type": "dash-db", "page": 1, "limit": 2},
        )

    @patch("requests.Session.request")
    def test_search_dashboards_with_folder_filter(self, mock_request):
        """Test searching dashboards with folder filter"""
        mock_response = MagicMock()
        mock_response.json.return_value = []
        mock_request.return_value = mock_response

        self.client.search_dashboards(folder_id=5)

        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/search",
            timeout=30,
            params={"type": "dash-db", "page": 1, "limit": 2, "folderIds": 5},
        )

    @patch("requests.Session.request")
    def test_get_dashboard(self, mock_request):
        """Test fetching dashboard details"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "dashboard": {
                "id": 1,
                "uid": "test-uid",
                "title": "Test Dashboard",
                "tags": ["test"],
                "panels": [],
            },
            "meta": {
                "type": "db",
                "canSave": True,
                "canEdit": True,
                "canAdmin": True,
                "canStar": True,
                "canDelete": True,
                "slug": "test-dashboard",
                "url": "/d/test-uid/test-dashboard",
            },
        }
        mock_request.return_value = mock_response

        dashboard = self.client.get_dashboard("test-uid")

        self.assertIsInstance(dashboard, GrafanaDashboardResponse)
        self.assertEqual(dashboard.dashboard.title, "Test Dashboard")
        self.assertEqual(dashboard.meta.slug, "test-dashboard")

        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/dashboards/uid/test-uid",
            timeout=30,
        )

    @patch("requests.Session.request")
    def test_get_datasources(self, mock_request):
        """Test fetching datasources"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "id": 1,
                "uid": "postgres-uid",
                "name": "PostgreSQL",
                "type": "postgres",
                "url": "postgres:5432",
                "database": "mydb",
                "isDefault": True,
            },
            {
                "id": 2,
                "uid": "prom-uid",
                "name": "Prometheus",
                "type": "prometheus",
                "url": "http://prometheus:9090",
                "isDefault": False,
            },
        ]
        mock_request.return_value = mock_response

        datasources = self.client.get_datasources()

        self.assertEqual(len(datasources), 2)
        self.assertIsInstance(datasources[0], GrafanaDatasource)
        self.assertEqual(datasources[0].name, "PostgreSQL")
        self.assertEqual(datasources[1].type, "prometheus")

    @patch("requests.Session.request")
    def test_get_datasource_by_id(self, mock_request):
        """Test fetching datasource by ID"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": 1,
            "uid": "postgres-uid",
            "name": "PostgreSQL",
            "type": "postgres",
        }
        mock_request.return_value = mock_response

        datasource = self.client.get_datasource(1)

        self.assertIsInstance(datasource, GrafanaDatasource)
        self.assertEqual(datasource.name, "PostgreSQL")

        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/datasources/1",
            timeout=30,
        )

    @patch("requests.Session.request")
    def test_get_datasource_by_uid(self, mock_request):
        """Test fetching datasource by UID"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": 1,
            "uid": "postgres-uid",
            "name": "PostgreSQL",
            "type": "postgres",
        }
        mock_request.return_value = mock_response

        datasource = self.client.get_datasource("postgres-uid")

        self.assertIsInstance(datasource, GrafanaDatasource)
        self.assertEqual(datasource.uid, "postgres-uid")

        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/datasources/uid/postgres-uid",
            timeout=30,
        )

    @patch("requests.Session.request")
    def test_error_handling_401(self, mock_request):
        """Test handling 401 unauthorized error"""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
            response=mock_response
        )
        mock_request.return_value = mock_response

        result = self.client.get_folders()

        self.assertEqual(result, [])
        mock_request.assert_called_once()

    @patch("requests.Session.request")
    def test_error_handling_403(self, mock_request):
        """Test handling 403 forbidden error"""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
            response=mock_response
        )
        mock_request.return_value = mock_response

        result = self.client.get_dashboard("test-uid")

        self.assertIsNone(result)

    @patch("requests.Session.request")
    def test_error_handling_500(self, mock_request):
        """Test handling 500 server error"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
            response=mock_response
        )
        mock_request.return_value = mock_response

        result = self.client.get_datasources()

        self.assertEqual(result, [])

    @patch("requests.Session.request")
    def test_error_handling_generic_exception(self, mock_request):
        """Test handling generic exceptions"""
        mock_request.side_effect = Exception("Network error")

        result = self.client.search_dashboards()

        self.assertEqual(result, [])

    @patch("requests.Session.request")
    def test_test_connection_success(self, mock_request):
        """Test successful connection test"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"name": "My Organization"}
        mock_request.return_value = mock_response

        result = self.client.test_connection()

        self.assertTrue(result)
        mock_request.assert_called_once_with(
            method="GET",
            url="https://grafana.example.com/api/org",
            timeout=30,
        )

    @patch("requests.Session.request")
    def test_test_connection_failure(self, mock_request):
        """Test failed connection test"""
        mock_request.side_effect = Exception("Connection failed")

        result = self.client.test_connection()

        self.assertFalse(result)

    def test_close_session(self):
        """Test closing the HTTP session"""
        # Create a session first
        session = self.client.session
        self.assertIsNotNone(self.client._session)

        # Close the session
        self.client.close()
        self.assertIsNone(self.client._session)

    def test_ssl_verification_disabled(self):
        """Test client with SSL verification disabled"""
        client = GrafanaApiClient(
            host_port="https://grafana.example.com",
            api_key="test_api_key",
            verify_ssl=False,
            page_size=100,
        )

        session = client.session
        self.assertFalse(session.verify)
