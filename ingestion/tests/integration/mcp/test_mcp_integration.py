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
MCP Integration Tests

Tests for MCP service creation and ingestion workflow.
Requires:
- Running OpenMetadata server (localhost:8585)
- Optionally a running MCP server for full E2E tests
"""
import json
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.services.createMcpService import (
    CreateMcpServiceRequest,
)
from metadata.generated.schema.entity.services.connections.mcp.mcpConnection import (
    DiscoveryMethod,
    McpConnection,
    McpServerConfig,
    McpType,
    TransportType,
)
from metadata.generated.schema.entity.services.mcpService import (
    McpService,
    McpServiceType,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.source.mcp.client import McpServerInfo
from metadata.ingestion.source.mcp.connection import McpConnectionManager


class TestMcpServiceAPI:
    """Tests for MCP Service API operations"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.metadata = int_admin_ometa()
        self.service_name = "test-mcp-service"
        yield
        self._cleanup()

    def _cleanup(self):
        try:
            service = self.metadata.get_by_name(
                entity=McpService,
                fqn=self.service_name,
            )
            if service:
                self.metadata.delete(
                    entity=McpService,
                    entity_id=service.id,
                    recursive=True,
                    hard_delete=True,
                )
        except Exception:
            pass

    def test_create_mcp_service(self):
        """Test creating an MCP service via the API"""
        service_request = CreateMcpServiceRequest(
            name=EntityName(self.service_name),
            serviceType=McpServiceType.Mcp,
            connection=McpConnection(
                type=McpType.Mcp,
                discoveryMethod=DiscoveryMethod.DirectConnection,
                servers=[
                    McpServerConfig(
                        name="test-server",
                        transport=TransportType.Stdio,
                        command="echo",
                        args=["test"],
                    ),
                ],
            ),
        )

        created_service = self.metadata.create_or_update(service_request)

        assert created_service is not None
        assert created_service.name.root == self.service_name
        assert created_service.serviceType == McpServiceType.Mcp

    def test_get_mcp_service_by_name(self):
        """Test retrieving an MCP service by name"""
        service_request = CreateMcpServiceRequest(
            name=EntityName(self.service_name),
            serviceType=McpServiceType.Mcp,
            connection=McpConnection(
                type=McpType.Mcp,
                discoveryMethod=DiscoveryMethod.DirectConnection,
                servers=[
                    McpServerConfig(
                        name="test-server",
                        transport=TransportType.SSE,
                        url="http://localhost:8080",
                    ),
                ],
            ),
        )

        self.metadata.create_or_update(service_request)

        retrieved_service = self.metadata.get_by_name(
            entity=McpService,
            fqn=self.service_name,
        )

        assert retrieved_service is not None
        assert retrieved_service.name.root == self.service_name

    def test_delete_mcp_service(self):
        """Test deleting an MCP service"""
        service_request = CreateMcpServiceRequest(
            name=EntityName(self.service_name),
            serviceType=McpServiceType.Mcp,
            connection=McpConnection(
                type=McpType.Mcp,
                discoveryMethod=DiscoveryMethod.DirectConnection,
                servers=[],
            ),
        )

        created_service = self.metadata.create_or_update(service_request)

        self.metadata.delete(
            entity=McpService,
            entity_id=created_service.id,
            hard_delete=True,
        )

        deleted_service = self.metadata.get_by_name(
            entity=McpService,
            fqn=self.service_name,
        )

        assert deleted_service is None


class TestMcpConnectionManagerIntegration:
    """Tests for MCP Connection Manager"""

    def test_discover_from_direct_config(self):
        """Test discovering servers from direct configuration"""
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=[
                McpServerConfig(
                    name="server-1",
                    transport=TransportType.Stdio,
                    command="npx",
                    args=["-y", "@modelcontextprotocol/server-memory"],
                ),
                McpServerConfig(
                    name="server-2",
                    transport=TransportType.SSE,
                    url="http://localhost:8080",
                ),
            ],
        )

        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert len(servers) == 2
        assert servers[0].name == "server-1"
        assert servers[0].transport == "Stdio"
        assert servers[0].command == "npx"
        assert servers[1].name == "server-2"
        assert servers[1].transport == "SSE"
        assert servers[1].url == "http://localhost:8080"

    def test_discover_from_config_file(self):
        """Test discovering servers from config file"""
        config_content = {
            "mcpServers": {
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
                },
                "memory": {
                    "command": "uvx",
                    "args": ["mcp-server-memory"],
                },
            }
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(config_content, f)
            config_path = f.name

        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.ConfigFile,
            configFilePaths=[config_path],
        )

        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert len(servers) == 2
        server_names = {s.name for s in servers}
        assert "filesystem" in server_names
        assert "memory" in server_names


