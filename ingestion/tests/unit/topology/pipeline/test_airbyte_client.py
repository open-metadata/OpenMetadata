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
Test Airbyte Client - Public API Detection and AirbyteCloudClient
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

import requests

from metadata.ingestion.ometa.client import APIError


class TestAirbyteClientPublicApiDetection(TestCase):
    """Test cases for Airbyte Client public API detection"""

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_internal_api_detection(self, mock_rest):
        """Test that internal API is detected when apiVersion is 'api/v1'"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        self.assertFalse(client._use_public_api)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_public_api_detection(self, mock_rest):
        """Test that public API is detected when apiVersion contains 'public'"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        self.assertTrue(client._use_public_api)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_public_api_detection_case_insensitive(self, mock_rest):
        """Test that public API detection is case insensitive"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/PUBLIC/v1",
        )
        client = AirbyteClient(config)

        self.assertTrue(client._use_public_api)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_workspaces_internal_api(self, mock_rest):
        """Test list_workspaces uses POST /workspaces/list for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "workspaces": [{"workspaceId": "test-workspace-id"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        result = client.list_workspaces()

        mock_rest_instance.post.assert_called_once_with("/workspaces/list")
        self.assertEqual(result, [{"workspaceId": "test-workspace-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_workspaces_public_api(self, mock_rest):
        """Test list_workspaces uses GET /workspaces for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"workspaceId": "test-workspace-id"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        result = client.list_workspaces()

        mock_rest_instance.get.assert_called_once_with("/workspaces")
        self.assertEqual(result, [{"workspaceId": "test-workspace-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_connections_internal_api(self, mock_rest):
        """Test list_connections uses POST for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "connections": [{"connectionId": "test-connection-id"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        result = client.list_connections("workspace-id")

        mock_rest_instance.post.assert_called_once()
        call_args = mock_rest_instance.post.call_args
        self.assertEqual(call_args[0][0], "/connections/list")
        self.assertEqual(result, [{"connectionId": "test-connection-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_connections_public_api(self, mock_rest):
        """Test list_connections uses GET for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"connectionId": "test-connection-id"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        result = client.list_connections("workspace-id")

        mock_rest_instance.get.assert_called_once_with(
            "/connections?workspaceIds=workspace-id"
        )
        self.assertEqual(result, [{"connectionId": "test-connection-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_jobs_internal_api(self, mock_rest):
        """Test list_jobs uses POST for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"jobs": [{"jobId": "test-job-id"}]}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        result = client.list_jobs("connection-id")

        mock_rest_instance.post.assert_called_once()
        call_args = mock_rest_instance.post.call_args
        self.assertEqual(call_args[0][0], "/jobs/list")
        self.assertEqual(result, [{"jobId": "test-job-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_jobs_public_api(self, mock_rest):
        """Test list_jobs uses GET for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": [{"jobId": "test-job-id"}]}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        result = client.list_jobs("connection-id")

        mock_rest_instance.get.assert_called_once_with(
            "/jobs?connectionId=connection-id"
        )
        self.assertEqual(result, [{"jobId": "test-job-id"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_source_internal_api(self, mock_rest):
        """Test get_source uses POST for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"sourceId": "test-source-id"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        result = client.get_source("source-id")

        mock_rest_instance.post.assert_called_once()
        call_args = mock_rest_instance.post.call_args
        self.assertEqual(call_args[0][0], "/sources/get")
        self.assertEqual(result, {"sourceId": "test-source-id"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_source_public_api(self, mock_rest):
        """Test get_source uses GET for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"sourceId": "source-id"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        result = client.get_source("source-id")

        mock_rest_instance.get.assert_called_once_with("/sources/source-id")
        self.assertEqual(result, {"sourceId": "source-id"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_destination_internal_api(self, mock_rest):
        """Test get_destination uses POST for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"destinationId": "test-destination-id"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        result = client.get_destination("destination-id")

        mock_rest_instance.post.assert_called_once()
        call_args = mock_rest_instance.post.call_args
        self.assertEqual(call_args[0][0], "/destinations/get")
        self.assertEqual(result, {"destinationId": "test-destination-id"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_destination_public_api(self, mock_rest):
        """Test get_destination uses GET for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"destinationId": "destination-id"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        result = client.get_destination("destination-id")

        mock_rest_instance.get.assert_called_once_with("/destinations/destination-id")
        self.assertEqual(result, {"destinationId": "destination-id"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_none_api_version_defaults_to_internal(self, mock_rest):
        """Test that None apiVersion defaults to internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion=None,
        )
        client = AirbyteClient(config)

        self.assertFalse(client._use_public_api)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch(
        "metadata.ingestion.source.pipeline.airbyte.client.generate_http_basic_token"
    )
    def test_basic_auth_configuration(self, mock_generate_token, mock_rest):
        """Test that BasicAuthentication configures client correctly"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.basicAuth import (
            BasicAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance
        mock_generate_token.return_value = "basic-token"

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
            auth=BasicAuthentication(username="user", password="pass"),
        )
        client = AirbyteClient(config)

        # Verify the client was created
        self.assertIsNotNone(client.client)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_workspaces_exception_internal_api(self, mock_rest):
        """Test list_workspaces raises APIError on exceptionStack for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_workspaces()

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_workspaces_exception_public_api(self, mock_rest):
        """Test list_workspaces raises APIError on exceptionStack for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_workspaces()

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_connections_exception_internal_api(self, mock_rest):
        """Test list_connections raises APIError on exceptionStack for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_connections("workspace-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_connections_exception_public_api(self, mock_rest):
        """Test list_connections raises APIError on exceptionStack for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_connections("workspace-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_jobs_exception_internal_api(self, mock_rest):
        """Test list_jobs raises APIError on exceptionStack for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_jobs("connection-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_jobs_exception_public_api(self, mock_rest):
        """Test list_jobs raises APIError on exceptionStack for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.list_jobs("connection-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_source_exception_internal_api(self, mock_rest):
        """Test get_source raises APIError on exceptionStack for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.get_source("source-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_source_exception_public_api(self, mock_rest):
        """Test get_source raises APIError on exceptionStack for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.get_source("source-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_destination_exception_internal_api(self, mock_rest):
        """Test get_destination raises APIError on exceptionStack for internal API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.get_destination("destination-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_get_destination_exception_public_api(self, mock_rest):
        """Test get_destination raises APIError on exceptionStack for public API"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        with self.assertRaises(APIError):
            client.get_destination("destination-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_connections_url_encoding(self, mock_rest):
        """Test list_connections URL encodes special characters in workspace_id"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        # Use a workspace_id with special characters
        client.list_connections("workspace/id&special=chars")

        # Verify the URL is properly encoded
        mock_rest_instance.get.assert_called_once_with(
            "/connections?workspaceIds=workspace%2Fid%26special%3Dchars"
        )

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    def test_list_jobs_url_encoding(self, mock_rest):
        """Test list_jobs URL encodes special characters in connection_id"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/public/v1",
        )
        client = AirbyteClient(config)

        # Use a connection_id with special characters
        client.list_jobs("connection/id&special=chars")

        # Verify the URL is properly encoded
        mock_rest_instance.get.assert_called_once_with(
            "/jobs?connectionId=connection%2Fid%26special%3Dchars"
        )


class TestAirbyteCloudClient(TestCase):
    """Test cases for AirbyteCloudClient"""

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_requires_oauth(self, mock_requests_post, mock_rest):
        """Test that AirbyteCloudClient requires OAuth authentication"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.basicAuth import (
            BasicAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=BasicAuthentication(username="user", password="pass"),
        )

        with self.assertRaises(ValueError) as context:
            AirbyteCloudClient(config)

        self.assertIn("OAuth 2.0", str(context.exception))

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_oauth_initialization(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient initializes with OAuth authentication"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "test-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        self.assertIsNotNone(client.client)
        self.assertIsNone(client._oauth_token)
        self.assertEqual(client._oauth_token_expiry, 0)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_fetch_oauth_token_success(
        self, mock_requests_post, mock_rest
    ):
        """Test _fetch_oauth_token returns token and expiry on success"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "test-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        token, expires_in = client._fetch_oauth_token()

        self.assertEqual(token, "test-token")
        self.assertEqual(expires_in, 3600)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_fetch_oauth_token_no_token(
        self, mock_requests_post, mock_rest
    ):
        """Test _fetch_oauth_token raises APIError when no access_token in response"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {}  # No access_token
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError) as context:
            client._fetch_oauth_token()

        self.assertIn("No access_token", str(context.exception))

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_fetch_oauth_token_request_error(
        self, mock_requests_post, mock_rest
    ):
        """Test _fetch_oauth_token raises APIError on request exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_requests_post.side_effect = requests.exceptions.RequestException(
            "Connection error"
        )

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError) as context:
            client._fetch_oauth_token()

        self.assertIn("OAuth token fetch failed", str(context.exception))

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.time.time")
    def test_cloud_client_get_oauth_token_refresh(
        self, mock_time, mock_requests_post, mock_rest
    ):
        """Test _get_oauth_token refreshes token when expired"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "new-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        mock_time.return_value = 1000.0

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        # First call - no token, should fetch
        token, _ = client._get_oauth_token()
        self.assertEqual(token, "new-token")

        # Verify token was cached
        self.assertEqual(client._oauth_token, "new-token")
        self.assertEqual(client._oauth_token_expiry, 1000.0 + 3600)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.time.time")
    def test_cloud_client_get_oauth_token_uses_cached(
        self, mock_time, mock_requests_post, mock_rest
    ):
        """Test _get_oauth_token uses cached token when not expired"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "cached-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        mock_time.return_value = 1000.0

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        client._oauth_token = "cached-token"
        client._oauth_token_expiry = 2000.0  # Not expired

        token, _ = client._get_oauth_token()

        self.assertEqual(token, "cached-token")
        # Verify no new request was made (only once during init)
        self.assertEqual(mock_requests_post.call_count, 0)

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_workspaces(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient list_workspaces"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"workspaceId": "cloud-workspace"}]
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_workspaces()

        mock_rest_instance.get.assert_called_with("/workspaces")
        self.assertEqual(result, [{"workspaceId": "cloud-workspace"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_workspaces_exception(
        self, mock_requests_post, mock_rest
    ):
        """Test AirbyteCloudClient list_workspaces raises APIError on exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError):
            client.list_workspaces()

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_connections(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient list_connections"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"connectionId": "cloud-connection"}]
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_connections("workspace-id")

        mock_rest_instance.get.assert_called_with(
            "/connections?workspaceIds=workspace-id"
        )
        self.assertEqual(result, [{"connectionId": "cloud-connection"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_connections_exception(
        self, mock_requests_post, mock_rest
    ):
        """Test AirbyteCloudClient list_connections raises APIError on exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError):
            client.list_connections("workspace-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_jobs(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient list_jobs"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": [{"jobId": "cloud-job"}]}
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_jobs("connection-id")

        mock_rest_instance.get.assert_called_with("/jobs?connectionId=connection-id")
        self.assertEqual(result, [{"jobId": "cloud-job"}])

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_list_jobs_exception(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient list_jobs raises APIError on exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError):
            client.list_jobs("connection-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_get_source(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient get_source"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"sourceId": "cloud-source"}
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.get_source("source-id")

        mock_rest_instance.get.assert_called_with("/sources/source-id")
        self.assertEqual(result, {"sourceId": "cloud-source"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_get_source_exception(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient get_source raises APIError on exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError):
            client.get_source("source-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_get_destination(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient get_destination"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"destinationId": "cloud-destination"}
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.get_destination("destination-id")

        mock_rest_instance.get.assert_called_with("/destinations/destination-id")
        self.assertEqual(result, {"destinationId": "cloud-destination"})

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_get_destination_exception(
        self, mock_requests_post, mock_rest
    ):
        """Test AirbyteCloudClient get_destination raises APIError on exception"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)

        with self.assertRaises(APIError):
            client.get_destination("destination-id")

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_url_encoding_connections(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient URL encodes special characters in list_connections"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        client.list_connections("workspace/id&special=chars")

        mock_rest_instance.get.assert_called_with(
            "/connections?workspaceIds=workspace%2Fid%26special%3Dchars"
        )

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_url_encoding_jobs(self, mock_requests_post, mock_rest):
        """Test AirbyteCloudClient URL encodes special characters in list_jobs"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "token", "expires_in": 3600}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        client.list_jobs("connection/id&special=chars")

        mock_rest_instance.get.assert_called_with(
            "/jobs?connectionId=connection%2Fid%26special%3Dchars"
        )

    @patch("metadata.ingestion.source.pipeline.airbyte.client.REST")
    @patch("metadata.ingestion.source.pipeline.airbyte.client.requests.post")
    def test_cloud_client_fetch_oauth_token_default_expiry(
        self, mock_requests_post, mock_rest
    ):
        """Test _fetch_oauth_token uses default expiry when not provided"""
        from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
            Oauth20ClientCredentialsAuthentication,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
            AirbyteConnection,
        )
        from metadata.ingestion.source.pipeline.airbyte.client import AirbyteCloudClient

        mock_rest_instance = MagicMock()
        mock_rest.return_value = mock_rest_instance

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "test-token",
            # No expires_in - should default to 180
        }
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id",
                clientSecret="client-secret",
            ),
        )

        client = AirbyteCloudClient(config)
        token, expires_in = client._fetch_oauth_token()

        self.assertEqual(token, "test-token")
        self.assertEqual(expires_in, 180)  # Default value
