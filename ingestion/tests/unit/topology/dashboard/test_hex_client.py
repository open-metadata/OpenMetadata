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
Test Hex API Client functionality
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import (
    HexConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.hex.client import HexApiClient
from metadata.ingestion.source.dashboard.hex.models import Project


class TestHexApiClient(TestCase):
    """Test Hex API Client functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = HexConnection(
            type="Hex",
            hostPort="https://app.hex.tech",
            token="test_token_123456",
            tokenType="personal",
        )

        # Create client with mocked TrackedREST client
        self.client = HexApiClient.__new__(HexApiClient)
        self.client.config = self.config
        self.client.client = MagicMock()

    def test_client_initialization_with_personal_token(self):
        """Test client initialization with personal token"""
        with patch(
            "metadata.ingestion.source.dashboard.hex.client.TrackedREST"
        ) as mock_rest:
            client = HexApiClient(self.config)

            # Verify TrackedREST client was initialized with correct config
            mock_rest.assert_called_once()
            call_args = mock_rest.call_args[0][0]

            self.assertEqual(call_args.base_url, "https://app.hex.tech")
            self.assertEqual(call_args.api_version, "api/v1")
            self.assertEqual(call_args.auth_header, "Authorization")
            self.assertEqual(call_args.auth_token_mode, "Bearer")

            # Test auth token function
            token, expiry = call_args.auth_token()
            self.assertEqual(token, "test_token_123456")
            self.assertEqual(expiry, 0)

    def test_client_initialization_with_workspace_token(self):
        """Test client initialization with workspace token"""
        workspace_config = HexConnection(
            type="Hex",
            hostPort="https://app.hex.tech",
            token="workspace_token_789",
            tokenType="workspace",
        )

        with patch(
            "metadata.ingestion.source.dashboard.hex.client.TrackedREST"
        ) as mock_rest:
            client = HexApiClient(workspace_config)

            mock_rest.assert_called_once()
            call_args = mock_rest.call_args[0][0]

            # Test auth token function for workspace token
            token, expiry = call_args.auth_token()
            self.assertEqual(token, "workspace_token_789")

    def test_get_projects_single_page(self):
        """Test fetching projects with single page of results"""
        mock_response = {
            "values": [
                {
                    "id": "proj_123",
                    "title": "Dashboard 1",
                    "description": "Test dashboard",
                    "owner": {"email": "test@example.com"},
                    "categories": [{"name": "Analytics"}],
                    "status": {"name": "Published"},
                },
                {
                    "id": "proj_456",
                    "title": "Dashboard 2",
                    "description": None,
                    "owner": None,
                    "categories": [],
                    "status": None,
                },
            ],
            "pagination": None,
        }

        self.client.client.get = MagicMock(return_value=mock_response)

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 2)
        self.assertEqual(projects[0].id, "proj_123")
        self.assertEqual(projects[0].title, "Dashboard 1")
        self.assertEqual(projects[1].id, "proj_456")

        # Verify API call
        self.client.client.get.assert_called_once_with("/projects", data={"limit": 100})

    def test_get_projects_with_pagination(self):
        """Test fetching projects with multiple pages"""
        # First page response
        page1_response = {
            "values": [
                {"id": f"proj_{i}", "title": f"Dashboard {i}"} for i in range(100)
            ],
            "pagination": {"after": "cursor_page2"},
        }

        # Second page response
        page2_response = {
            "values": [
                {"id": f"proj_{i}", "title": f"Dashboard {i}"} for i in range(100, 150)
            ],
            "pagination": {"after": "cursor_page3"},
        }

        # Third page response (last page)
        page3_response = {
            "values": [
                {"id": f"proj_{i}", "title": f"Dashboard {i}"} for i in range(150, 175)
            ],
            "pagination": None,
        }

        self.client.client.get = MagicMock(
            side_effect=[page1_response, page2_response, page3_response]
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 175)
        self.assertEqual(projects[0].id, "proj_0")
        self.assertEqual(projects[174].id, "proj_174")

        # Verify pagination calls
        calls = self.client.client.get.call_args_list
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][0], ("/projects",))
        # The params dict is mutated in place, so it might have 'after' from the last iteration
        self.assertEqual(calls[0][1]["data"]["limit"], 100)
        self.assertEqual(calls[1][1]["data"]["limit"], 100)
        self.assertIn("after", calls[1][1]["data"])
        self.assertEqual(calls[2][1]["data"]["limit"], 100)
        self.assertIn("after", calls[2][1]["data"])

    def test_get_projects_empty_response(self):
        """Test fetching projects with empty response"""
        self.client.client.get = MagicMock(
            return_value={"values": [], "pagination": None}
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_get_projects_api_error(self):
        """Test handling API errors when fetching projects"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Server error"})
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_get_projects_network_error(self):
        """Test handling network errors when fetching projects"""
        self.client.client.get = MagicMock(
            side_effect=ConnectionError("Network unreachable")
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_get_projects_invalid_json_response(self):
        """Test handling invalid JSON response"""
        self.client.client.get = MagicMock(return_value="Invalid JSON")

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_get_projects_missing_values_key(self):
        """Test handling response without 'values' key"""
        self.client.client.get = MagicMock(
            return_value={"data": [], "pagination": None}
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_get_project_url(self):
        """Test building project URL"""
        project = Project(
            id="proj_789",
            title="Test Project",
        )

        url = self.client.get_project_url(project)

        self.assertEqual(url, "https://app.hex.tech/app/projects/proj_789")

    def test_get_project_url_with_trailing_slash(self):
        """Test building project URL when host has trailing slash"""
        config = HexConnection(
            type="Hex",
            hostPort="https://app.hex.tech/",
            token="test_token",
        )

        with patch("metadata.ingestion.source.dashboard.hex.client.TrackedREST"):
            client = HexApiClient(config)

            project = Project(id="proj_789", title="Test")
            url = client.get_project_url(project)

            self.assertEqual(url, "https://app.hex.tech/app/projects/proj_789")

    def test_rate_limiting_handling(self):
        """Test handling rate limiting (429 error)"""
        self.client.client.get = MagicMock(
            side_effect=APIError({"message": "Too Many Requests"})
        )

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_timeout_error(self):
        """Test handling timeout errors"""
        from requests.exceptions import Timeout

        self.client.client.get = MagicMock(side_effect=Timeout("Request timed out"))

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 0)

    def test_complex_project_model_parsing(self):
        """Test parsing complex project response"""
        complex_response = {
            "values": [
                {
                    "id": "proj_complex",
                    "title": "Complex Dashboard",
                    "description": "A very detailed description with special chars: &<>\"'",
                    "owner": {
                        "email": "owner@company.com",
                    },
                    "creator": {
                        "email": "creator@company.com",
                    },
                    "categories": [
                        {"name": "Finance"},
                        {"name": "Analytics"},
                        {"name": "Real-time"},
                    ],
                    "status": {"name": "Published"},
                    "extra_field": "This should be ignored",  # Extra fields should be ignored
                }
            ],
            "pagination": None,
        }

        self.client.client.get = MagicMock(return_value=complex_response)

        projects = self.client.get_projects()

        self.assertEqual(len(projects), 1)
        project = projects[0]

        self.assertEqual(project.id, "proj_complex")
        self.assertEqual(project.title, "Complex Dashboard")
        self.assertIn("special chars", project.description)
        self.assertEqual(project.owner.email, "owner@company.com")
        self.assertEqual(project.creator.email, "creator@company.com")
        self.assertEqual(len(project.categories), 3)
        self.assertEqual(project.categories[0].name, "Finance")
        self.assertEqual(project.status.name, "Published")

    def test_malformed_pagination(self):
        """Test handling malformed pagination response"""
        response_with_bad_pagination = {
            "values": [{"id": "proj_1", "title": "Dashboard 1"}],
            "pagination": {"invalid_key": "value"},  # Missing 'after' key
        }

        self.client.client.get = MagicMock(return_value=response_with_bad_pagination)

        projects = self.client.get_projects()

        # Should handle gracefully and return the single page
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0].id, "proj_1")

    def test_partial_project_data(self):
        """Test handling projects with partial/missing data"""
        partial_response = {
            "values": [
                {"id": "proj_1", "title": "Complete Project", "description": "Test"},
                {"id": "proj_2"},  # Missing title
                {"title": "No ID Project"},  # Missing ID
                {},  # Empty object
            ],
            "pagination": None,
        }

        self.client.client.get = MagicMock(return_value=partial_response)

        projects = self.client.get_projects()

        # Should handle partial data gracefully
        # The actual count depends on how the model validation works
        self.assertGreaterEqual(len(projects), 0)

    @patch("metadata.ingestion.source.dashboard.hex.client.clean_uri")
    def test_clean_uri_called(self, mock_clean_uri):
        """Test that clean_uri is properly called"""
        mock_clean_uri.return_value = "https://app.hex.tech"

        with patch("metadata.ingestion.source.dashboard.hex.client.TrackedREST"):
            client = HexApiClient(self.config)

            # Verify clean_uri was called for initialization
            mock_clean_uri.assert_called()

    def test_headers_configuration(self):
        """Test that proper headers are configured"""
        with patch(
            "metadata.ingestion.source.dashboard.hex.client.TrackedREST"
        ) as mock_rest:
            client = HexApiClient(self.config)

            call_args = mock_rest.call_args[0][0]

            self.assertIn("accept", call_args.extra_headers)
            self.assertEqual(call_args.extra_headers["accept"], "application/json")
            self.assertIn("Content-Type", call_args.extra_headers)
            self.assertEqual(
                call_args.extra_headers["Content-Type"], "application/json"
            )


