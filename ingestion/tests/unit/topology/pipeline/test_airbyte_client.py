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
Test Airbyte Client - Public API Detection
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch


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
