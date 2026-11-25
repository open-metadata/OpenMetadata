package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/** ADR:2026-11-17-mcp-discovers-memories-through-the-existing-keyword-search */
class McpContextDiscoveryGuidanceTest {
  private static Map<String, JsonNode> listedTools;

  @BeforeAll
  static void listRegisteredTools() {
    final McpStatelessSyncServer server =
        io.modelcontextprotocol.server.McpServer.sync(mock(McpStatelessServerTransport.class))
            .serverInfo("context-discovery-test", "1")
            .capabilities(McpSchema.ServerCapabilities.builder().tools(true).build())
            .build();
    new McpServer()
        .addToolsToServer(server, McpUtils.getToolProperties("json/data/mcp/tools.json"));
    listedTools =
        server.listTools().stream()
            .map(JsonUtils::valueToTree)
            .collect(Collectors.toMap(tool -> tool.path("name").asText(), Function.identity()));
  }

  @Test
  void companyContextDistinguishesSearchFromLookupByName() {
    assertThat(listedTools.get("company_context").path("description").asText())
        .contains("searches Shared notes visible to the caller", "note the caller can view");
  }

  @Test
  void searchMetadataTellsAgentsToCheckMemoriesFirst() {
    assertThat(listedTools.get("search_metadata").path("description").asText())
        .contains("Before answering a business question", "entityType='contextMemory'");
  }

  @Test
  void findContextPointsMemoryLookupsToSearchMetadata() {
    assertThat(listedTools.get("find_context").path("description").asText())
        .contains("does not search Context Center Memories", "entityType='contextMemory'");
  }
}
