package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.jackson.JacksonMcpJsonMapper;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Tests to verify the MCP SDK 0.17.0 upgrade works correctly. These tests validate the API changes
 * made during the upgrade from 0.11.2 to 0.17.0.
 */
public class McpSdkUpgradeTest {

  @Test
  void testJacksonMcpJsonMapperCreation() {
    // Verify JacksonMcpJsonMapper can be created with our ObjectMapper
    JacksonMcpJsonMapper jsonMapper = new JacksonMcpJsonMapper(JsonUtils.getObjectMapper());
    assertThat(jsonMapper).isNotNull();
  }

  @Test
  void testMcpTransportContextCreation() {
    // Verify immutable McpTransportContext can be created with metadata
    Map<String, Object> metadata = Map.of("Authorization", "Bearer test-token", "key2", "value2");

    McpTransportContext context = McpTransportContext.create(metadata);

    assertThat(context).isNotNull();
    assertThat(context.get("Authorization")).isEqualTo("Bearer test-token");
    assertThat(context.get("key2")).isEqualTo("value2");
  }

  @Test
  void testMcpTransportContextWithEmptyMetadata() {
    // Verify context can be created with empty metadata
    McpTransportContext context = McpTransportContext.create(Map.of());
    assertThat(context).isNotNull();
  }

  @Test
  void testToolBuilderPattern() {
    // Verify Tool can be created using builder pattern with JSON schema string
    JacksonMcpJsonMapper jsonMapper = new JacksonMcpJsonMapper(JsonUtils.getObjectMapper());

    String schemaJson =
        """
        {
          "type": "object",
          "properties": {
            "query": {"type": "string", "description": "Search query"}
          },
          "required": ["query"]
        }
        """;

    McpSchema.Tool tool =
        McpSchema.Tool.builder()
            .name("test_tool")
            .description("A test tool")
            .inputSchema(jsonMapper, schemaJson)
            .build();

    assertThat(tool).isNotNull();
    assertThat(tool.name()).isEqualTo("test_tool");
    assertThat(tool.description()).isEqualTo("A test tool");
    assertThat(tool.inputSchema()).isNotNull();
  }

  @Test
  void testAuthEnrichedMcpContextExtractorInterface() {
    // Verify our context extractor compiles and works with the new interface
    AuthEnrichedMcpContextExtractor extractor = new AuthEnrichedMcpContextExtractor();
    assertThat(extractor).isNotNull();
  }

  @Test
  void testMcpSchemaPromptCreation() {
    // Verify Prompt can still be created (no breaking changes here)
    McpSchema.Prompt prompt =
        new McpSchema.Prompt("test_prompt", "A test prompt description", null);

    assertThat(prompt).isNotNull();
    assertThat(prompt.name()).isEqualTo("test_prompt");
    assertThat(prompt.description()).isEqualTo("A test prompt description");
  }

  @Test
  void testJsonRpcMessageDeserialization() throws Exception {
    // Verify JSON-RPC message deserialization works with new McpJsonMapper
    JacksonMcpJsonMapper jsonMapper = new JacksonMcpJsonMapper(JsonUtils.getObjectMapper());

    String jsonRpcMessage =
        """
        {
          "jsonrpc": "2.0",
          "id": "test-id",
          "method": "initialize",
          "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0"}
          }
        }
        """;

    McpSchema.JSONRPCMessage message =
        McpSchema.deserializeJsonRpcMessage(jsonMapper, jsonRpcMessage);

    assertThat(message).isNotNull();
    assertThat(message).isInstanceOf(McpSchema.JSONRPCRequest.class);

    McpSchema.JSONRPCRequest request = (McpSchema.JSONRPCRequest) message;
    assertThat(request.id()).isEqualTo("test-id");
    assertThat(request.method()).isEqualTo("initialize");
  }

  @Test
  void testAuthEnrichedMcpContextExtractorExtractsToken() {
    // Test that the extractor correctly extracts Authorization header
    AuthEnrichedMcpContextExtractor extractor = new AuthEnrichedMcpContextExtractor();

    HttpServletRequest mockRequest = mock(HttpServletRequest.class);
    when(mockRequest.getHeader("Authorization")).thenReturn("Bearer my-jwt-token");

    McpTransportContext context = extractor.extract(mockRequest);

    assertThat(context).isNotNull();
    // JwtFilter.extractToken strips "Bearer " prefix
    assertThat(context.get("Authorization")).isEqualTo("my-jwt-token");
  }

  @Test
  void testAuthEnrichedMcpContextExtractorHandlesMissingToken() {
    // Test that the extractor throws exception for missing Authorization header
    // This is expected behavior - MCP endpoint requires authentication
    AuthEnrichedMcpContextExtractor extractor = new AuthEnrichedMcpContextExtractor();

    HttpServletRequest mockRequest = mock(HttpServletRequest.class);
    when(mockRequest.getHeader("Authorization")).thenReturn(null);

    // JwtFilter.extractToken throws AuthenticationException for null token
    org.junit.jupiter.api.Assertions.assertThrows(
        Exception.class,
        () -> extractor.extract(mockRequest),
        "Should throw exception for missing Authorization header");
  }

  @Test
  void testMcpUtilsGetToolPropertiesLoadsTools() {
    // Test that McpUtils.getToolProperties loads tools from JSON file using new builder pattern
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools).isNotNull();
    assertThat(tools).isNotEmpty();

    // Verify at least one expected tool is present
    boolean hasSearchMetadataTool =
        tools.stream().anyMatch(tool -> "search_metadata".equals(tool.name()));
    assertThat(hasSearchMetadataTool).isTrue();

    // Verify tool has required properties
    McpSchema.Tool searchTool =
        tools.stream().filter(t -> "search_metadata".equals(t.name())).findFirst().orElse(null);
    assertThat(searchTool).isNotNull();
    assertThat(searchTool.description()).isNotNull();
    assertThat(searchTool.inputSchema()).isNotNull();
  }

  @Test
  void testMcpUtilsGetPromptsLoadsPrompts() {
    // Test that McpUtils.getPrompts loads prompts from JSON file
    List<McpSchema.Prompt> prompts = McpUtils.getPrompts("json/data/mcp/prompts.json");

    assertThat(prompts).isNotNull();
    // Prompts may be empty depending on configuration, but should not throw
  }
}
