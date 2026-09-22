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
from unittest.mock import ANY, MagicMock, patch

import pytest

from metadata.ingestion.source.mcp.client import (
    STDIO_TRANSPORT_REMOVED_MSG,
    HttpTransport,
    McpClient,
    McpProtocolError,
    McpServerInfo,
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
            env={"MY_VAR": "test-value"},
            url="http://localhost:8080",
            api_key="test-api-key-00000",  # NOSONAR
        )
        assert server.name == "my-server"
        assert server.transport == "SSE"
        assert server.command == "npx"
        assert server.args == ["-y", "server-package"]
        assert server.env == {"MY_VAR": "test-value"}
        assert server.url == "http://localhost:8080"
        assert server.api_key == "test-api-key-00000"  # NOSONAR


class TestStdioTransportRemoved:
    """Stdio transport is not supported; connecting to a stdio server is rejected."""

    def test_stdio_connect_rejected(self):
        """A stdio server must fail to connect with a clear migration message."""
        server = McpServerInfo(
            name="local-stdio",
            transport="Stdio",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-memory"],
        )
        client = McpClient(server_config=server)
        with pytest.raises(McpProtocolError) as exc_info:
            client.connect()
        message = str(exc_info.value)
        assert message == STDIO_TRANSPORT_REMOVED_MSG
        assert "no longer supported" in message
        assert "mcp-proxy" in message

    def test_stdio_transport_class_gone(self):
        """StdioTransport must no longer be importable."""
        import metadata.ingestion.source.mcp.client as client_module

        assert not hasattr(client_module, "StdioTransport")

    def test_unsupported_transport_rejected(self):
        client = McpClient(server_config=McpServerInfo(name="s", transport="carrier"))
        with pytest.raises(McpProtocolError) as exc_info:
            client.connect()
        assert "Unsupported transport" in str(exc_info.value)


