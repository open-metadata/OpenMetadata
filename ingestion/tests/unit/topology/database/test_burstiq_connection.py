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
Test BurstIQ Connection module - connection creation and testing
"""

from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.ingestion.source.database.burstiq.connection import get_connection


class TestBurstIQConnection(TestCase):
    """Test BurstIQ Connection functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = BurstIQConnection(
            username="test_user",
            password="test_password",
            realmName="test_realm",
            biqSdzName="test_sdz",
            biqCustomerName="test_customer",
        )

        self.mock_token_response = {
            "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguYnVyc3RpcS5jb20vcmVhbG1zL3Rlc3RfcmVhbG0iLCJhdWQiOiJ0ZXN0X3NkeiIsImV4cCI6MTcwMDAwMDAwMCwicmVzb3VyY2VfYWNjZXNzIjp7InRlc3Rfc2R6Ijp7fX19.signature",
            "expires_in": 3600,
        }

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_get_connection(self, mock_post):
        """Test get_connection creates BurstIQClient properly"""
        mock_response = Mock()
        mock_response.json.return_value = self.mock_token_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        client = get_connection(self.config)

        # Verify client was created
        self.assertIsNotNone(client)
        self.assertEqual(client.config.username, "test_user")
        self.assertEqual(client.config.realmName, "test_realm")

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_connection_check_access_success(self, mock_request, mock_post):
        """Test connection check for dictionary access"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get dictionaries response
        mock_dict_response = Mock()
        mock_dict_response.json.return_value = [
            {"name": "test_dict", "attributes": [], "indexes": []}
        ]
        mock_dict_response.raise_for_status = Mock()
        mock_request.return_value = mock_dict_response

        # Create client
        from metadata.ingestion.source.database.burstiq.client import BurstIQClient

        client = BurstIQClient(self.config)

        # Test getting dictionaries
        dictionaries = client.get_dictionaries(limit=1)

        # Verify we got results
        self.assertEqual(len(dictionaries), 1)
        self.assertEqual(dictionaries[0]["name"], "test_dict")

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_connection_check_access_failure(self, mock_request, mock_post):
        """Test connection check fails when dictionary access fails"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get dictionaries response - empty result
        mock_dict_response = Mock()
        mock_dict_response.json.return_value = []
        mock_dict_response.raise_for_status = Mock()
        mock_request.return_value = mock_dict_response

        # Create client
        from metadata.ingestion.source.database.burstiq.client import BurstIQClient

        client = BurstIQClient(self.config)

        # Test getting dictionaries
        dictionaries = client.get_dictionaries(limit=1)

        # Empty result should be handled by test_connection
        self.assertEqual(len(dictionaries), 0)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_connection_check_edges_success(self, mock_request, mock_post):
        """Test connection check for edge access"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get edges response
        mock_edges_response = Mock()
        mock_edges_response.json.return_value = [
            {
                "name": "test_edge",
                "fromDictionary": "dict1",
                "toDictionary": "dict2",
                "condition": [],
            }
        ]
        mock_edges_response.raise_for_status = Mock()
        mock_request.return_value = mock_edges_response

        # Create client
        from metadata.ingestion.source.database.burstiq.client import BurstIQClient

        client = BurstIQClient(self.config)

        # Test getting edges
        edges = client.get_edges(limit=1)

        # Verify we got results
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0]["name"], "test_edge")

    @patch(
        "metadata.ingestion.source.database.burstiq.connection.test_connection_steps"
    )
    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_connection_full_test(self, mock_post, mock_test_steps):
        """Test full connection test flow"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock test_connection_steps
        mock_test_result = Mock()
        mock_test_steps.return_value = mock_test_result

        # Create mock metadata and client
        mock_metadata = Mock()

        from metadata.ingestion.source.database.burstiq.client import BurstIQClient

        client = BurstIQClient(self.config)

        # Call test_connection directly - import inline to avoid pytest collection issues
        from metadata.ingestion.source.database.burstiq import (
            connection as burstiq_conn,
        )

        result = burstiq_conn.test_connection(
            metadata=mock_metadata,
            client=client,
            service_connection=self.config,
            timeout_seconds=180,
        )

        # Verify test_connection_steps was called
        mock_test_steps.assert_called_once()
        call_args = mock_test_steps.call_args[1]

        # Verify test functions were provided
        self.assertIn("test_fn", call_args)
        test_fn = call_args["test_fn"]
        self.assertIn("CheckAccess", test_fn)
        self.assertIn("GetEdges", test_fn)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_connection_invalid_credentials(self, mock_post):
        """Test connection with invalid credentials"""
        # Mock authentication failure
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = Exception("401 Unauthorized")
        mock_post.return_value = mock_response

        # Should raise exception when authentication is attempted
        client = get_connection(self.config)
        with self.assertRaises(Exception) as context:
            client.test_authenticate()

        self.assertIn("Failed to authenticate", str(context.exception))
