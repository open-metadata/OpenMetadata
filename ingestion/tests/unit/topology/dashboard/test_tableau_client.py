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
Test Tableau Client - Owner retrieval functionality
"""

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.ingestion.source.dashboard.tableau.client import (
    TableauClient,
    TableauOwnersNotFound,
)
from metadata.ingestion.source.dashboard.tableau.models import TableauOwner


class TestTableauClientOwner(TestCase):
    """Test cases for Tableau Client owner retrieval"""

    def setUp(self):
        """Set up test client with mocked Tableau server"""
        # Mock the Server and its authentication
        with patch(
            "metadata.ingestion.source.dashboard.tableau.client.Server"
        ) as mock_server:
            mock_server_instance = MagicMock()
            mock_server.return_value = mock_server_instance
            mock_server_instance.auth = MagicMock()
            mock_server_instance.users = MagicMock()

            mock_config = SimpleNamespace(
                hostPort="http://localhost",
                apiVersion=None,
                siteName="test_site",
            )

            self.client = TableauClient(
                tableau_server_auth=MagicMock(),
                config=mock_config,
                verify_ssl=False,
                pagination_limit=100,
            )

    def test_get_tableau_owner_with_email(self):
        """Test that owner is returned when email is present"""
        mock_owner = MagicMock()
        mock_owner.id = "owner-123"
        mock_owner.name = "Test Owner"
        mock_owner.email = "owner@example.com"

        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        result = self.client.get_tableau_owner("owner-123")

        self.assertIsNotNone(result)
        self.assertIsInstance(result, TableauOwner)
        self.assertEqual(result.id, "owner-123")
        self.assertEqual(result.name, "Test Owner")
        self.assertEqual(result.email, "owner@example.com")

    def test_get_tableau_owner_without_email(self):
        """Test that owner is returned even when email is missing (None)"""
        mock_owner = MagicMock()
        mock_owner.id = "owner-456"
        mock_owner.name = "No Email Owner"
        mock_owner.email = None

        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        result = self.client.get_tableau_owner("owner-456")

        self.assertIsNotNone(result)
        self.assertIsInstance(result, TableauOwner)
        self.assertEqual(result.id, "owner-456")
        self.assertEqual(result.name, "No Email Owner")
        self.assertIsNone(result.email)

    def test_get_tableau_owner_with_empty_email(self):
        """Test that owner is returned even when email is empty string"""
        mock_owner = MagicMock()
        mock_owner.id = "owner-789"
        mock_owner.name = "Empty Email Owner"
        mock_owner.email = ""

        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        result = self.client.get_tableau_owner("owner-789")

        self.assertIsNotNone(result)
        self.assertIsInstance(result, TableauOwner)
        self.assertEqual(result.id, "owner-789")
        self.assertEqual(result.name, "Empty Email Owner")
        self.assertEqual(result.email, "")

    def test_get_tableau_owner_caching(self):
        """Test that owner is cached after first retrieval"""
        mock_owner = MagicMock()
        mock_owner.id = "cached-owner"
        mock_owner.name = "Cached Owner"
        mock_owner.email = "cached@example.com"

        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        # First call should hit the API
        result1 = self.client.get_tableau_owner("cached-owner")
        self.assertEqual(self.client.tableau_server.users.get_by_id.call_count, 1)

        # Second call should use cache
        result2 = self.client.get_tableau_owner("cached-owner")
        self.assertEqual(self.client.tableau_server.users.get_by_id.call_count, 1)

        self.assertEqual(result1.id, result2.id)
        self.assertEqual(result1.name, result2.name)

    def test_get_tableau_owner_include_owners_false(self):
        """Test that None is returned when include_owners is False"""
        result = self.client.get_tableau_owner("owner-123", include_owners=False)

        self.assertIsNone(result)
        self.client.tableau_server.users.get_by_id.assert_not_called()

    def test_get_tableau_owner_none_owner_id(self):
        """Test that None is returned when owner_id is None or empty"""
        result = self.client.get_tableau_owner(None)
        self.assertIsNone(result)

        result = self.client.get_tableau_owner("")
        self.assertIsNone(result)

    def test_get_tableau_owner_api_exception(self):
        """Test that None is returned when API raises an exception"""
        self.client.tableau_server.users.get_by_id.side_effect = Exception("API Error")

        result = self.client.get_tableau_owner("owner-error")

        self.assertIsNone(result)

    def test_get_tableau_owner_user_not_found(self):
        """Test that None is returned when user is not found (API returns None)"""
        self.client.tableau_server.users.get_by_id.return_value = None

        result = self.client.get_tableau_owner("nonexistent-owner")

        self.assertIsNone(result)

    def test_test_get_owners_with_email(self):
        """Test test_get_owners succeeds when workbook owner has email"""
        # Mock workbook with owner_id
        mock_workbook = MagicMock()
        mock_workbook.id = "workbook-123"
        mock_workbook.owner_id = "owner-with-email"

        # Mock the test_get_workbooks method
        self.client.test_get_workbooks = MagicMock(return_value=mock_workbook)

        # Mock owner with email
        mock_owner = MagicMock()
        mock_owner.id = "owner-with-email"
        mock_owner.name = "Owner With Email"
        mock_owner.email = "owner@example.com"
        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        result = self.client.test_get_owners()

        self.assertIsNotNone(result)
        self.assertIsInstance(result, TableauOwner)
        self.assertEqual(result.email, "owner@example.com")

    def test_test_get_owners_without_email(self):
        """Test test_get_owners succeeds when workbook owner has no email"""
        # Mock workbook with owner_id
        mock_workbook = MagicMock()
        mock_workbook.id = "workbook-456"
        mock_workbook.owner_id = "owner-no-email"

        # Mock the test_get_workbooks method
        self.client.test_get_workbooks = MagicMock(return_value=mock_workbook)

        # Mock owner without email
        mock_owner = MagicMock()
        mock_owner.id = "owner-no-email"
        mock_owner.name = "Owner Without Email"
        mock_owner.email = None
        self.client.tableau_server.users.get_by_id.return_value = mock_owner

        result = self.client.test_get_owners()

        self.assertIsNotNone(result)
        self.assertIsInstance(result, TableauOwner)
        self.assertIsNone(result.email)
        self.assertEqual(result.name, "Owner Without Email")

    def test_test_get_owners_raises_when_owner_not_found(self):
        """Test test_get_owners raises TableauOwnersNotFound when owner cannot be retrieved"""
        # Mock workbook with owner_id
        mock_workbook = MagicMock()
        mock_workbook.id = "workbook-789"
        mock_workbook.owner_id = "nonexistent-owner"

        # Mock the test_get_workbooks method
        self.client.test_get_workbooks = MagicMock(return_value=mock_workbook)

        # Mock API returning None for owner
        self.client.tableau_server.users.get_by_id.return_value = None

        with self.assertRaises(TableauOwnersNotFound):
            self.client.test_get_owners()

    def test_test_get_owners_with_include_owners_false(self):
        """Test test_get_owners raises TableauOwnersNotFound when include_owners is False"""
        # Mock workbook with owner_id
        mock_workbook = MagicMock()
        mock_workbook.id = "workbook-001"
        mock_workbook.owner_id = "some-owner"

        # Mock the test_get_workbooks method
        self.client.test_get_workbooks = MagicMock(return_value=mock_workbook)

        with self.assertRaises(TableauOwnersNotFound):
            self.client.test_get_owners(include_owners=False)
