/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerHandler;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.McpSyncListFilter;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.mcp.usage.McpUsageRecorder;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class McpReadOnlyModeTest {

  private static final String TOKEN = "token";

  private static final Set<String> WITHHELD_TOOLS =
      Set.of(
          "create_entity",
          "patch_entity",
          "create_lineage",
          "create_test_case",
          "describe_entity_type");

  private static final MCPConfiguration READ_ONLY = new MCPConfiguration().withReadOnly(true);

  private static final McpSchema.CallToolResult SUCCESS =
      McpSchema.CallToolResult.builder()
          .content(List.of(McpSchema.TextContent.builder("{}").build()))
          .isError(false)
          .build();

  @Test
  void readOnlyModeWithholdsTheWriteToolsAndKeepsTheReadTools() {
    List<McpSchema.Tool> tools = new McpServer().getTools();

    List<String> exposed = names(exposed(tools, READ_ONLY));

    WITHHELD_TOOLS.forEach(tool -> assertFalse(exposed.contains(tool), tool + " is a write tool"));
    assertEquals(tools.size() - WITHHELD_TOOLS.size(), exposed.size());
    assertTrue(exposed.contains("search_metadata"));
  }

  @Test
  void aToolWithoutAReadOnlyHintIsWithheld() {
    McpSchema.Tool unannotated =
        McpSchema.Tool.builder("unannotated", Map.of("type", "object")).build();

    assertTrue(exposed(List.of(unannotated), READ_ONLY).isEmpty());
  }

  @Test
  void everyToolIsExposedWhenReadOnlyIsOffOrUnset() {
    List<McpSchema.Tool> tools = new McpServer().getTools();

    assertEquals(tools, exposed(tools, new MCPConfiguration()));
    assertEquals(tools, exposed(tools, null));
  }

  @Test
  void aRegisteredWriteToolIsRefusedOnceReadOnlyIsTurnedOn() {
    DefaultToolContext toolContext = succeedingToolContext();

    McpSchema.CallToolResult result = callInReadOnlyMode(toolContext, "patch_entity");

    assertTrue(result.isError(), "patch_entity must not run in read-only mode");
    assertEquals(403, ((Map<?, ?>) result.structuredContent()).get("statusCode"));
    verify(toolContext, never()).callToolWithMetadata(any(), any(), any(), any(), any());
  }

  @Test
  void aReadToolStillRunsInReadOnlyMode() {
    assertSame(SUCCESS, callInReadOnlyMode(succeedingToolContext(), "search_metadata"));
  }

  @Test
  void aDisabledToolIsWithheldAndAnUnknownNameIsIgnored() {
    List<McpSchema.Tool> tools = new McpServer().getTools();
    MCPConfiguration config =
        new MCPConfiguration().withDisabledTools(Set.of("semantic_search", "no_such_tool"));

    List<String> exposed = names(exposed(tools, config));

    assertFalse(exposed.contains("semantic_search"));
    assertEquals(tools.size() - 1, exposed.size());
  }

  @Test
  void aRegisteredDisabledToolIsRefusedOnEveryCall() {
    DefaultToolContext toolContext = succeedingToolContext();
    MCPConfiguration config = new MCPConfiguration().withDisabledTools(Set.of("search_metadata"));

    McpSchema.CallToolResult result = call(toolContext, "search_metadata", config);

    assertTrue(result.isError(), "a disabled tool must not run");
    assertEquals(403, ((Map<?, ?>) result.structuredContent()).get("statusCode"));
    verify(toolContext, never()).callToolWithMetadata(any(), any(), any(), any(), any());
  }

  @Test
  void theServerClientsReachHidesWriteToolsInReadOnlyMode() {
    McpStatelessServerTransport transport = mock(McpStatelessServerTransport.class);
    McpServer mcpServer = new McpServer();
    McpStatelessSyncServer server =
        McpServer.buildServer(transport, mcpServer.buildServerCapabilities(), () -> READ_ONLY);
    mcpServer.addToolsToServer(server, mcpServer.getTools());
    ArgumentCaptor<McpStatelessServerHandler> handler =
        ArgumentCaptor.forClass(McpStatelessServerHandler.class);
    verify(transport).setMcpHandler(handler.capture());

    McpSchema.JSONRPCResponse response =
        handler
            .getValue()
            .handleRequest(
                McpTransportContext.EMPTY,
                new McpSchema.JSONRPCRequest(McpSchema.METHOD_TOOLS_LIST, 1))
            .block();

    List<String> listed = names(((McpSchema.ListToolsResult) response.result()).tools());
    WITHHELD_TOOLS.forEach(tool -> assertFalse(listed.contains(tool), tool + " is a write tool"));
    assertTrue(listed.contains("search_metadata"));
  }

  @Test
  void toolsListFollowsTheSettingWithoutARestart() {
    AtomicReference<MCPConfiguration> config = new AtomicReference<>(new MCPConfiguration());
    McpSyncListFilter<McpSchema.Tool> filter = McpServer.toolFilter(config::get);
    McpSchema.Tool patchEntity = toolNamed("patch_entity");

    assertTrue(filter.isVisible(McpTransportContext.EMPTY, patchEntity));
    config.set(READ_ONLY);
    assertFalse(filter.isVisible(McpTransportContext.EMPTY, patchEntity));
    config.set(new MCPConfiguration().withDisabledTools(Set.of("patch_entity")));
    assertFalse(filter.isVisible(McpTransportContext.EMPTY, patchEntity));
    config.set(new MCPConfiguration());
    assertTrue(filter.isVisible(McpTransportContext.EMPTY, patchEntity));
  }

  private static List<McpSchema.Tool> exposed(List<McpSchema.Tool> tools, MCPConfiguration config) {
    McpSyncListFilter<McpSchema.Tool> filter = McpServer.toolFilter(() -> config);
    return tools.stream()
        .filter(tool -> filter.isVisible(McpTransportContext.EMPTY, tool))
        .toList();
  }

  private static DefaultToolContext succeedingToolContext() {
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), any(), any(), any()))
        .thenReturn(new DefaultToolContext.CallToolOutcome(SUCCESS, 0L, null));
    return toolContext;
  }

  private static McpSchema.CallToolResult callInReadOnlyMode(
      DefaultToolContext toolContext, String toolName) {
    return call(toolContext, toolName, READ_ONLY);
  }

  private static McpSchema.CallToolResult call(
      DefaultToolContext toolContext, String toolName, MCPConfiguration mcpConfig) {
    McpServer server = new McpServer(toolContext, new DefaultPromptsContext());
    server.jwtFilter = jwtFilterFor("alice");
    McpSchema.CallToolRequest request =
        McpSchema.CallToolRequest.builder(toolName).arguments(Map.of()).build();

    try (MockedStatic<SecurityConfigurationManager> config =
            mockStatic(SecurityConfigurationManager.class);
        MockedStatic<McpUsageRecorder> usage = mockStatic(McpUsageRecorder.class)) {
      config.when(SecurityConfigurationManager::getCurrentMcpConfig).thenReturn(mcpConfig);
      return server.getTool(toolNamed(toolName)).callHandler().apply(callerContext(), request);
    }
  }

  private static McpSchema.Tool toolNamed(String name) {
    return new McpServer()
        .getTools().stream().filter(tool -> tool.name().equals(name)).findFirst().orElseThrow();
  }

  private static JwtFilter jwtFilterFor(String userName) {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(() -> userName);
    JwtFilter jwtFilter = mock(JwtFilter.class);
    when(jwtFilter.getCatalogSecurityContext(TOKEN)).thenReturn(securityContext);
    return jwtFilter;
  }

  private static McpTransportContext callerContext() {
    return McpTransportContext.create(
        Map.of(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER, TOKEN));
  }

  private static List<String> names(List<McpSchema.Tool> tools) {
    return tools.stream().map(McpSchema.Tool::name).toList();
  }
}
