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
Test BurstIQ Client functionality - authentication, API calls, error handling
"""

from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.ingestion.source.database.burstiq.client import BurstIQClient


class TestBurstIQClient(TestCase):
    """Test BurstIQ Client functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = BurstIQConnection(
            username="test_user",
            password="test_password",
            realmName="test_realm",
            biqSdzName="test_sdz",
            biqCustomerName="test_customer",
        )

        # Mock authentication response
        self.mock_token_response = {
            "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguYnVyc3RpcS5jb20vcmVhbG1zL3Rlc3RfcmVhbG0iLCJhdWQiOiJ0ZXN0X3NkeiIsImV4cCI6MTcwMDAwMDAwMCwicmVzb3VyY2VfYWNjZXNzIjp7InRlc3Rfc2R6Ijp7fX19.signature",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_authentication_success(self, mock_post):
        """Test successful authentication with BurstIQ"""
        mock_response = Mock()
        mock_response.json.return_value = self.mock_token_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        client = BurstIQClient(self.config)
        # Trigger authentication explicitly
        client.test_authenticate()

        # Verify authentication was called correctly
        self.assertEqual(mock_post.call_count, 1)
        call_args = mock_post.call_args

        # Check URL
        expected_url = (
            "https://auth.burstiq.com/realms/test_realm/protocol/openid-connect/token"
        )
        self.assertEqual(call_args[0][0], expected_url)

        # Check payload
        payload = call_args[1]["data"]
        self.assertEqual(payload["client_id"], "burst")
        self.assertEqual(payload["grant_type"], "password")
        self.assertEqual(payload["username"], "test_user")
        self.assertEqual(payload["password"], "test_password")

        # Verify token is set
        self.assertIsNotNone(client.access_token)
        self.assertIsNotNone(client.token_expires_at)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_authentication_failure(self, mock_post):
        """Test authentication failure handling"""
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = Exception("401 Unauthorized")
        mock_post.return_value = mock_response

        client = BurstIQClient(self.config)
        with self.assertRaises(Exception) as context:
            client.test_authenticate()

        self.assertIn("Failed to authenticate with BurstIQ", str(context.exception))

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_get_dictionaries_success(self, mock_request, mock_post):
        """Test successful fetching of dictionaries"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get dictionaries response
        mock_dict_response = Mock()
        mock_dict_response.json.return_value = [
            {
                "name": "patient",
                "description": "Patient dictionary",
                "attributes": [
                    {"name": "id", "datatype": "STRING", "required": True},
                    {"name": "age", "datatype": "INTEGER", "required": False},
                ],
                "indexes": [{"name": "pk", "type": "PRIMARY", "attributes": ["id"]}],
            },
            {
                "name": "provider",
                "description": "Provider dictionary",
                "attributes": [{"name": "id", "datatype": "STRING", "required": True}],
                "indexes": [],
            },
        ]
        mock_dict_response.raise_for_status = Mock()
        mock_request.return_value = mock_dict_response

        client = BurstIQClient(self.config)
        dictionaries = client.get_dictionaries()

        # Verify results
        self.assertEqual(len(dictionaries), 2)
        self.assertEqual(dictionaries[0]["name"], "patient")
        self.assertEqual(dictionaries[1]["name"], "provider")

        # Verify API call
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn("/api/metadata/dictionary", call_args[0][1])

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_get_dictionaries_with_limit(self, mock_request, mock_post):
        """Test fetching dictionaries with limit"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get dictionaries response
        mock_dict_response = Mock()
        mock_dict_response.json.return_value = [
            {"name": "patient", "attributes": [], "indexes": []}
        ]
        mock_dict_response.raise_for_status = Mock()
        mock_request.return_value = mock_dict_response

        client = BurstIQClient(self.config)
        dictionaries = client.get_dictionaries(limit=1)

        # Verify limit was passed
        call_args = mock_request.call_args
        self.assertEqual(call_args[1]["params"]["limit"], 1)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_get_edges_success(self, mock_request, mock_post):
        """Test successful fetching of edges for lineage"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get edges response
        mock_edges_response = Mock()
        mock_edges_response.json.return_value = [
            {
                "id": "edge_1",
                "name": "patient_to_visit",
                "fromDictionary": "patient",
                "toDictionary": "visit",
                "condition": [{"fromCol": "id", "toCol": "patient_id"}],
            },
            {
                "id": "edge_2",
                "name": "visit_to_diagnosis",
                "fromDictionary": "visit",
                "toDictionary": "diagnosis",
                "condition": [{"fromCol": "id", "toCol": "visit_id"}],
            },
        ]
        mock_edges_response.raise_for_status = Mock()
        mock_request.return_value = mock_edges_response

        client = BurstIQClient(self.config)
        edges = client.get_edges()

        # Verify results
        self.assertEqual(len(edges), 2)
        self.assertEqual(edges[0]["name"], "patient_to_visit")
        self.assertEqual(edges[0]["fromDictionary"], "patient")
        self.assertEqual(edges[0]["toDictionary"], "visit")

        # Verify API call
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn("/api/metadata/edge", call_args[0][1])

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_get_edges_with_filters(self, mock_request, mock_post):
        """Test fetching edges with filter parameters"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get edges response
        mock_edges_response = Mock()
        mock_edges_response.json.return_value = []
        mock_edges_response.raise_for_status = Mock()
        mock_request.return_value = mock_edges_response

        client = BurstIQClient(self.config)
        edges = client.get_edges(
            from_dictionary="patient", to_dictionary="visit", limit=10
        )

        # Verify filter parameters were passed
        call_args = mock_request.call_args
        params = call_args[1]["params"]
        self.assertEqual(params["fromDictionary"], "patient")
        self.assertEqual(params["toDictionary"], "visit")
        self.assertEqual(params["limit"], 10)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.datetime")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_token_refresh(self, mock_request, mock_datetime, mock_post):
        """Test automatic token refresh when expired"""
        # Mock current time
        mock_now = datetime(2024, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        # Mock authentication (will be called twice - initial + refresh)
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        client = BurstIQClient(self.config)

        # Trigger initial authentication
        client.test_authenticate()

        # Manually set token to expired
        client.token_expires_at = mock_now - timedelta(seconds=1)

        # Mock API response
        mock_api_response = Mock()
        mock_api_response.json.return_value = []
        mock_api_response.raise_for_status = Mock()
        mock_request.return_value = mock_api_response

        # Make API call which should trigger re-authentication
        client.get_dictionaries()

        # Verify authentication was called twice (initial + refresh)
        self.assertEqual(mock_post.call_count, 2)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_connection_error_handling(self, mock_request, mock_post):
        """Test handling of connection errors"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock connection error
        import requests

        mock_request.side_effect = requests.exceptions.ConnectionError("Network error")

        client = BurstIQClient(self.config)

        with self.assertRaises(ConnectionError) as context:
            client.get_dictionaries()

        self.assertIn("Failed to connect to BurstIQ API", str(context.exception))

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_timeout_error_handling(self, mock_request, mock_post):
        """Test handling of timeout errors"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock timeout error
        import requests

        mock_request.side_effect = requests.exceptions.Timeout("Request timeout")

        client = BurstIQClient(self.config)

        with self.assertRaises(ConnectionError) as context:
            client.get_dictionaries()

        self.assertIn("BurstIQ API request timed out", str(context.exception))

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_get_dictionary_by_name(self, mock_request, mock_post):
        """Test fetching a specific dictionary by name"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = self.mock_token_response
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get dictionary response
        mock_dict_response = Mock()
        mock_dict_response.json.return_value = {
            "name": "patient",
            "description": "Patient data",
            "attributes": [{"name": "id", "datatype": "STRING"}],
            "indexes": [],
        }
        mock_dict_response.raise_for_status = Mock()
        mock_request.return_value = mock_dict_response

        client = BurstIQClient(self.config)
        dictionary = client.get_dictionary_by_name("patient")

        # Verify result
        self.assertIsNotNone(dictionary)
        self.assertEqual(dictionary["name"], "patient")

        # Verify API call
        call_args = mock_request.call_args
        self.assertIn("/api/metadata/dictionary/patient", call_args[0][1])

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_custom_auth_server_url(self, mock_post):
        """Test using custom authentication server URL"""
        custom_config = BurstIQConnection(
            username="test_user",
            password="test_password",
            realmName="custom_realm",
            biqSdzName="custom_sdz",
            biqCustomerName="custom_customer",
        )

        mock_response = Mock()
        mock_response.json.return_value = self.mock_token_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        client = BurstIQClient(custom_config)
        # Trigger authentication
        client.test_authenticate()

        # Verify custom auth server URL was used
        call_args = mock_post.call_args
        self.assertIn("https://auth.burstiq.com", call_args[0][0])
        self.assertIn("custom_realm", call_args[0][0])
