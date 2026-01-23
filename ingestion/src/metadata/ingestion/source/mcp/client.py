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
the JSON-RPC 2.0 protocol over various transports (Stdio, SSE, HTTP).
"""
import json
import os
import subprocess
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

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


@dataclass
class McpServerInfo:
    """Information about an MCP server discovered from config or connection"""

    name: str
    transport: str = "Stdio"
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    server_info: Optional[Dict[str, Any]] = None
    capabilities: Optional[Dict[str, Any]] = None
    tools: List[Dict[str, Any]] = field(default_factory=list)
    resources: List[Dict[str, Any]] = field(default_factory=list)
    prompts: List[Dict[str, Any]] = field(default_factory=list)


class McpProtocolError(Exception):
    """Exception raised for MCP protocol errors"""


class StdioTransport:
    """Transport for communicating with MCP server via stdin/stdout"""

    def __init__(
        self,
        command: str,
        args: Optional[List[str]] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: int = 30,
    ):
        self.command = command
        self.args = args or []
        self.env = env
        self.timeout = timeout
        self.process: Optional[subprocess.Popen] = None
        self._message_id = 0
        self._lock = threading.Lock()
        self._responses: Dict[int, Dict] = {}
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False

    def _get_next_id(self) -> int:
        with self._lock:
            self._message_id += 1
            return self._message_id

    def connect(self) -> None:
        """Start the MCP server subprocess"""
        full_env = os.environ.copy()
        if self.env:
            full_env.update(self.env)

        try:
            self.process = subprocess.Popen(
                [self.command] + self.args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=full_env,
                text=True,
                bufsize=1,
            )
            self._running = True
            self._reader_thread = threading.Thread(target=self._read_responses)
            self._reader_thread.daemon = True
            self._reader_thread.start()
        except FileNotFoundError:
            raise McpProtocolError(
                f"Command not found: {self.command}. "
                "Ensure the MCP server command is installed and in PATH."
            )
        except Exception as e:
            raise McpProtocolError(f"Failed to start MCP server: {e}")

    def _read_responses(self) -> None:
        """Background thread to read responses from the server"""
        while self._running and self.process and self.process.stdout:
            try:
                line = self.process.stdout.readline()
                if not line:
                    break
                line = line.strip()
                if line:
                    response = json.loads(line)
                    msg_id = response.get("id")
                    if msg_id is not None:
                        with self._lock:
                            self._responses[msg_id] = response
            except json.JSONDecodeError:
                continue
            except Exception:
                break

    def send_request(
        self, method: str, params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Send a JSON-RPC request and wait for response"""
        if not self.process or not self.process.stdin:
            raise McpProtocolError("Transport not connected")

        msg_id = self._get_next_id()
        request = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method,
        }
        if params:
            request["params"] = params

        try:
            self.process.stdin.write(json.dumps(request) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            raise McpProtocolError(f"Failed to send request: {e}")

        import time

        start_time = time.time()
        while time.time() - start_time < self.timeout:
            with self._lock:
                if msg_id in self._responses:
                    response = self._responses.pop(msg_id)
                    if "error" in response:
                        raise McpProtocolError(
                            f"MCP error: {response['error'].get('message', 'Unknown error')}"
                        )
                    return response.get("result", {})
            time.sleep(0.01)

        raise McpProtocolError(f"Timeout waiting for response to {method}")

    def close(self) -> None:
        """Close the transport and terminate the subprocess"""
        self._running = False
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                self.process.kill()


class HttpTransport:
    """Transport for communicating with MCP server via HTTP (SSE or Streamable HTTP)"""

    def __init__(
        self,
        url: str,
        api_key: Optional[str] = None,
        timeout: int = 30,
    ):
        self.url = url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self._session_id: Optional[str] = None

    def connect(self) -> None:
        """Initialize HTTP session"""
        if self.api_key:
            self.session.headers["Authorization"] = f"Bearer {self.api_key}"
        self.session.headers["Content-Type"] = "application/json"

    def send_request(
        self, method: str, params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Send a JSON-RPC request via HTTP POST"""
        request = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
        }
        if params:
            request["params"] = params

        try:
            response = self.session.post(
                f"{self.url}/mcp",
                json=request,
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()

            if "error" in result:
                raise McpProtocolError(
                    f"MCP error: {result['error'].get('message', 'Unknown error')}"
                )
            return result.get("result", {})
        except requests.RequestException as e:
            raise McpProtocolError(f"HTTP request failed: {e}")

    def close(self) -> None:
        """Close the HTTP session"""
        self.session.close()


class McpClient:
    """
    Client for communicating with MCP servers.

    Supports multiple transport types:
    - Stdio: Spawns a subprocess and communicates via stdin/stdout
    - SSE: Uses Server-Sent Events over HTTP
    - StreamableHTTP: Uses HTTP POST for requests
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
        self._transport: Optional[StdioTransport | HttpTransport] = None
        self._initialized = False

    def connect(self) -> None:
        """Connect to the MCP server"""
        transport_type = self.server_config.transport.lower()

        if transport_type == "stdio":
            if not self.server_config.command:
                raise McpProtocolError("Command required for Stdio transport")
            self._transport = StdioTransport(
                command=self.server_config.command,
                args=self.server_config.args,
                env=self.server_config.env,
                timeout=self.connection_timeout,
            )
        elif transport_type in ("sse", "streamablehttp"):
            if not self.server_config.url:
                raise McpProtocolError(f"URL required for {transport_type} transport")
            self._transport = HttpTransport(
                url=self.server_config.url,
                api_key=self.server_config.api_key,
                timeout=self.connection_timeout,
            )
        else:
            raise McpProtocolError(f"Unsupported transport type: {transport_type}")

        self._transport.connect()

    def initialize(self) -> Dict[str, Any]:
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

        self._transport.send_request("notifications/initialized", {})
        self._initialized = True

        return result

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all tools available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError("Client not initialized")

        capabilities = self.server_config.capabilities or {}
        if not capabilities.get("tools"):
            return []

        result = self._transport.send_request("tools/list", {})
        tools = result.get("tools", [])
        self.server_config.tools = tools
        return tools

    def list_resources(self) -> List[Dict[str, Any]]:
        """List all resources available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError("Client not initialized")

        capabilities = self.server_config.capabilities or {}
        if not capabilities.get("resources"):
            return []

        result = self._transport.send_request("resources/list", {})
        resources = result.get("resources", [])
        self.server_config.resources = resources
        return resources

    def list_prompts(self) -> List[Dict[str, Any]]:
        """List all prompts available on the MCP server"""
        if not self._transport or not self._initialized:
            raise McpProtocolError("Client not initialized")

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


def parse_claude_desktop_config(config_path: str) -> List[McpServerInfo]:
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
    path = Path(config_path).expanduser()
    if not path.exists():
        logger.warning(f"Config file not found: {config_path}")
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse config file {config_path}: {e}")
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


def parse_vscode_config(config_path: str) -> List[McpServerInfo]:
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
    path = Path(config_path).expanduser()
    if not path.exists():
        logger.warning(f"VS Code settings not found: {config_path}")
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse VS Code settings {config_path}: {e}")
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
    config_paths: List[str],
) -> List[McpServerInfo]:
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
            with open(path, "r", encoding="utf-8") as f:
                config = json.load(f)

            if "mcpServers" in config:
                servers = parse_claude_desktop_config(config_path)
            elif "mcp.servers" in config:
                servers = parse_vscode_config(config_path)
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
