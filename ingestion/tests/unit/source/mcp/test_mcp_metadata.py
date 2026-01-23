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
Unit tests for MCP metadata source module
"""
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.ai.mcpServer import (
    ResourceType,
    ServerType,
    TransportType,
)
from metadata.ingestion.source.mcp.client import McpServerInfo
from metadata.ingestion.source.mcp.metadata import (
    TRANSPORT_TYPE_MAP,
    infer_resource_type,
    infer_server_type,
)


class TestInferServerType:
    """Tests for infer_server_type function"""

    def test_filesystem_patterns(self):
        assert infer_server_type("filesystem-server") == ServerType.FileSystem
        assert infer_server_type("file-manager") == ServerType.FileSystem
        assert infer_server_type("local-filesystem") == ServerType.FileSystem

    def test_database_patterns(self):
        assert infer_server_type("postgres-server") == ServerType.Database
        assert infer_server_type("mysql-connector") == ServerType.Database
        assert infer_server_type("sqlite-mcp") == ServerType.Database
        assert infer_server_type("mongodb-server") == ServerType.Database
        assert infer_server_type("database-query") == ServerType.Database

    def test_web_api_patterns(self):
        assert infer_server_type("web-fetch") == ServerType.WebAPI
        assert infer_server_type("http-client") == ServerType.WebAPI
        assert infer_server_type("api-server") == ServerType.WebAPI
        assert infer_server_type("fetch-mcp") == ServerType.WebAPI

    def test_cloud_patterns(self):
        assert infer_server_type("aws-server") == ServerType.Cloud
        assert infer_server_type("gcp-mcp") == ServerType.Cloud
        assert infer_server_type("azure-functions") == ServerType.Cloud
        assert infer_server_type("cloud-storage") == ServerType.Cloud

    def test_security_patterns(self):
        assert infer_server_type("security-scanner") == ServerType.Security
        assert infer_server_type("auth-server") == ServerType.Security

    def test_development_patterns(self):
        assert infer_server_type("git-operations") == ServerType.Development
        assert infer_server_type("github-mcp") == ServerType.Development
        assert infer_server_type("code-search") == ServerType.Development

    def test_communication_patterns(self):
        assert infer_server_type("slack-mcp") == ServerType.Communication
        assert infer_server_type("email-sender") == ServerType.Communication
        assert infer_server_type("discord-bot") == ServerType.Communication

    def test_custom_fallback(self):
        assert infer_server_type("unknown-server") == ServerType.Custom
        assert infer_server_type("my-custom-mcp") == ServerType.Custom
        assert infer_server_type("random-name") == ServerType.Custom

    def test_case_insensitive(self):
        assert infer_server_type("FILESYSTEM") == ServerType.FileSystem
        assert infer_server_type("PostgreSQL") == ServerType.Database
        assert infer_server_type("GitHub") == ServerType.Development


class TestInferResourceType:
    """Tests for infer_resource_type function"""

    def test_file_uri(self):
        assert infer_resource_type("file:///path/to/file.txt") == ResourceType.File
        assert infer_resource_type("file:///home/user/doc.pdf") == ResourceType.File

    def test_directory_uri(self):
        assert infer_resource_type("file:///path/to/dir/") == ResourceType.Directory
        assert infer_resource_type("file:///home/user/") == ResourceType.Directory

    def test_http_url(self):
        assert infer_resource_type("http://example.com/api") == ResourceType.URL
        assert infer_resource_type("https://api.github.com") == ResourceType.URL

    def test_database_uri(self):
        assert (
            infer_resource_type("postgres://localhost/db") == ResourceType.Database
        )
        assert (
            infer_resource_type("mysql://localhost:3306/mydb") == ResourceType.Database
        )
        assert infer_resource_type("sqlite:///path/to/db.sqlite") == ResourceType.Database
        assert infer_resource_type("mongodb://localhost/test") == ResourceType.Database

    def test_mime_type_document(self):
        assert (
            infer_resource_type("custom://doc", "text/plain") == ResourceType.Document
        )
        assert (
            infer_resource_type("custom://doc", "application/json")
            == ResourceType.Document
        )
        assert (
            infer_resource_type("custom://doc", "text/html") == ResourceType.Document
        )

    def test_mime_type_blob(self):
        assert infer_resource_type("custom://img", "image/png") == ResourceType.Blob
        assert infer_resource_type("custom://vid", "video/mp4") == ResourceType.Blob

    def test_custom_fallback(self):
        assert infer_resource_type("custom://unknown") == ResourceType.Custom
        assert infer_resource_type("special://resource") == ResourceType.Custom


class TestTransportTypeMap:
    """Tests for TRANSPORT_TYPE_MAP constant"""

    def test_stdio_mapping(self):
        assert TRANSPORT_TYPE_MAP["stdio"] == TransportType.Stdio

    def test_sse_mapping(self):
        assert TRANSPORT_TYPE_MAP["sse"] == TransportType.SSE

    def test_streamable_mappings(self):
        assert TRANSPORT_TYPE_MAP["streamablehttp"] == TransportType.Streamable
        assert TRANSPORT_TYPE_MAP["streamable"] == TransportType.Streamable


class TestMcpSourceBuildCreateRequest:
    """Tests for McpSource._build_create_request method"""

    @pytest.fixture
    def mock_source(self):
        """Create a mock McpSource for testing"""
        with patch(
            "metadata.ingestion.source.mcp.metadata.McpSource.__init__",
            return_value=None,
        ):
            from metadata.ingestion.source.mcp.metadata import McpSource

            source = McpSource.__new__(McpSource)
            source.service_connection = MagicMock()
            source.service_connection.fetchTools = True
            source.service_connection.fetchResources = True
            source.service_connection.fetchPrompts = True
            return source

    def test_build_request_basic(self, mock_source):
        server = McpServerInfo(
            name="test-server",
            transport="Stdio",
            command="echo",
            args=["hello"],
        )

        request = mock_source._build_create_request(server)

        assert request.name.root == "test-server"
        assert request.displayName == "test-server"
        assert request.serverType == ServerType.Custom
        assert request.transportType == TransportType.Stdio
        assert request.connectionConfig.command == "echo"
        assert request.connectionConfig.args == ["hello"]

    def test_build_request_with_tools(self, mock_source):
        server = McpServerInfo(
            name="tool-server",
            transport="Stdio",
            command="echo",
            tools=[
                {
                    "name": "read_file",
                    "description": "Read a file from disk",
                    "inputSchema": {"type": "object"},
                }
            ],
        )

        request = mock_source._build_create_request(server)

        assert len(request.tools) == 1
        assert request.tools[0].name == "read_file"
        assert request.tools[0].description == "Read a file from disk"

    def test_build_request_with_resources(self, mock_source):
        server = McpServerInfo(
            name="resource-server",
            transport="Stdio",
            command="echo",
            resources=[
                {
                    "name": "config",
                    "uri": "file:///etc/config.json",
                    "mimeType": "application/json",
                }
            ],
        )

        request = mock_source._build_create_request(server)

        assert len(request.resources) == 1
        assert request.resources[0].name == "config"
        assert request.resources[0].uri == "file:///etc/config.json"
        assert request.resources[0].mimeType == "application/json"

    def test_build_request_with_prompts(self, mock_source):
        server = McpServerInfo(
            name="prompt-server",
            transport="Stdio",
            command="echo",
            prompts=[
                {
                    "name": "summarize",
                    "description": "Summarize text",
                    "arguments": [
                        {"name": "text", "required": True},
                        {"name": "length", "required": False},
                    ],
                }
            ],
        )

        request = mock_source._build_create_request(server)

        assert len(request.prompts) == 1
        assert request.prompts[0].name == "summarize"
        assert len(request.prompts[0].arguments) == 2

    def test_build_request_with_server_info(self, mock_source):
        server = McpServerInfo(
            name="info-server",
            transport="Stdio",
            command="echo",
            server_info={
                "name": "My MCP Server",
                "version": "1.0.0",
            },
        )

        request = mock_source._build_create_request(server)

        assert request.serverInfo is not None
        assert request.serverInfo.serverName == "My MCP Server"
        assert request.serverInfo.serverVersion == "1.0.0"

    def test_build_request_with_capabilities(self, mock_source):
        server = McpServerInfo(
            name="cap-server",
            transport="Stdio",
            command="echo",
            capabilities={
                "tools": {},
                "resources": {},
                "prompts": None,
                "logging": {},
            },
        )

        request = mock_source._build_create_request(server)

        assert request.capabilities is not None
        assert request.capabilities.toolsSupported is True
        assert request.capabilities.resourcesSupported is True
        assert request.capabilities.promptsSupported is False
        assert request.capabilities.loggingSupported is True

    def test_build_request_with_error(self, mock_source):
        server = McpServerInfo(
            name="error-server",
            transport="Stdio",
            command="echo",
        )

        request = mock_source._build_create_request(server, error="Connection failed")

        assert "Connection error" in request.description.root

    def test_sanitize_name(self, mock_source):
        server = McpServerInfo(
            name="server with spaces & special!chars",
            transport="Stdio",
            command="echo",
        )

        request = mock_source._build_create_request(server)

        name_value = request.name.root
        assert " " not in name_value
        assert "&" not in name_value
        assert "!" not in name_value
        assert name_value == "server_with_spaces_special_chars"

    def test_sanitize_name_long(self, mock_source):
        long_name = "a" * 300
        server = McpServerInfo(
            name=long_name,
            transport="Stdio",
            command="echo",
        )

        request = mock_source._build_create_request(server)

        assert len(request.name.root) <= 256


class TestMcpSourceConvertMethods:
    """Tests for McpSource conversion methods"""

    @pytest.fixture
    def mock_source(self):
        """Create a mock McpSource for testing"""
        with patch(
            "metadata.ingestion.source.mcp.metadata.McpSource.__init__",
            return_value=None,
        ):
            from metadata.ingestion.source.mcp.metadata import McpSource

            source = McpSource.__new__(McpSource)
            return source

    def test_convert_tools(self, mock_source):
        tools = [
            {"name": "tool1", "description": "First tool"},
            {"name": "tool2", "inputSchema": {"type": "object"}},
        ]

        result = mock_source._convert_tools(tools)

        assert len(result) == 2
        assert result[0].name == "tool1"
        assert result[0].description == "First tool"
        assert result[1].name == "tool2"
        assert result[1].inputSchema == {"type": "object"}

    def test_convert_tools_empty(self, mock_source):
        result = mock_source._convert_tools([])
        assert result == []

    def test_convert_resources(self, mock_source):
        resources = [
            {"name": "res1", "uri": "file:///path/to/file.txt"},
            {"uri": "http://example.com"},
            {"name": "doc", "uri": "custom://doc", "mimeType": "text/plain"},
        ]

        result = mock_source._convert_resources(resources)

        assert len(result) == 3
        assert result[0].name == "res1"
        assert result[0].uri == "file:///path/to/file.txt"
        assert result[0].resourceType == ResourceType.File
        assert result[1].uri == "http://example.com"
        assert result[1].resourceType == ResourceType.URL
        assert result[2].resourceType == ResourceType.Document

    def test_convert_prompts(self, mock_source):
        prompts = [
            {
                "name": "prompt1",
                "description": "First prompt",
                "arguments": [{"name": "arg1", "required": True}],
            },
            {"name": "prompt2"},
        ]

        result = mock_source._convert_prompts(prompts)

        assert len(result) == 2
        assert result[0].name == "prompt1"
        assert result[0].arguments is not None
        assert len(result[0].arguments) == 1
        assert result[1].name == "prompt2"
        assert result[1].arguments is None
