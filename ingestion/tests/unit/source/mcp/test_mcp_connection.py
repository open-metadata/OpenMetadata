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
Unit tests for MCP connection module
"""
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.mcp.mcpConnection import (
    DiscoveryMethod,
    McpConnection,
    McpServerConfig,
    McpType,
    TransportType,
)
from metadata.ingestion.source.mcp.client import McpProtocolError, McpServerInfo
from metadata.ingestion.source.mcp.connection import (
    McpConnectionManager,
    get_connection,
)


@pytest.fixture
def config_file_connection():
    """McpConnection configured for config file discovery"""
    return McpConnection(
        type=McpType.Mcp,
        discoveryMethod=DiscoveryMethod.ConfigFile,
        configFilePaths=["~/test/config.json"],
        connectionTimeout=30,
        initializationTimeout=60,
    )


@pytest.fixture
def direct_connection():
    """McpConnection configured for direct connection"""
    return McpConnection(
        type=McpType.Mcp,
        discoveryMethod=DiscoveryMethod.DirectConnection,
        servers=[
            McpServerConfig(
                name="test-server",
                transport=TransportType.Stdio,
                command="npx",
                args=["-y", "test-package"],
                env={"DEBUG": "true"},
            ),
            McpServerConfig(
                name="http-server",
                transport=TransportType.SSE,
                url="http://localhost:8080",
            ),
        ],
        connectionTimeout=30,
        initializationTimeout=60,
    )


@pytest.fixture
def registry_connection():
    """McpConnection configured for registry discovery"""
    return McpConnection(
        type=McpType.Mcp,
        discoveryMethod=DiscoveryMethod.Registry,
        registryUrl="http://registry.example.com",
    )


class TestMcpConnectionManager:
    """Tests for McpConnectionManager class"""

    def test_initialization(self, config_file_connection):
        manager = McpConnectionManager(config_file_connection)
        assert manager.connection == config_file_connection
        assert manager._discovered_servers is None

    def test_discover_servers_caches_result(self, direct_connection):
        manager = McpConnectionManager(direct_connection)

        servers1 = manager.discover_servers()
        servers2 = manager.discover_servers()

        assert servers1 is servers2

    def test_discover_from_direct_config(self, direct_connection):
        manager = McpConnectionManager(direct_connection)
        servers = manager.discover_servers()

        assert len(servers) == 2

        stdio_server = next(s for s in servers if s.name == "test-server")
        assert stdio_server.transport == "Stdio"
        assert stdio_server.command == "npx"
        assert stdio_server.args == ["-y", "test-package"]
        assert stdio_server.env == {"DEBUG": "true"}

        http_server = next(s for s in servers if s.name == "http-server")
        assert http_server.transport == "SSE"
        assert http_server.url == "http://localhost:8080"

    @patch("metadata.ingestion.source.mcp.connection.discover_servers_from_config_files")
    def test_discover_from_config_files(
        self, mock_discover, config_file_connection
    ):
        mock_discover.return_value = [
            McpServerInfo(name="server1", command="cmd1"),
            McpServerInfo(name="server2", command="cmd2"),
        ]

        manager = McpConnectionManager(config_file_connection)
        servers = manager.discover_servers()

        assert len(servers) == 2
        mock_discover.assert_called_once_with(["~/test/config.json"])

    def test_discover_from_config_files_empty_paths(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.ConfigFile,
            configFilePaths=[],
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert servers == []

    def test_discover_from_registry_not_implemented(self, registry_connection):
        manager = McpConnectionManager(registry_connection)
        servers = manager.discover_servers()

        assert servers == []

    def test_discover_from_registry_no_url(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.Registry,
            registryUrl=None,
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert servers == []

    @patch("metadata.ingestion.source.mcp.connection.McpClient")
    def test_connect_to_server(self, mock_client_class, direct_connection):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        manager = McpConnectionManager(direct_connection)
        server = McpServerInfo(name="test", command="echo")

        client = manager.connect_to_server(server)

        mock_client_class.assert_called_once_with(
            server_config=server,
            connection_timeout=30,
            initialization_timeout=60,
        )
        mock_client.connect.assert_called_once()
        mock_client.initialize.assert_called_once()
        assert client == mock_client

    @patch("metadata.ingestion.source.mcp.connection.McpClient")
    def test_test_server_connection_success(
        self, mock_client_class, direct_connection
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        manager = McpConnectionManager(direct_connection)
        server = McpServerInfo(name="test", command="echo")

        result = manager.test_server_connection(server)

        assert result is True
        mock_client.close.assert_called_once()

    @patch("metadata.ingestion.source.mcp.connection.McpClient")
    def test_test_server_connection_failure(
        self, mock_client_class, direct_connection
    ):
        mock_client = MagicMock()
        mock_client.connect.side_effect = McpProtocolError("Connection failed")
        mock_client_class.return_value = mock_client

        manager = McpConnectionManager(direct_connection)
        server = McpServerInfo(name="test", command="echo")

        result = manager.test_server_connection(server)

        assert result is False

    @patch("metadata.ingestion.source.mcp.connection.McpClient")
    def test_test_server_connection_closes_on_success(
        self, mock_client_class, direct_connection
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        manager = McpConnectionManager(direct_connection)
        server = McpServerInfo(name="test", command="echo")

        result = manager.test_server_connection(server)

        assert result is True
        mock_client.close.assert_called_once()


class TestGetConnection:
    """Tests for get_connection function"""

    def test_get_connection_returns_manager(self, direct_connection):
        manager = get_connection(direct_connection)

        assert isinstance(manager, McpConnectionManager)
        assert manager.connection == direct_connection

    def test_get_connection_with_config_file(self, config_file_connection):
        manager = get_connection(config_file_connection)

        assert isinstance(manager, McpConnectionManager)
        assert manager.connection.discoveryMethod == DiscoveryMethod.ConfigFile


class TestDiscoverFromDirectConfig:
    """Tests for _discover_from_direct_config method"""

    def test_handles_none_transport(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=[
                McpServerConfig(
                    name="test",
                    transport=None,
                    command="echo",
                ),
            ],
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert len(servers) == 1
        assert servers[0].transport == "Stdio"

    def test_handles_api_key(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=[
                McpServerConfig(
                    name="secure-server",
                    transport=TransportType.SSE,
                    url="http://localhost:8080",
                    apiKey="secret-key",
                ),
            ],
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert len(servers) == 1
        assert servers[0].api_key == "secret-key"

    def test_handles_empty_servers_list(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=[],
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert servers == []

    def test_handles_none_servers(self):
        connection = McpConnection(
            type=McpType.Mcp,
            discoveryMethod=DiscoveryMethod.DirectConnection,
            servers=None,
        )
        manager = McpConnectionManager(connection)
        servers = manager.discover_servers()

        assert servers == []
