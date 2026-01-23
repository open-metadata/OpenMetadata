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
MCP (Model Context Protocol) Source

Discovers and catalogs MCP servers, their tools, resources, and prompts
for AI governance in OpenMetadata.
"""
import re
import traceback
from typing import Any, Dict, Iterable, List, Optional

from metadata.generated.schema.api.ai.createMcpServer import CreateMcpServerRequest
from metadata.generated.schema.entity.ai.mcpServer import (
    ConnectionConfig,
    McpPrompt,
    McpResource,
    PromptArgument,
    ResourceType,
    ServerCapabilities,
    ServerInfo,
    ServerType,
    McpTool,
    TransportType,
)
from metadata.generated.schema.entity.services.connections.mcp.mcpConnection import (
    McpConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, test_connection_common
from metadata.ingestion.source.mcp.client import (
    McpClient,
    McpProtocolError,
    McpServerInfo as ClientServerInfo,
)
from metadata.ingestion.source.mcp.connection import McpConnectionManager
from metadata.utils.filters import filter_by_server
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TRANSPORT_TYPE_MAP = {
    "stdio": TransportType.Stdio,
    "sse": TransportType.SSE,
    "streamablehttp": TransportType.Streamable,
    "streamable": TransportType.Streamable,
}

SERVER_NAME_PATTERNS = {
    "filesystem": ServerType.FileSystem,
    "file": ServerType.FileSystem,
    "database": ServerType.Database,
    "postgres": ServerType.Database,
    "mysql": ServerType.Database,
    "sqlite": ServerType.Database,
    "mongodb": ServerType.Database,
    "web": ServerType.WebAPI,
    "http": ServerType.WebAPI,
    "api": ServerType.WebAPI,
    "fetch": ServerType.WebAPI,
    "cloud": ServerType.Cloud,
    "aws": ServerType.Cloud,
    "gcp": ServerType.Cloud,
    "azure": ServerType.Cloud,
    "security": ServerType.Security,
    "auth": ServerType.Security,
    "git": ServerType.Development,
    "github": ServerType.Development,
    "code": ServerType.Development,
    "slack": ServerType.Communication,
    "email": ServerType.Communication,
    "discord": ServerType.Communication,
}


def infer_server_type(server_name: str) -> ServerType:
    """Infer server type from name patterns"""
    name_lower = server_name.lower()
    for pattern, server_type in SERVER_NAME_PATTERNS.items():
        if pattern in name_lower:
            return server_type
    return ServerType.Custom


def infer_resource_type(uri: str, mime_type: Optional[str] = None) -> ResourceType:
    """Infer resource type from URI and mime type"""
    uri_lower = uri.lower()
    if mime_type:
        mime_lower = mime_type.lower()
        if "text/" in mime_lower or "application/json" in mime_lower:
            return ResourceType.Document
        if "image/" in mime_lower or "video/" in mime_lower:
            return ResourceType.Blob

    if uri_lower.startswith("file://"):
        if uri_lower.endswith("/"):
            return ResourceType.Directory
        return ResourceType.File
    if uri_lower.startswith("http://") or uri_lower.startswith("https://"):
        return ResourceType.URL
    if "://" in uri_lower:
        scheme = uri_lower.split("://")[0]
        if scheme in ("postgres", "mysql", "sqlite", "mongodb"):
            return ResourceType.Database
    return ResourceType.Custom


class McpSource(Source):
    """
    MCP Source for discovering and cataloging MCP servers.

    Supports discovering MCP servers from:
    - Configuration files (Claude Desktop, VS Code)
    - Direct server connections
    - MCP registries (future)
    """

    config: WorkflowSource
    connection_manager: McpConnectionManager

    @retry_with_docker_host()
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection: McpConnection = (
            self.config.serviceConnection.root.config
        )
        self.source_config = self.config.sourceConfig.config

        self.connection_manager = get_connection(self.service_connection)
        self.connection_obj = self.connection_manager
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: McpConnection = config.serviceConnection.root.config
        if not isinstance(connection, McpConnection):
            raise InvalidSourceException(
                f"Expected McpConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def _iter(self, *_, **__) -> Iterable[Either[Entity]]:
        """Iterate over discovered MCP servers and yield CreateMcpServerRequest requests"""
        servers = self.connection_manager.discover_servers()
        logger.info(f"Discovered {len(servers)} MCP server(s)")

        for server in servers:
            if self._should_filter_server(server.name):
                self.status.filter(server.name, "Server Filtered Out")
                continue

            yield from self._process_server(server)

    def _should_filter_server(self, server_name: str) -> bool:
        """Check if server should be filtered based on filter pattern"""
        if not self.source_config:
            return False

        filter_pattern = getattr(self.source_config, "serverFilterPattern", None)
        if not filter_pattern:
            return False

        return filter_by_server(filter_pattern, server_name)

    def _process_server(
        self, server: ClientServerInfo
    ) -> Iterable[Either[CreateMcpServerRequest]]:
        """Process a single MCP server and yield CreateMcpServerRequest request"""
        client: Optional[McpClient] = None
        try:
            if self._should_connect_to_server():
                client = self._connect_and_initialize(server)
                self._fetch_server_metadata(client, server)

            create_request = self._build_create_request(server)
            yield Either(right=create_request)

        except McpProtocolError as exc:
            logger.warning(f"MCP protocol error for server '{server.name}': {exc}")
            create_request = self._build_create_request(server, error=str(exc))
            yield Either(right=create_request)

        except Exception as exc:
            logger.error(f"Failed to process MCP server '{server.name}': {exc}")
            yield Either(
                left=StackTraceError(
                    name=server.name,
                    error=f"Failed to process MCP server: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        finally:
            if client:
                client.close()

    def _should_connect_to_server(self) -> bool:
        """Check if we should connect to servers to fetch metadata"""
        return (
            self.service_connection.fetchTools
            or self.service_connection.fetchResources
            or self.service_connection.fetchPrompts
        )

    def _connect_and_initialize(self, server: ClientServerInfo) -> McpClient:
        """Connect to an MCP server and initialize the connection"""
        client = McpClient(
            server_config=server,
            connection_timeout=self.service_connection.connectionTimeout or 30,
            initialization_timeout=self.service_connection.initializationTimeout or 60,
        )
        client.connect()
        client.initialize()
        return client

    def _fetch_server_metadata(
        self, client: McpClient, server: ClientServerInfo
    ) -> None:
        """Fetch tools, resources, and prompts from the server"""
        if self.service_connection.fetchTools:
            try:
                client.list_tools()
                logger.debug(
                    f"Fetched {len(server.tools)} tools from '{server.name}'"
                )
            except McpProtocolError as e:
                logger.warning(f"Could not fetch tools from '{server.name}': {e}")

        if self.service_connection.fetchResources:
            try:
                client.list_resources()
                logger.debug(
                    f"Fetched {len(server.resources)} resources from '{server.name}'"
                )
            except McpProtocolError as e:
                logger.warning(f"Could not fetch resources from '{server.name}': {e}")

        if self.service_connection.fetchPrompts:
            try:
                client.list_prompts()
                logger.debug(
                    f"Fetched {len(server.prompts)} prompts from '{server.name}'"
                )
            except McpProtocolError as e:
                logger.warning(f"Could not fetch prompts from '{server.name}': {e}")

    def _build_create_request(
        self, server: ClientServerInfo, error: Optional[str] = None
    ) -> CreateMcpServerRequest:
        """Build CreateMcpServerRequest request from server info"""
        transport_type = TRANSPORT_TYPE_MAP.get(
            server.transport.lower(), TransportType.Stdio
        )

        server_type = infer_server_type(server.name)

        connection_config = ConnectionConfig(
            command=server.command,
            args=server.args,
            env=server.env,
            url=server.url,
        )

        capabilities = None
        if server.capabilities:
            capabilities = ServerCapabilities(
                toolsSupported=server.capabilities.get("tools") is not None,
                resourcesSupported=server.capabilities.get("resources") is not None,
                promptsSupported=server.capabilities.get("prompts") is not None,
                loggingSupported=server.capabilities.get("logging") is not None,
            )

        server_info = None
        if server.server_info:
            server_info = ServerInfo(
                serverName=server.server_info.get("name"),
                serverVersion=server.server_info.get("version"),
            )

        tools = self._convert_tools(server.tools) if server.tools else None
        resources = self._convert_resources(server.resources) if server.resources else None
        prompts = self._convert_prompts(server.prompts) if server.prompts else None

        description = f"MCP server: {server.name}"
        if error:
            description += f" (Connection error: {error})"
        elif server.server_info:
            name = server.server_info.get("name", "")
            version = server.server_info.get("version", "")
            if name or version:
                description = f"{name} {version}".strip()

        return CreateMcpServerRequest(
            name=self._sanitize_name(server.name),
            displayName=server.name,
            description=description,
            serverType=server_type,
            transportType=transport_type,
            protocolVersion=server.server_info.get("protocolVersion")
            if server.server_info
            else None,
            serverInfo=server_info,
            connectionConfig=connection_config,
            capabilities=capabilities,
            tools=tools,
            resources=resources,
            prompts=prompts,
        )

    def _sanitize_name(self, name: str) -> str:
        """Sanitize server name for use as entity name"""
        sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
        sanitized = re.sub(r"_+", "_", sanitized)
        sanitized = sanitized.strip("_")
        return sanitized[:256] if len(sanitized) > 256 else sanitized

    def _convert_tools(self, tools: List[Dict[str, Any]]) -> List[McpTool]:
        """Convert MCP protocol tools to OpenMetadata McpTool objects"""
        result = []
        for tool in tools:
            mcp_tool = McpTool(
                name=tool.get("name", "unknown"),
                displayName=tool.get("name"),
                description=tool.get("description"),
                inputSchema=tool.get("inputSchema"),
            )
            result.append(mcp_tool)
        return result

    def _convert_resources(
        self, resources: List[Dict[str, Any]]
    ) -> List[McpResource]:
        """Convert MCP protocol resources to OpenMetadata McpResource objects"""
        result = []
        for resource in resources:
            uri = resource.get("uri", "")
            mime_type = resource.get("mimeType")

            mcp_resource = McpResource(
                name=resource.get("name", uri.split("/")[-1] or "resource"),
                displayName=resource.get("name"),
                description=resource.get("description"),
                uri=uri,
                uriTemplate=resource.get("uriTemplate"),
                mimeType=mime_type,
                resourceType=infer_resource_type(uri, mime_type),
            )
            result.append(mcp_resource)
        return result

    def _convert_prompts(self, prompts: List[Dict[str, Any]]) -> List[McpPrompt]:
        """Convert MCP protocol prompts to OpenMetadata McpPrompt objects"""
        result = []
        for prompt in prompts:
            arguments = None
            if prompt.get("arguments"):
                arguments = [
                    PromptArgument(
                        name=arg.get("name", "arg"),
                        description=arg.get("description"),
                        required=arg.get("required", False),
                    )
                    for arg in prompt.get("arguments", [])
                ]

            mcp_prompt = McpPrompt(
                name=prompt.get("name", "unknown"),
                displayName=prompt.get("name"),
                description=prompt.get("description"),
                arguments=arguments,
            )
            result.append(mcp_prompt)
        return result

    def close(self):
        """Cleanup resources"""
        pass

    def test_connection(self) -> None:
        """Test connection to MCP servers"""
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )
