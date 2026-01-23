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
MCP Connection Handler

Handles connection creation and testing for MCP (Model Context Protocol) servers.
"""
from functools import partial
from typing import List, Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.mcp.mcpConnection import (
    DiscoveryMethod,
    McpConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.mcp.client import (
    McpClient,
    McpProtocolError,
    McpServerInfo,
    discover_servers_from_config_files,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class McpConnectionManager:
    """
    Manages MCP server connections based on discovery method.

    Supports:
    - ConfigFile: Read MCP server configs from files (Claude Desktop, VS Code)
    - DirectConnection: Connect directly to specified MCP servers
    - Registry: Discover servers from an MCP registry (future)
    """

    def __init__(self, connection: McpConnection):
        self.connection = connection
        self._discovered_servers: Optional[List[McpServerInfo]] = None

    def discover_servers(self) -> List[McpServerInfo]:
        """Discover MCP servers based on the configured discovery method"""
        if self._discovered_servers is not None:
            return self._discovered_servers

        discovery_method = self.connection.discoveryMethod

        if discovery_method == DiscoveryMethod.ConfigFile:
            self._discovered_servers = self._discover_from_config_files()
        elif discovery_method == DiscoveryMethod.DirectConnection:
            self._discovered_servers = self._discover_from_direct_config()
        elif discovery_method == DiscoveryMethod.Registry:
            self._discovered_servers = self._discover_from_registry()
        else:
            logger.warning(f"Unknown discovery method: {discovery_method}")
            self._discovered_servers = []

        return self._discovered_servers

    def _discover_from_config_files(self) -> List[McpServerInfo]:
        """Discover servers from configuration files"""
        config_paths = self.connection.configFilePaths or []
        if not config_paths:
            logger.warning(
                "No config file paths specified for ConfigFile discovery method"
            )
            return []

        return discover_servers_from_config_files(config_paths)

    def _discover_from_direct_config(self) -> List[McpServerInfo]:
        """Create server info from direct connection configuration"""
        servers = []
        direct_servers = self.connection.servers or []

        for server_config in direct_servers:
            server_info = McpServerInfo(
                name=server_config.name,
                transport=server_config.transport.value if server_config.transport else "Stdio",
                command=server_config.command,
                args=server_config.args or [],
                env=server_config.env or {},
                url=server_config.url,
                api_key=(
                    server_config.apiKey.get_secret_value()
                    if server_config.apiKey
                    else None
                ),
            )
            servers.append(server_info)

        return servers

    def _discover_from_registry(self) -> List[McpServerInfo]:
        """Discover servers from an MCP registry"""
        registry_url = self.connection.registryUrl
        if not registry_url:
            logger.warning("No registry URL specified for Registry discovery method")
            return []

        logger.warning("Registry discovery is not yet implemented")
        return []

    def connect_to_server(self, server: McpServerInfo) -> McpClient:
        """Create and initialize a connection to an MCP server"""
        client = McpClient(
            server_config=server,
            connection_timeout=self.connection.connectionTimeout or 30,
            initialization_timeout=self.connection.initializationTimeout or 60,
        )
        client.connect()
        client.initialize()
        return client

    def test_server_connection(self, server: McpServerInfo) -> bool:
        """Test connection to a single MCP server"""
        client = None
        try:
            client = self.connect_to_server(server)
            return True
        except McpProtocolError as e:
            logger.warning(f"Failed to connect to MCP server '{server.name}': {e}")
            return False
        except Exception as e:
            logger.warning(
                f"Unexpected error connecting to MCP server '{server.name}': {e}"
            )
            return False
        finally:
            if client:
                client.close()


def get_connection(connection: McpConnection) -> McpConnectionManager:
    """
    Create an MCP connection manager.

    Args:
        connection: MCP connection configuration

    Returns:
        McpConnectionManager instance
    """
    try:
        return McpConnectionManager(connection)
    except Exception as exc:
        msg = f"Error creating MCP connection: {exc}"
        raise SourceConnectionException(msg)


def _test_discover_servers(manager: McpConnectionManager) -> None:
    """Test step: Discover MCP servers"""
    servers = manager.discover_servers()
    if not servers:
        raise SourceConnectionException("No MCP servers discovered")
    logger.info(f"Discovered {len(servers)} MCP server(s)")


def _test_connect_to_servers(manager: McpConnectionManager) -> None:
    """Test step: Connect to at least one MCP server"""
    servers = manager.discover_servers()
    connected = False

    for server in servers[:3]:
        if manager.test_server_connection(server):
            logger.info(f"Successfully connected to MCP server '{server.name}'")
            connected = True
            break
        logger.warning(f"Could not connect to MCP server '{server.name}'")

    if not connected:
        raise SourceConnectionException(
            "Could not connect to any discovered MCP servers"
        )


def test_connection(
    metadata: OpenMetadata,
    client: McpConnectionManager,
    service_connection: McpConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection to MCP servers.

    Performs the following test steps:
    1. Discover servers from config files or direct configuration
    2. Connect to at least one discovered server
    """
    test_fn = {
        "DiscoverServers": partial(_test_discover_servers, client),
        "ConnectToServers": partial(_test_connect_to_servers, client),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
