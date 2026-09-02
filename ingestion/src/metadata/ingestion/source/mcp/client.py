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
MCP (Model Context Protocol) Client

This module provides a client for communicating with MCP servers using
the JSON-RPC 2.0 protocol over HTTP transports (SSE, Streamable HTTP).

The Stdio transport (spawning a local subprocess) is not supported; MCP servers
are reached over HTTP by URL instead.
"""

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# MCP Protocol Version
MCP_PROTOCOL_VERSION = "2024-11-05"

# Client info sent during initialization
CLIENT_INFO = {
    "name": "openmetadata-ingestion",
    "version": "1.0.0",
}

# Guidance surfaced when a server is configured with the unsupported Stdio transport.
STDIO_TRANSPORT_REMOVED_MSG = (
    "Stdio transport is no longer supported. "
    "Run the MCP server over HTTP (StreamableHTTP or SSE) and set its 'url'. "
    "To wrap a stdio server, use a stdio-to-HTTP proxy such as mcp-proxy."
)


@dataclass
class McpServerInfo:
    """Information about an MCP server discovered from config or connection"""

    name: str
    transport: str = "Stdio"
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    api_key: str | None = None
    server_info: dict[str, Any] | None = None
    capabilities: dict[str, Any] | None = None
    tools: list[dict[str, Any]] = field(default_factory=list)
    resources: list[dict[str, Any]] = field(default_factory=list)
    prompts: list[dict[str, Any]] = field(default_factory=list)


class McpProtocolError(Exception):
    """Exception raised for MCP protocol errors"""


_CLIENT_NOT_INITIALIZED = "Client not initialized"


class HttpTransport:
    """Transport for communicating with MCP server via HTTP (SSE or Streamable HTTP)"""

    def __init__(
        self,
        url: str,
        api_key: str | None = None,
        timeout: int = 30,
    ):
        self.url = url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self._session_id: str | None = None

    def connect(self) -> None:
        """Initialize HTTP session"""
        if self.api_key:
            self.session.headers["Authorization"] = f"Bearer {self.api_key}"
        self.session.headers["Content-Type"] = "application/json"
        # StreamableHTTP servers may reply with either JSON or an SSE stream.
        self.session.headers["Accept"] = "application/json, text/event-stream"

    def _post(self, payload: dict[str, Any]) -> requests.Response:
        """POST a JSON-RPC payload, carrying the MCP session id once the server assigns one."""
        headers = {"Mcp-Session-Id": self._session_id} if self._session_id else None
        response = self.session.post(
            f"{self.url}/mcp",
            json=payload,  # pyright: ignore[reportArgumentType]
            headers=headers,
            timeout=self.timeout,
        )
        session_id = response.headers.get("Mcp-Session-Id")
        if session_id:
            self._session_id = session_id
        return response

    @staticmethod
    def _parse_jsonrpc(response: requests.Response) -> dict[str, Any]:
        """Parse a JSON-RPC response that is plain JSON or an SSE stream.

        An SSE stream may carry notifications before the response, and a single
        event's payload can span multiple ``data:`` lines, so events are
        reassembled and the first actual JSON-RPC response (carrying ``result``
        or ``error``) is returned.
        """
        content_type = response.headers.get("Content-Type", "")
        if "text/event-stream" not in content_type:
            return response.json()

        for event in response.text.split("\n\n"):
            data = "".join(
                line[len("data:") :].strip() for line in event.splitlines() if line.strip().startswith("data:")
            )
            if not data:
                continue
            message = json.loads(data)
            if "result" in message or "error" in message:
                return message
        raise McpProtocolError("No data in MCP event-stream response")

    def send_notification(self, method: str, params: dict | None = None) -> None:
        """Send a JSON-RPC notification via HTTP POST (no response expected)"""
        notification: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params:
            notification["params"] = params
        try:
            self._post(notification)
        except Exception as e:
            logger.error(f"Failed to send notification '{method}': {e}")

    def send_request(self, method: str, params: dict | None = None) -> dict[str, Any]:
        """Send a JSON-RPC request via HTTP POST"""
        request: dict[str, Any] = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
        }
        if params:
            request["params"] = params

        try:
            response = self._post(request)
            response.raise_for_status()
            result = self._parse_jsonrpc(response)
        except (requests.RequestException, ValueError) as e:
            raise McpProtocolError(f"HTTP request failed: {e}")  # noqa: B904

        if "error" in result:
            raise McpProtocolError(f"MCP error: {result['error'].get('message', 'Unknown error')}")
        return result.get("result", {})

    def close(self) -> None:
        """Close the HTTP session"""
        self.session.close()


class McpClient:
    """
    Client for communicating with MCP servers over HTTP.

    Supported transport types:
    - SSE: Uses Server-Sent Events over HTTP
    - StreamableHTTP: Uses HTTP POST for requests

    Stdio transport is not supported (see STDIO_TRANSPORT_REMOVED_MSG).
    """

    def __init__(
        self,
        server_config: McpServerInfo,
        connection_timeout: int = 30,
        initialization_timeout: int = 60,
    ):
        self.server_config = server_config
        self.connection_timeout = connection_timeout
        self.initialization_timeout = initialization_timeout
        self._transport: HttpTransport | None = None
        self._initialized = False

    def connect(self) -> None:
        """Connect to the MCP server"""
        transport_type = self.server_config.transport.lower()

        if transport_type in ("sse", "streamablehttp"):
            if not self.server_config.url:
                raise McpProtocolError(f"URL required for {transport_type} transport")
            self._transport = HttpTransport(
                url=self.server_config.url,
                api_key=self.server_config.api_key,
                timeout=self.connection_timeout,
            )
        elif transport_type == "stdio":
            raise McpProtocolError(STDIO_TRANSPORT_REMOVED_MSG)
        else:
            raise McpProtocolError(f"Unsupported transport type: {transport_type}")

        self._transport.connect()

    def initialize(self) -> dict[str, Any]:
        """
        Initialize the MCP connection.

        Performs the protocol handshake and capabilities exchange.
        Returns server information and capabilities.
        """
        if not self._transport:
            raise McpProtocolError("Not connected")

        result = self._transport.send_request(
            "initialize",
            {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": CLIENT_INFO,
            },
        )

        self.server_config.server_info = result.get("serverInfo", {})
        self.server_config.capabilities = result.get("capabilities", {})

        self._transport.send_notification("notifications/initialized", {})
        self._initialized = True

        return result

    def list_tools(self) -> list[dict[str, Any]]:
        """List all tools available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError(_CLIENT_NOT_INITIALIZED)

        capabilities = self.server_config.capabilities or {}
        if not capabilities.get("tools"):
            return []

        result = self._transport.send_request("tools/list", {})
        tools = result.get("tools", [])
        self.server_config.tools = tools
        return tools

    def list_resources(self) -> list[dict[str, Any]]:
        """List all resources available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError(_CLIENT_NOT_INITIALIZED)

        capabilities = self.server_config.capabilities or {}
        if not capabilities.get("resources"):
            return []

        result = self._transport.send_request("resources/list", {})
        resources = result.get("resources", [])
        self.server_config.resources = resources
        return resources

    def list_prompts(self) -> list[dict[str, Any]]:
        """List all prompts available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError(_CLIENT_NOT_INITIALIZED)

        capabilities = self.server_config.capabilities or {}
        if not capabilities.get("prompts"):
            return []

        result = self._transport.send_request("prompts/list", {})
        prompts = result.get("prompts", [])
        self.server_config.prompts = prompts
        return prompts

    def close(self) -> None:
        """Close the MCP connection"""
        if self._transport:
            self._transport.close()
            self._transport = None
        self._initialized = False


