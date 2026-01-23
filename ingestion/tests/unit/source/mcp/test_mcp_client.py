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
Unit tests for MCP client module
"""
import json
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.mcp.client import (
    HttpTransport,
    McpClient,
    McpProtocolError,
    McpServerInfo,
    StdioTransport,
    discover_servers_from_config_files,
    parse_claude_desktop_config,
    parse_vscode_config,
)


class TestMcpServerInfo:
    """Tests for McpServerInfo dataclass"""

    def test_default_values(self):
        server = McpServerInfo(name="test-server")
        assert server.name == "test-server"
        assert server.transport == "Stdio"
        assert server.command is None
        assert server.args is None
        assert server.env is None
        assert server.url is None
        assert server.api_key is None
        assert server.tools == []
        assert server.resources == []
        assert server.prompts == []

    def test_full_initialization(self):
        server = McpServerInfo(
            name="my-server",
            transport="SSE",
            command="npx",
            args=["-y", "server-package"],
            env={"API_KEY": "secret"},
            url="http://localhost:8080",
            api_key="test-key",
        )
        assert server.name == "my-server"
        assert server.transport == "SSE"
        assert server.command == "npx"
        assert server.args == ["-y", "server-package"]
        assert server.env == {"API_KEY": "secret"}
        assert server.url == "http://localhost:8080"
        assert server.api_key == "test-key"


class TestStdioTransport:
    """Tests for StdioTransport class"""

    def test_initialization(self):
        transport = StdioTransport(
            command="python",
            args=["-m", "mcp_server"],
            env={"DEBUG": "true"},
            timeout=60,
        )
        assert transport.command == "python"
        assert transport.args == ["-m", "mcp_server"]
        assert transport.env == {"DEBUG": "true"}
        assert transport.timeout == 60

    def test_get_next_id_increments(self):
        transport = StdioTransport(command="echo")
        id1 = transport._get_next_id()
        id2 = transport._get_next_id()
        id3 = transport._get_next_id()
        assert id1 == 1
        assert id2 == 2
        assert id3 == 3

    def test_connect_command_not_found(self):
        transport = StdioTransport(command="nonexistent_command_12345")
        with pytest.raises(McpProtocolError) as exc_info:
            transport.connect()
        assert "Command not found" in str(exc_info.value)

    def test_send_request_not_connected(self):
        transport = StdioTransport(command="echo")
        with pytest.raises(McpProtocolError) as exc_info:
            transport.send_request("test/method")
        assert "not connected" in str(exc_info.value).lower()


class TestHttpTransport:
    """Tests for HttpTransport class"""

    def test_initialization(self):
        transport = HttpTransport(
            url="http://localhost:8080/",
            api_key="test-key",
            timeout=30,
        )
        assert transport.url == "http://localhost:8080"
        assert transport.api_key == "test-key"
        assert transport.timeout == 30

    def test_url_trailing_slash_removed(self):
        transport = HttpTransport(url="http://example.com/api/")
        assert transport.url == "http://example.com/api"

    def test_connect_sets_headers(self):
        transport = HttpTransport(url="http://localhost:8080", api_key="secret")
        transport.connect()
        assert "Authorization" in transport.session.headers
        assert transport.session.headers["Authorization"] == "Bearer secret"
        assert transport.session.headers["Content-Type"] == "application/json"

    @patch("requests.Session.post")
    def test_send_request_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": "123",
            "result": {"tools": []},
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()
        result = transport.send_request("tools/list")

        assert result == {"tools": []}
        mock_post.assert_called_once()

    @patch("requests.Session.post")
    def test_send_request_error_response(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": "123",
            "error": {"code": -32600, "message": "Invalid Request"},
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()

        with pytest.raises(McpProtocolError) as exc_info:
            transport.send_request("invalid/method")
        assert "Invalid Request" in str(exc_info.value)


class TestMcpClient:
    """Tests for McpClient class"""

    def test_initialization(self):
        server = McpServerInfo(name="test", command="echo")
        client = McpClient(
            server_config=server,
            connection_timeout=30,
            initialization_timeout=60,
        )
        assert client.server_config == server
        assert client.connection_timeout == 30
        assert client.initialization_timeout == 60

    def test_list_tools_not_initialized(self):
        server = McpServerInfo(name="test", command="echo")
        client = McpClient(server_config=server)
        with pytest.raises(McpProtocolError) as exc_info:
            client.list_tools()
        assert "not initialized" in str(exc_info.value).lower()

    def test_list_resources_not_initialized(self):
        server = McpServerInfo(name="test", command="echo")
        client = McpClient(server_config=server)
        with pytest.raises(McpProtocolError) as exc_info:
            client.list_resources()
        assert "not initialized" in str(exc_info.value).lower()

    def test_list_prompts_not_initialized(self):
        server = McpServerInfo(name="test", command="echo")
        client = McpClient(server_config=server)
        with pytest.raises(McpProtocolError) as exc_info:
            client.list_prompts()
        assert "not initialized" in str(exc_info.value).lower()


class TestParseClaudeDesktopConfig:
    """Tests for parse_claude_desktop_config function"""

    def test_parse_valid_config(self):
        config = {
            "mcpServers": {
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
                    "env": {"DEBUG": "true"},
                },
                "github": {
                    "command": "uvx",
                    "args": ["mcp-server-github"],
                },
            }
        }
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(config, f)
            f.flush()

            servers = parse_claude_desktop_config(f.name)

        assert len(servers) == 2

        fs_server = next(s for s in servers if s.name == "filesystem")
        assert fs_server.command == "npx"
        assert fs_server.args == ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
        assert fs_server.env == {"DEBUG": "true"}
        assert fs_server.transport == "Stdio"

        gh_server = next(s for s in servers if s.name == "github")
        assert gh_server.command == "uvx"
        assert gh_server.args == ["mcp-server-github"]

    def test_parse_empty_config(self):
        config = {"mcpServers": {}}
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(config, f)
            f.flush()
            servers = parse_claude_desktop_config(f.name)

        assert servers == []

    def test_parse_nonexistent_file(self):
        servers = parse_claude_desktop_config("/nonexistent/path/config.json")
        assert servers == []

    def test_parse_invalid_json(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            f.write("not valid json {")
            f.flush()
            servers = parse_claude_desktop_config(f.name)

        assert servers == []


class TestParseVscodeConfig:
    """Tests for parse_vscode_config function"""

    def test_parse_valid_config(self):
        config = {
            "mcp.servers": {
                "postgres": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-postgres"],
                    "transport": "SSE",
                    "url": "http://localhost:3000",
                }
            }
        }
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(config, f)
            f.flush()
            servers = parse_vscode_config(f.name)

        assert len(servers) == 1
        assert servers[0].name == "postgres"
        assert servers[0].transport == "SSE"
        assert servers[0].url == "http://localhost:3000"

    def test_parse_nonexistent_file(self):
        servers = parse_vscode_config("/nonexistent/settings.json")
        assert servers == []


class TestDiscoverServersFromConfigFiles:
    """Tests for discover_servers_from_config_files function"""

    def test_discover_from_multiple_files(self):
        config1 = {
            "mcpServers": {
                "server1": {"command": "cmd1"},
            }
        }
        config2 = {
            "mcpServers": {
                "server2": {"command": "cmd2"},
            }
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f1:
            json.dump(config1, f1)
            f1.flush()
            path1 = f1.name

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f2:
            json.dump(config2, f2)
            f2.flush()
            path2 = f2.name

        servers = discover_servers_from_config_files([path1, path2])

        assert len(servers) == 2
        names = {s.name for s in servers}
        assert "server1" in names
        assert "server2" in names

    def test_discover_deduplicates_by_name(self):
        config1 = {"mcpServers": {"duplicate": {"command": "cmd1"}}}
        config2 = {"mcpServers": {"duplicate": {"command": "cmd2"}}}

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f1:
            json.dump(config1, f1)
            f1.flush()
            path1 = f1.name

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f2:
            json.dump(config2, f2)
            f2.flush()
            path2 = f2.name

        servers = discover_servers_from_config_files([path1, path2])

        assert len(servers) == 1
        assert servers[0].name == "duplicate"
        assert servers[0].command == "cmd1"

    def test_discover_with_nonexistent_files(self):
        servers = discover_servers_from_config_files(
            ["/nonexistent1.json", "/nonexistent2.json"]
        )
        assert servers == []

    def test_discover_empty_list(self):
        servers = discover_servers_from_config_files([])
        assert servers == []