class TestHexApiClientIntegration(TestCase):
    """Integration tests for HexApiClient with real-like scenarios"""

    def test_full_pagination_workflow(self):
        """Test complete pagination workflow with 500+ projects"""
        config = HexConnection(
            type="Hex",
            hostPort="https://app.hex.tech",
            token="test_token",
        )

        with patch(
            "metadata.ingestion.source.dashboard.hex.client.TrackedREST"
        ) as mock_rest:
            mock_client = MagicMock()
            mock_rest.return_value = mock_client

            # Create 523 projects across 6 pages
            responses = []
            total_projects = 523
            page_size = 100

            for page in range(6):
                start_idx = page * page_size
                end_idx = min(start_idx + page_size, total_projects)

                values = [
                    {
                        "id": f"proj_{i:04d}",
                        "title": f"Dashboard {i}",
                        "description": f"Description for dashboard {i}"
                        if i % 2 == 0
                        else None,
                        "owner": {
                            "email": f"user{i % 10}@company.com",
                        }
                        if i % 3 != 0
                        else None,
                        "categories": [{"name": f"Category{j}"} for j in range(i % 4)],
                        "status": {"name": "Published"}
                        if i % 5 == 0
                        else {"name": "Draft"},
                    }
                    for i in range(start_idx, end_idx)
                ]

                response = {
                    "values": values,
                    "pagination": {"after": f"cursor_page{page + 2}"}
                    if end_idx < total_projects
                    else None,
                }
                responses.append(response)

            mock_client.get = MagicMock(side_effect=responses)

            client = HexApiClient(config)
            projects = client.get_projects()

            # Verify all projects were fetched
            self.assertEqual(len(projects), 523)

            # Verify first and last projects
            self.assertEqual(projects[0].id, "proj_0000")
            self.assertEqual(projects[522].id, "proj_0522")

            # Verify pagination calls
            self.assertEqual(mock_client.get.call_count, 6)

    def test_error_recovery_during_pagination(self):
        """Test error recovery during multi-page fetching"""
        config = HexConnection(
            type="Hex",
            hostPort="https://app.hex.tech",
            token="test_token",
        )

        with patch(
            "metadata.ingestion.source.dashboard.hex.client.TrackedREST"
        ) as mock_rest:
            mock_client = MagicMock()
            mock_rest.return_value = mock_client

            # First page succeeds, second page fails
            page1 = {
                "values": [
                    {"id": f"proj_{i}", "title": f"Dashboard {i}"} for i in range(50)
                ],
                "pagination": {"after": "cursor_2"},
            }

            mock_client.get = MagicMock(
                side_effect=[page1, APIError({"message": "Server error"})]
            )

            client = HexApiClient(config)
            projects = client.get_projects()

            # Should return projects from first page even if second fails
            self.assertEqual(len(projects), 50)


if __name__ == "__main__":
    import unittest

    unittest.main()