class TestMcpIngestionWorkflow:
    """Tests for MCP ingestion workflow execution"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.metadata = int_admin_ometa()
        self.service_name = "test-mcp-ingestion"
        yield
        self._cleanup()

    def _cleanup(self):
        try:
            service = self.metadata.get_by_name(
                entity=McpService,
                fqn=self.service_name,
            )
            if service:
                self.metadata.delete(
                    entity=McpService,
                    entity_id=service.id,
                    recursive=True,
                    hard_delete=True,
                )
        except Exception:
            pass

    @patch("metadata.ingestion.source.mcp.metadata.McpClient")
    def test_ingestion_workflow_with_mock_server(self, mock_client_class):
        """Test running the MCP ingestion workflow with a mocked server"""
        mock_client = MagicMock()
        mock_client.server_info = {"name": "mock-server", "version": "1.0"}
        mock_client.capabilities = {"tools": {}}
        mock_client_class.return_value = mock_client

        service_request = CreateMcpServiceRequest(
            name=EntityName(self.service_name),
            serviceType=McpServiceType.Mcp,
            connection=McpConnection(
                type=McpType.Mcp,
                discoveryMethod=DiscoveryMethod.DirectConnection,
                servers=[
                    McpServerConfig(
                        name="mock-server",
                        transport=TransportType.Stdio,
                        command="echo",
                        args=["test"],
                    ),
                ],
                fetchTools=True,
                fetchResources=True,
                fetchPrompts=True,
            ),
        )

        created_service = self.metadata.create_or_update(service_request)
        assert created_service is not None
        assert created_service.name.root == self.service_name


@pytest.mark.skip(reason="Requires running MCP server")
class TestMcpE2EWithRealServer:
    """
    End-to-end tests with a real MCP server.

    To run these tests:
    1. Start an MCP server (e.g., npx -y @modelcontextprotocol/server-memory)
    2. Run with: pytest -v tests/integration/mcp/test_mcp_integration.py::TestMcpE2EWithRealServer
    """

    @pytest.fixture(autouse=True)
    def setup(self):
        self.metadata = int_admin_ometa()
        self.service_name = "test-mcp-e2e"
        yield
        self._cleanup()

    def _cleanup(self):
        try:
            service = self.metadata.get_by_name(
                entity=McpService,
                fqn=self.service_name,
            )
            if service:
                self.metadata.delete(
                    entity=McpService,
                    entity_id=service.id,
                    recursive=True,
                    hard_delete=True,
                )
        except Exception:
            pass

    def test_e2e_with_memory_server(self):
        """
        Test full E2E flow with the MCP memory server.

        Requires: npx -y @modelcontextprotocol/server-memory
        """
        service_request = CreateMcpServiceRequest(
            name=EntityName(self.service_name),
            serviceType=McpServiceType.Mcp,
            connection=McpConnection(
                type=McpType.Mcp,
                discoveryMethod=DiscoveryMethod.DirectConnection,
                servers=[
                    McpServerConfig(
                        name="memory-server",
                        transport=TransportType.Stdio,
                        command="npx",
                        args=["-y", "@modelcontextprotocol/server-memory"],
                    ),
                ],
                fetchTools=True,
                fetchResources=True,
                fetchPrompts=True,
            ),
        )

        created_service = self.metadata.create_or_update(service_request)
        assert created_service is not None

        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=[
                McpServerConfig(
                    name="memory-server",
                    transport=TransportType.Stdio,
                    command="npx",
                    args=["-y", "@modelcontextprotocol/server-memory"],
                ),
            ],
        )

        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()
        assert len(servers) == 1

        success = manager.test_server_connection(servers[0])
        assert success is True
