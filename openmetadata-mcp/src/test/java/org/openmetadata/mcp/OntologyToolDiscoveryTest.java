package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.rdf.RdfRepository;

class OntologyToolDiscoveryTest {
  private static final Set<String> WRITES =
      Set.of(
          "create_term_relation",
          "create_ontology_change_set",
          "ontology_change_set_lease",
          "submit_ontology_change_set");

  @Test
  void publishesGovernedOntologyWorkflowWithRdfDisabled() {
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(null);
      final List<McpSchema.Tool> tools = new McpServer().getTools();
      assertThat(tools)
          .extracting(McpSchema.Tool::name)
          .containsAll(WRITES)
          .contains("get_ontology_change_set");
      for (final McpSchema.Tool tool : tools) {
        if (WRITES.contains(tool.name())) {
          assertThat(tool.annotations().readOnlyHint()).as(tool.name()).isFalse();
          assertThat(tool.annotations().openWorldHint()).as(tool.name()).isFalse();
        }
      }
      assertThat(
              tools.stream()
                  .filter(tool -> tool.name().equals("get_ontology_change_set"))
                  .findFirst()
                  .orElseThrow()
                  .annotations()
                  .readOnlyHint())
          .isTrue();
      assertThat(tools)
          .extracting(McpSchema.Tool::name)
          .doesNotContain("apply_ontology_change_set", "discard_ontology_change_set");
    }
  }
}