def parse_claude_desktop_config(config_path: str, config: dict | None = None) -> list[McpServerInfo]:
    """
    Parse Claude Desktop configuration file to extract MCP server definitions.

    The config file format (claude_desktop_config.json):
    {
        "mcpServers": {
            "server_name": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
                "env": {"KEY": "value"}
            }
        }
    }
    """
    if config is None:
        path = Path(config_path).expanduser()
        if not path.exists():
            logger.warning(f"Config file not found: {config_path}")
            return []

        try:
            with open(path, "r", encoding="utf-8") as f:  # noqa: PTH123
                config = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse config file {config_path}: {e}")
            return []

    servers = []
    mcp_servers = config.get("mcpServers", {})

    for name, server_config in mcp_servers.items():
        server_info = McpServerInfo(
            name=name,
            transport="Stdio",
            command=server_config.get("command"),
            args=server_config.get("args", []),
            env=server_config.get("env", {}),
        )
        servers.append(server_info)
        logger.debug(f"Found MCP server '{name}' in config")

    return servers


def parse_vscode_config(config_path: str, config: dict | None = None) -> list[McpServerInfo]:
    """
    Parse VS Code settings.json to extract MCP server definitions.

    VS Code MCP format:
    {
        "mcp.servers": {
            "server_name": {
                "command": "...",
                "args": [...],
                "env": {...}
            }
        }
    }
    """
    if config is None:
        path = Path(config_path).expanduser()
        if not path.exists():
            logger.warning(f"VS Code settings not found: {config_path}")
            return []

        try:
            with open(path, "r", encoding="utf-8") as f:  # noqa: PTH123
                config = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse VS Code settings {config_path}: {e}")
            return []

    servers = []
    mcp_servers = config.get("mcp.servers", {})

    for name, server_config in mcp_servers.items():
        server_info = McpServerInfo(
            name=name,
            transport=server_config.get("transport", "Stdio"),
            command=server_config.get("command"),
            args=server_config.get("args", []),
            env=server_config.get("env", {}),
            url=server_config.get("url"),
        )
        servers.append(server_info)
        logger.debug(f"Found MCP server '{name}' in VS Code config")

    return servers


def discover_servers_from_config_files(
    config_paths: list[str],
) -> list[McpServerInfo]:
    """
    Discover MCP servers from a list of configuration file paths.

    Automatically detects config file format based on content.
    """
    all_servers = []
    seen_names = set()

    for config_path in config_paths:
        path = Path(config_path).expanduser()
        if not path.exists():
            logger.warning(f"Config file not found: {config_path}")
            continue

        try:
            with open(path, "r", encoding="utf-8") as f:  # noqa: PTH123
                config = json.load(f)

            if "mcpServers" in config:
                servers = parse_claude_desktop_config(config_path, config)
            elif "mcp.servers" in config:
                servers = parse_vscode_config(config_path, config)
            else:
                logger.warning(f"Unknown config format in {config_path}")
                continue

            for server in servers:
                if server.name not in seen_names:
                    all_servers.append(server)
                    seen_names.add(server.name)

        except Exception as e:
            logger.warning(f"Error processing config {config_path}: {e}")

    return all_servers
