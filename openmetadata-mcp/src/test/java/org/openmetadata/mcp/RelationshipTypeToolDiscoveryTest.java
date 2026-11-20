package org.openmetadata.mcp;

import static io.modelcontextprotocol.server.McpServer.sync;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;

class RelationshipTypeToolDiscoveryTest {
  @Test
  void existingReadToolsExplainCatalogDiscoveryWithoutRdf() {
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(null);
      final List<McpSchema.Tool> tools = new McpServer().getTools();
      final McpStatelessSyncServer registered =
          sync(mock(McpStatelessServerTransport.class))
              .serverInfo("relationship-type-discovery-test", "1")
              .capabilities(McpSchema.ServerCapabilities.builder().tools(false).build())
              .build();
      new McpServer().addToolsToServer(registered, tools);
      final McpSchema.Tool search =
          registered.listTools().stream()
              .filter(tool -> tool.name().equals("search_metadata"))
              .findFirst()
              .orElseThrow();

      assertThat(search.annotations().readOnlyHint()).isTrue();
      assertThat(search.description())
          .contains("relationshipType", "get_entity_details", "RDF", "nextCursor");
      assertThat(
              JsonUtils.valueToTree(search)
                  .at("/inputSchema/properties/entityType/description")
                  .asText())
          .contains("relationshipType");
      assertThat(
              JsonUtils.valueToTree(search)
                  .at("/inputSchema/properties/fields/description")
                  .asText())
          .contains("rdfPredicate", "inverse", "domain", "range", "cardinality", "replacedBy");
      assertThat(tools)
          .extracting(McpSchema.Tool::name)
          .contains("search_metadata", "get_entity_details")
          .doesNotContain("list_relationship_types");
    }
  }
}
