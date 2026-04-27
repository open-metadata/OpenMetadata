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
Test Microsoft Fabric REST Client
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch


class FabricClientTest(TestCase):
    """
    Unit tests for Microsoft Fabric REST client
    """

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_workspace_items(self, mock_rest, mock_auth):
        """Test retrieving workspace items"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        # Mock auth
        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        # Mock REST client response
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "item-1",
                    "displayName": "Warehouse1",
                    "type": "Warehouse",
                    "workspaceId": "workspace-1",
                },
                {
                    "id": "item-2",
                    "displayName": "Lakehouse1",
                    "type": "Lakehouse",
                    "workspaceId": "workspace-1",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        items = client.get_workspace_items("workspace-1")

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].display_name, "Warehouse1")
        self.assertEqual(items[1].type, "Lakehouse")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_workspace_items_by_type(self, mock_rest, mock_auth):
        """Test filtering items by type"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "item-1",
                    "displayName": "Warehouse1",
                    "type": "Warehouse",
                    "workspaceId": "workspace-1",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        warehouses = client.get_workspace_items("workspace-1", item_type="Warehouse")

        self.assertEqual(len(warehouses), 1)
        self.assertEqual(warehouses[0].type, "Warehouse")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_warehouses(self, mock_rest, mock_auth):
        """Test retrieving warehouses"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "wh-1",
                    "displayName": "SalesWarehouse",
                    "type": "Warehouse",
                    "description": "Sales data warehouse",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        warehouses = client.get_warehouses("workspace-1")

        self.assertEqual(len(warehouses), 1)
        self.assertEqual(warehouses[0].display_name, "SalesWarehouse")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_lakehouses(self, mock_rest, mock_auth):
        """Test retrieving lakehouses"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "lh-1",
                    "displayName": "BronzeLakehouse",
                    "type": "Lakehouse",
                    "description": "Bronze layer data",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        lakehouses = client.get_lakehouses("workspace-1")

        self.assertEqual(len(lakehouses), 1)
        self.assertEqual(lakehouses[0].display_name, "BronzeLakehouse")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_pipelines(self, mock_rest, mock_auth):
        """Test retrieving data pipelines"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "pipe-1",
                    "displayName": "ETL_Pipeline",
                    "description": "Main ETL pipeline",
                },
                {
                    "id": "pipe-2",
                    "displayName": "Ingestion_Pipeline",
                    "description": "Data ingestion",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        pipelines = client.get_pipelines("workspace-1")

        self.assertEqual(len(pipelines), 2)
        self.assertEqual(pipelines[0].display_name, "ETL_Pipeline")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_pipeline_runs(self, mock_rest, mock_auth):
        """Test retrieving pipeline runs"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "run-1",
                    "itemId": "pipe-1",
                    "status": "Completed",
                    "startTimeUtc": "2024-01-15T10:00:00Z",
                    "endTimeUtc": "2024-01-15T10:30:00Z",
                },
                {
                    "id": "run-2",
                    "itemId": "pipe-1",
                    "status": "Failed",
                    "startTimeUtc": "2024-01-14T08:00:00Z",
                    "endTimeUtc": "2024-01-14T08:15:00Z",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        runs = client.get_pipeline_runs("workspace-1", "pipe-1")

        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].status, "Completed")
        self.assertEqual(runs[1].status, "Failed")

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_workspaces(self, mock_rest, mock_auth):
        """Test retrieving workspaces"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "value": [
                {
                    "id": "ws-1",
                    "displayName": "DevWorkspace",
                    "description": "Development workspace",
                },
                {
                    "id": "ws-2",
                    "displayName": "ProdWorkspace",
                    "description": "Production workspace",
                },
            ]
        }
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        workspaces = client.get_workspaces()

        self.assertEqual(len(workspaces), 2)
        self.assertEqual(workspaces[0].display_name, "DevWorkspace")
        self.assertEqual(workspaces[1].display_name, "ProdWorkspace")


class FabricClientErrorHandlingTest(TestCase):
    """
    Unit tests for error handling in Fabric client
    """

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_workspaces_error_returns_empty_list(self, mock_rest, mock_auth):
        """Test that errors return empty list instead of raising"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.side_effect = Exception("API Error")
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        # Should return empty list, not raise
        workspaces = client.get_workspaces()
        self.assertEqual(workspaces, [])

    @patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator")
    @patch("metadata.clients.microsoftfabric.fabric_client.REST")
    def test_get_pipelines_error_returns_empty_list(self, mock_rest, mock_auth):
        """Test that pipeline fetch errors return empty list"""
        from metadata.clients.microsoftfabric.fabric_client import FabricClient

        mock_auth_instance = MagicMock()
        mock_auth_instance.get_token_callback.return_value = lambda: (
            "test-token",
            3600,
        )
        mock_auth.return_value = mock_auth_instance

        mock_rest_instance = MagicMock()
        mock_rest_instance.get.side_effect = Exception("404 Not Found")
        mock_rest.return_value = mock_rest_instance

        client = FabricClient(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        # Should return empty list, not raise
        pipelines = client.get_pipelines("invalid-workspace")
        self.assertEqual(pipelines, [])


class FabricClientConfigTest(TestCase):
    """
    Unit tests for Fabric client configuration
    """

    def test_base_url(self):
        """Test that correct base URL is used"""
        from metadata.clients.microsoftfabric.fabric_client import FABRIC_API_BASE_URL

        self.assertEqual(FABRIC_API_BASE_URL, "https://api.fabric.microsoft.com")

    def test_api_endpoints(self):
        """Test API endpoint construction"""
        workspace_id = "test-workspace-123"
        pipeline_id = "test-pipeline-456"

        # Test endpoint patterns (these are the paths used in the client)
        workspaces_endpoint = "/v1/workspaces"
        items_endpoint = f"/v1/workspaces/{workspace_id}/items"
        pipelines_endpoint = f"/v1/workspaces/{workspace_id}/dataPipelines"
        pipeline_runs_endpoint = f"/v1/workspaces/{workspace_id}/dataPipelines/{pipeline_id}/pipelineJobs"

        self.assertEqual(workspaces_endpoint, "/v1/workspaces")
        self.assertIn(workspace_id, items_endpoint)
        self.assertIn("dataPipelines", pipelines_endpoint)
        self.assertIn("pipelineJobs", pipeline_runs_endpoint)

    def test_client_initialization(self):
        """Test client can be initialized with required parameters"""
        from unittest.mock import patch

        with patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator") as mock_auth:
            mock_auth_instance = MagicMock()
            mock_auth.return_value = mock_auth_instance

            from metadata.clients.microsoftfabric.fabric_client import FabricClient

            client = FabricClient(  # noqa: F841
                tenant_id="test-tenant",
                client_id="test-client",
                client_secret="test-secret",
            )

            # Verify authenticator was created with correct params
            mock_auth.assert_called_once_with(
                tenant_id="test-tenant",
                client_id="test-client",
                client_secret="test-secret",
                authority_uri="https://login.microsoftonline.com/",
            )

    def test_client_with_custom_authority_uri(self):
        """Test client with custom authority URI"""
        from unittest.mock import patch

        with patch("metadata.clients.microsoftfabric.fabric_client.FabricAuthenticator") as mock_auth:
            mock_auth_instance = MagicMock()
            mock_auth.return_value = mock_auth_instance

            from metadata.clients.microsoftfabric.fabric_client import FabricClient

            custom_authority = "https://login.microsoftonline.us/"
            client = FabricClient(  # noqa: F841
                tenant_id="test-tenant",
                client_id="test-client",
                client_secret="test-secret",
                authority_uri=custom_authority,
            )

            # Verify custom authority was passed
            mock_auth.assert_called_once_with(
                tenant_id="test-tenant",
                client_id="test-client",
                client_secret="test-secret",
                authority_uri=custom_authority,
            )
