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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;

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

  @ParameterizedTest
  @ValueSource(strings = {"search_metadata", "find_context"})
  void discoveryToolsAdvertiseTheMemoryFirstWorkflow(final String toolName) {
    assertThat(listedTools.get(toolName).path("description").asText())
        .contains(
            "Before answering",
            "search_metadata",
            "contextMemory",
            "Approved",
            "get_entity_details");
  }

  @Test
  void keywordMemorySearchExplainsItsFieldsAndEmbeddingIndependence() {
    final JsonNode search = listedTools.get("search_metadata");
    assertThat(search.path("description").asText()).contains("does not require embeddings");
    assertThat(search.at("/inputSchema/properties/fields/description").asText())
        .contains(
            "contextMemory",
            "question",
            "answer",
            "entityStatus",
            "primaryEntity",
            "relatedEntities",
            "sourceType",
            "sourceEntity",
            "sourceFile");
  }

  @Test
  void specialistContextToolsDistinguishMemoriesFromTheirOwnKnowledge() {
    assertThat(listedTools.get("find_context").path("description").asText())
        .contains("does not search Context Center Memories");
    assertThat(listedTools.get("company_context").path("description").asText())
        .contains("file-extracted", "Shared", "Approved", "search_metadata", "contextMemory");
  }

  @Test
  void memoryReadsExplainGroundingStageAndApplicability() {
    assertThat(listedTools.get("get_entity_details").path("description").asText())
        .contains(
            "Context Center Memories", "Approved", "deleted", "primaryEntity", "relatedEntities");
  }

  @Test
  void memoryDiscoveryRequiresResolvingAndPinningRelevantAnchors() {
    assertThat(listedTools.get("search_metadata").path("description").asText())
        .contains(
            "keyword-only",
            "non-owners",
            "discover the relevant anchor",
            "fields='id'",
            "repeat",
            "primaryEntity.id",
            "keyword clause inside queryFilter");
  }

  @Test
  void anchorFilterHelpExplainsTheSelfContainedKeywordExample() {
    assertThat(
            listedTools
                .get("search_metadata")
                .at("/inputSchema/properties/queryFilter/description")
                .asText())
        .contains("combined with", "query='*'", "multi_match", "question", "answer")
        .doesNotContain("overrides the 'query'");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"search_metadata", "get_entity_details", "company_context", "find_context"})
  void memoryGuidanceDoesNotElevateRetrievedTextIntoTrustedInstructions(final String toolName) {
    assertThat(listedTools.get(toolName).path("description").asText())
        .contains("reference data", "user's instructions", "caller permissions");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"search_metadata", "get_entity_details", "company_context", "find_context"})
  void memoryGuidancePreservesSourcesAndSurfacesConflictingApprovedClaims(final String toolName) {
    assertThat(listedTools.get(toolName).path("description").asText())
        .contains(
            "lifecycle eligibility",
            "not truth",
            "human adjudication",
            "source/provenance",
            "Approved memories conflict",
            "do not silently choose",
            "uncertainty",
            "clarification",
            "redacted source details");
  }
}
