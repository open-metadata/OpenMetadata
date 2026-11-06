package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.json.jackson2.JacksonMcpJsonMapper;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessServerHandler;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Tests to verify the MCP SDK 1.1.0 upgrade works correctly. These tests validate the API changes
 * made during the upgrade from 0.17.1 to 1.1.0.
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
        McpSchema.Tool.builder("test_tool", jsonMapper, schemaJson)
            .description("A test tool")
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
        McpSchema.Prompt.builder("test_prompt").description("A test prompt description").build();

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
    when(mockRequest.getHeader("X-OpenMetadata-Persona")).thenReturn("Data Steward");

    McpTransportContext context = extractor.extract(mockRequest);

    assertThat(context).isNotNull();
    // JwtFilter.extractToken strips "Bearer " prefix
    assertThat(context.get("Authorization")).isEqualTo("my-jwt-token");
    assertThat(context.get("X-OpenMetadata-Persona")).isEqualTo("Data Steward");
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
  void testMcpUtilsGetToolPropertiesSetsTitleAndReadOnlyAnnotation() {
    // Anthropic's Claude Connectors Directory requires every tool to carry a title plus
    // readOnlyHint/destructiveHint. Verify a read-only tool is annotated correctly.
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    McpSchema.Tool searchTool =
        tools.stream().filter(t -> "search_metadata".equals(t.name())).findFirst().orElse(null);

    assertThat(searchTool).isNotNull();
    assertThat(searchTool.title()).isEqualTo("Search Metadata");
    assertThat(searchTool.annotations()).isNotNull();
    assertThat(searchTool.annotations().readOnlyHint()).isTrue();
    assertThat(searchTool.annotations().destructiveHint()).isFalse();
  }

  @Test
  void searchToolsAdvertiseTheExplicitPersonaScopeBypass() {
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools)
        .filteredOn(tool -> List.of("search_metadata", "semantic_search").contains(tool.name()))
        .hasSize(2)
        .allSatisfy(
            tool -> {
              Object schema =
                  ((Map<?, ?>) tool.inputSchema().get("properties")).get("ignorePersonaScope");
              assertThat(schema).isInstanceOf(Map.class);
              Map<?, ?> property = (Map<?, ?>) schema;
              assertThat(property.get("type")).isEqualTo("boolean");
              assertThat(property.get("default")).isEqualTo(false);
              assertThat(property.get("description").toString())
                  .contains("after the scoped search returns no results");
            });
  }

  /**
   * SDK 2.x checks every tool's inputSchema against JSON Schema 2020-12 when the server registers
   * it, and McpServer.registerTool drops a tool whose schema fails, so it silently goes missing
   * from tools/list. Catch that here instead.
   */
  @Test
  void toolSchemasPassTheSdkStartupSchemaCheck() {
    var validator = McpJsonDefaults.getSchemaValidator();
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThatThrownBy(() -> validator.assertConforms("broken", Map.of("type", 5)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(tools)
        .isNotEmpty()
        .allSatisfy(
            tool ->
                assertThatCode(() -> validator.assertConforms(tool.name(), tool.inputSchema()))
                    .doesNotThrowAnyException());
  }

  @Test
  void toolSchemasLeaveOutOnlyTheDocOnlyKeys() {
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools)
        .allSatisfy(
            tool -> assertThat(tool.inputSchema()).doesNotContainKeys("description", "examples"));
    assertThat(tools)
        .filteredOn(tool -> "semantic_search".equals(tool.name()))
        .singleElement()
        .satisfies(
            tool -> assertThat(tool.inputSchema()).containsEntry("required", List.of("query")));
  }

  @Test
  void looseArgumentsStillReachTheTool() {
    McpStatelessServerTransport transport = mock(McpStatelessServerTransport.class);
    McpStatelessSyncServer server =
        McpServer.buildServer(
            transport, new McpServer().buildServerCapabilities(), MCPConfiguration::new);
    McpSchema.Tool searchMetadata =
        McpUtils.getToolProperties("json/data/mcp/tools.json").stream()
            .filter(tool -> "search_metadata".equals(tool.name()))
            .findFirst()
            .orElseThrow();
    server.addTool(
        new McpStatelessServerFeatures.SyncToolSpecification(
            searchMetadata,
            (context, request) ->
                McpSchema.CallToolResult.builder()
                    .content(List.of(McpSchema.TextContent.builder("ran").build()))
                    .isError(false)
                    .build()));
    ArgumentCaptor<McpStatelessServerHandler> handler =
        ArgumentCaptor.forClass(McpStatelessServerHandler.class);
    verify(transport).setMcpHandler(handler.capture());

    McpSchema.JSONRPCResponse response =
        handler
            .getValue()
            .handleRequest(
                McpTransportContext.EMPTY,
                new McpSchema.JSONRPCRequest(
                    McpSchema.METHOD_TOOLS_CALL,
                    1,
                    Map.of(
                        "name",
                        "search_metadata",
                        "arguments",
                        Map.of(
                            "size",
                            "5",
                            "includeDeleted",
                            "true",
                            "queryFilter",
                            Map.of("term", Map.of("entityType", "table"))))))
            .block();

    assertThat(((McpSchema.CallToolResult) response.result()).isError()).isFalse();
  }

  @Test
  void initializeReportsTheServerNameAndVersionFromTheMcpSettings() {
    McpStatelessServerTransport transport = mock(McpStatelessServerTransport.class);
    when(transport.protocolVersions()).thenReturn(List.of("2025-11-25"));
    MCPConfiguration configured =
        new MCPConfiguration().withMcpServerName("acme-mcp").withMcpServerVersion("9.9.9");
    McpServer.buildServer(transport, new McpServer().buildServerCapabilities(), () -> configured);
    ArgumentCaptor<McpStatelessServerHandler> handler =
        ArgumentCaptor.forClass(McpStatelessServerHandler.class);
    verify(transport).setMcpHandler(handler.capture());

    McpSchema.JSONRPCResponse response =
        handler
            .getValue()
            .handleRequest(
                McpTransportContext.EMPTY,
                new McpSchema.JSONRPCRequest(
                    McpSchema.METHOD_INITIALIZE,
                    1,
                    Map.of(
                        "protocolVersion",
                        "2025-11-25",
                        "capabilities",
                        Map.of(),
                        "clientInfo",
                        Map.of("name", "test", "version", "1"))))
            .block();

    McpSchema.Implementation serverInfo =
        ((McpSchema.InitializeResult) response.result()).serverInfo();
    assertThat(serverInfo.name()).isEqualTo("acme-mcp");
    assertThat(serverInfo.version()).isEqualTo("9.9.9");
    MCPConfiguration blank =
        new MCPConfiguration().withMcpServerName(" ").withMcpServerVersion(null);
    assertThat(McpServer.serverInfo(blank).name()).isEqualTo("openmetadata-mcp-server");
    assertThat(McpServer.serverInfo(blank).version()).isEqualTo("1.0.0");
  }

  @Test
  void aToolWithAnInvalidSchemaIsSkippedAndTheRestStillRegister() {
    McpStatelessSyncServer server =
        io.modelcontextprotocol.server.McpServer.sync(mock(McpStatelessServerTransport.class))
            .serverInfo("test", "1")
            .capabilities(McpSchema.ServerCapabilities.builder().tools(true).build())
            .build();
    McpSchema.Tool broken = McpSchema.Tool.builder("broken", Map.of("type", 5)).build();
    McpSchema.Tool valid = McpSchema.Tool.builder("valid", Map.of("type", "object")).build();

    new McpServer().addToolsToServer(server, List.of(broken, valid));

    assertThat(server.listTools()).extracting(McpSchema.Tool::name).containsExactly("valid");
  }

  @Test
  void testMcpUtilsGetToolPropertiesMarksPatchEntityAsDestructive() {
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    McpSchema.Tool patchTool =
        tools.stream().filter(t -> "patch_entity".equals(t.name())).findFirst().orElse(null);

    assertThat(patchTool).isNotNull();
    assertThat(patchTool.annotations()).isNotNull();
    assertThat(patchTool.annotations().readOnlyHint()).isFalse();
    assertThat(patchTool.annotations().destructiveHint()).isTrue();
    // A JSONPatch is not idempotent in general - an 'add' to '/owners/-' appends again on a retry -
    // so a client must not treat a retry as free. The MCP default is false, but state it.
    assertThat(patchTool.annotations().idempotentHint()).isFalse();
  }

  /**
   * Guards against copy-paste duplication when a tool description is edited. These are sent to the
   * model on every request, so a repeated sentence is paid for on every call - and folding two tools
   * together left exactly that in patch_entity once already.
   */
  @Test
  void testToolDescriptionsDoNotRepeatThemselves() {
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    for (McpSchema.Tool tool : tools) {
      List<String> sentences =
          java.util.Arrays.stream(tool.description().split("(?<=[.!?])\\s+"))
              .map(String::trim)
              .filter(sentence -> sentence.length() > 40)
              .toList();
      assertThat(sentences)
          .as("tool '%s' repeats a sentence in its description", tool.name())
          .doesNotHaveDuplicates();
    }
  }

  private static final List<String> UPSERT_CAPABLE_CREATE_TOOLS = List.of("create_test_case");

  @Test
  void testMcpUtilsGetToolPropertiesMarksUpsertCapableCreateToolsAsDestructive() {
    // These tools call repository.createOrUpdate(), so an existing entity with the requested
    // name/FQN is silently overwritten instead of producing a create conflict. destructiveHint
    // must be true so MCP clients require confirmation before the overwrite.
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools)
        .filteredOn(tool -> UPSERT_CAPABLE_CREATE_TOOLS.contains(tool.name()))
        .hasSize(UPSERT_CAPABLE_CREATE_TOOLS.size())
        .allSatisfy(
            tool ->
                assertThat(tool.annotations().destructiveHint())
                    .as("destructiveHint for tool %s", tool.name())
                    .isTrue());
  }

  @Test
  void testMcpUtilsGetToolPropertiesEveryToolHasTitleAndAnnotations() {
    // Regression guard: a new tool added to tools.json without title/annotations would fail
    // Claude Connectors Directory review. Fail the build instead of failing review.
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools)
        .allSatisfy(
            tool -> {
              assertThat(tool.title()).as("title for tool %s", tool.name()).isNotBlank();
              assertThat(tool.annotations()).as("annotations for tool %s", tool.name()).isNotNull();
            });
  }

  @Test
  void testMcpUtilsGetToolPropertiesEveryToolHasExplicitOpenWorldHintFalse() {
    // Regression guard: openWorldHint defaults to true when omitted, which would mislabel
    // every tool as reaching external/public systems and fail OpenAI Apps SDK review
    // ("incorrect or missing action labels"). All tools only touch our own OpenMetadata
    // catalog, so every tool must set this explicitly to false.
    List<McpSchema.Tool> tools = McpUtils.getToolProperties("json/data/mcp/tools.json");

    assertThat(tools)
        .allSatisfy(
            tool ->
                assertThat(tool.annotations().openWorldHint())
                    .as("openWorldHint for tool %s", tool.name())
                    .isFalse());
  }

  @Test
  void testServerAdvertisesOnlyHandledCapabilities() {
    // Every advertised capability must have a handler. Logging would make spec-compliant clients
    // (e.g. VSCode) call logging/setLevel; resources would let them call resources/list and
    // resources/subscribe. The stateless server handles none of those, so they must stay absent.
    McpSchema.ServerCapabilities capabilities = new McpServer().buildServerCapabilities();

    assertThat(capabilities.tools()).isNotNull();
    assertThat(capabilities.prompts()).isNotNull();
    // A stateless server cannot send list_changed notifications, so it must not promise them.
    assertThat(capabilities.tools().listChanged()).isFalse();
    assertThat(capabilities.prompts().listChanged()).isFalse();
    assertThat(capabilities.logging()).isNull();
    assertThat(capabilities.resources()).isNull();
    assertThat(capabilities.completions()).isNull();
  }

  @Test
  void testElicitationCapabilitiesDeserialization() throws Exception {
    // Regression test for https://github.com/open-metadata/OpenMetadata/issues/26454
    // MCP clients implementing the 2025-11-25 spec send elicitation with form/url fields.
    // SDK <= 0.17.1 threw UnrecognizedPropertyException crashing the handshake.
    JacksonMcpJsonMapper jsonMapper = new JacksonMcpJsonMapper(JsonUtils.getObjectMapper());

    String initRequest =
        """
        {
          "jsonrpc": "2.0",
          "id": 0,
          "method": "initialize",
          "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {
              "roots": {},
              "elicitation": {
                "form": {},
                "url": {}
              }
            },
            "clientInfo": {"name": "claude-code", "version": "2.1.74"}
          }
        }
        """;

    McpSchema.JSONRPCMessage message = McpSchema.deserializeJsonRpcMessage(jsonMapper, initRequest);

    assertThat(message).isNotNull();
    assertThat(message).isInstanceOf(McpSchema.JSONRPCRequest.class);
    McpSchema.JSONRPCRequest request = (McpSchema.JSONRPCRequest) message;
    assertThat(request.method()).isEqualTo("initialize");
  }

  @Test
  void testMcpUtilsGetPromptsLoadsPrompts() {
    // Test that McpUtils.getPrompts loads prompts from JSON file
    List<McpSchema.Prompt> prompts = McpUtils.getPrompts("json/data/mcp/prompts.json");

    assertThat(prompts).isNotNull();
    // Prompts may be empty depending on configuration, but should not throw
  }
}