class TestHttpTransport:
    """Tests for HttpTransport class"""

    def test_initialization(self):
        transport = HttpTransport(
            url="http://localhost:8080/",
            api_key="test-api-key-00000",  # NOSONAR
            timeout=30,
        )
        assert transport.url == "http://localhost:8080"
        assert transport.api_key == "test-api-key-00000"
        assert transport.timeout == 30

    def test_url_trailing_slash_removed(self):
        transport = HttpTransport(url="http://example.com/api/")
        assert transport.url == "http://example.com/api"

    def test_connect_sets_headers(self):
        transport = HttpTransport(
            url="http://localhost:8080",
            api_key="test-api-key-00000",  # NOSONAR
        )
        transport.connect()
        assert "Authorization" in transport.session.headers
        assert transport.session.headers["Authorization"] == "Bearer test-api-key-00000"
        assert transport.session.headers["Content-Type"] == "application/json"
        # StreamableHTTP servers may reply with JSON or an SSE stream.
        assert "text/event-stream" in transport.session.headers["Accept"]

    @patch("requests.Session.post")
    def test_send_request_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "application/json"}
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
        mock_post.assert_called_once_with(
            "http://localhost:8080",
            json=ANY,
            headers={},
            timeout=30,
        )

    @patch("requests.Session.post")
    def test_send_request_error_response(self, mock_post):
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "application/json"}
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

    @patch("requests.Session.post")
    def test_send_request_parses_event_stream(self, mock_post):
        """A StreamableHTTP server may reply with an SSE-framed JSON-RPC message."""
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "text/event-stream"}
        mock_response.text = 'event: message\ndata: {"jsonrpc": "2.0", "id": "1", "result": {"ok": true}}\n\n'
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()
        result = transport.send_request("initialize")

        assert result == {"ok": True}

    @patch("requests.Session.post")
    def test_event_stream_skips_leading_notification(self, mock_post):
        """An SSE stream may emit notifications before the response; skip them."""
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "text/event-stream"}
        mock_response.text = (
            'data: {"jsonrpc": "2.0", "method": "notifications/progress"}\n\n'
            'data: {"jsonrpc": "2.0", "id": "1", "result": {"ok": true}}\n\n'
        )
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()
        result = transport.send_request("initialize")

        assert result == {"ok": True}

    @patch("requests.Session.post")
    def test_event_stream_parses_crlf_multiline_data(self, mock_post):
        """SSE data fields use CRLF framing and preserve newlines between fields."""
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "text/event-stream"}
        mock_response.text = 'data: {"jsonrpc": "2.0",\r\ndata: "id": "1",\r\ndata: "result": {"ok": true}}\r\n\r\n'
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        transport = HttpTransport(url="http://localhost:8080/mcp")
        transport.connect()

        assert transport.send_request("initialize") == {"ok": True}
        assert mock_post.call_args.args[0] == "http://localhost:8080/mcp"

    @patch("requests.Session.post")
    def test_session_id_captured_and_resent(self, mock_post):
        """The Mcp-Session-Id from the first response is echoed on later requests."""
        first = MagicMock()
        first.headers = {"Content-Type": "application/json", "Mcp-Session-Id": "sess-123"}
        first.json.return_value = {"result": {}}
        first.raise_for_status = MagicMock()
        second = MagicMock()
        second.headers = {"Content-Type": "application/json"}
        second.json.return_value = {"result": {}}
        second.raise_for_status = MagicMock()
        mock_post.side_effect = [first, second]

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()
        transport.send_request("initialize")
        assert transport._session_id == "sess-123"
        transport._protocol_version = "2025-03-26"

        transport.send_request("tools/list")
        sent_headers = mock_post.call_args.kwargs.get("headers")
        assert sent_headers is not None
        assert sent_headers.get("Mcp-Session-Id") == "sess-123"
        assert sent_headers.get("MCP-Protocol-Version") == "2025-03-26"

    def test_client_sends_negotiated_protocol_version_after_initialization(self):
        transport = MagicMock(spec=HttpTransport)
        transport.send_request.return_value = {
            "protocolVersion": "2025-03-26",
            "serverInfo": {},
            "capabilities": {},
        }
        client = McpClient(McpServerInfo(name="server", transport="StreamableHTTP", url="http://server/mcp"))
        client._transport = transport

        client.initialize()

        assert transport._protocol_version == "2025-03-26"
        transport.send_notification.assert_called_once_with("notifications/initialized", {})

    @patch("requests.Session.post")
    def test_send_notification_logs_on_failure(self, mock_post):
        """send_notification should log warnings, not silently swallow errors"""
        mock_post.side_effect = ConnectionError("server down")

        transport = HttpTransport(url="http://localhost:8080")
        transport.connect()

        with patch("metadata.ingestion.source.mcp.client.logger") as mock_logger:
            transport.send_notification("notifications/initialized", {})
            mock_logger.error.assert_called_once()
            assert "server down" in str(mock_logger.error.call_args)


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
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(config, f)
            f.flush()

            servers = parse_claude_desktop_config(f.name)

        assert len(servers) == 2

        fs_server = next(s for s in servers if s.name == "filesystem")
        assert fs_server.command == "npx"
        assert fs_server.args == [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "/tmp",
        ]
        assert fs_server.env == {"DEBUG": "true"}
        assert fs_server.transport == "Stdio"

        gh_server = next(s for s in servers if s.name == "github")
        assert gh_server.command == "uvx"
        assert gh_server.args == ["mcp-server-github"]

    def test_parse_empty_config(self):
        config = {"mcpServers": {}}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(config, f)
            f.flush()
            servers = parse_claude_desktop_config(f.name)

        assert servers == []

    def test_parse_http_server(self):
        servers = parse_claude_desktop_config(
            "unused",
            {"mcpServers": {"remote": {"type": "http", "url": "https://example.com/mcp"}}},
        )

        assert servers[0].transport == "StreamableHTTP"
        assert servers[0].url == "https://example.com/mcp"

    def test_parse_nonexistent_file(self):
        servers = parse_claude_desktop_config("/nonexistent/path/config.json")
        assert servers == []

    def test_parse_invalid_json(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
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
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
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

    def test_parse_http_type(self):
        servers = parse_vscode_config(
            "unused",
            {"mcp.servers": {"remote": {"type": "http", "url": "https://example.com/mcp"}}},
        )

        assert servers[0].transport == "StreamableHTTP"
        assert servers[0].url == "https://example.com/mcp"


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

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f1:
            json.dump(config1, f1)
            f1.flush()
            path1 = f1.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f2:
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

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f1:
            json.dump(config1, f1)
            f1.flush()
            path1 = f1.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f2:
            json.dump(config2, f2)
            f2.flush()
            path2 = f2.name

        servers = discover_servers_from_config_files([path1, path2])

        assert len(servers) == 1
        assert servers[0].name == "duplicate"
        assert servers[0].command == "cmd1"

    def test_discover_with_nonexistent_files(self):
        servers = discover_servers_from_config_files(["/nonexistent1.json", "/nonexistent2.json"])
        assert servers == []

    def test_discover_empty_list(self):
        servers = discover_servers_from_config_files([])
        assert servers == []
