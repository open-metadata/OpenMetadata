package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;

class OntologyToolDiscoveryTest {
  private static final Set<String> WRITES =
      Set.of(
          "create_term_relation",
          "create_ontology_change_set",
          "ontology_change_set_lease",
          "submit_ontology_change_set");

  @Test
  void advertisedProposalReadSchemaSupportsBoundedSectionsAndContinuation() {
    final var tool =
        new McpServer()
            .getTools().stream()
                .filter(candidate -> candidate.name().equals("get_ontology_change_set"))
                .findFirst()
                .orElseThrow();
    final var schema =
        SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
            .getSchema(JsonUtils.valueToTree(tool).path("inputSchema"));
    final String id = "30028612-7a62-4f0b-94ef-84073f65bedd";
    assertThat(
            schema.validate(
                JsonUtils.valueToTree(
                    Map.of(
                        "id",
                        id,
                        "section",
                        "applicationResults",
                        "limit",
                        25,
                        "cursor",
                        "opaque-next-cursor"))))
        .isEmpty();
    for (final Map<String, Object> invalid :
        List.of(
            Map.<String, Object>of("id", id, "limit", 0),
            Map.<String, Object>of("id", id, "limit", 26),
            Map.<String, Object>of("id", id, "section", "other"),
            Map.<String, Object>of("id", id, "cursor", "x".repeat(513)))) {
      assertThat(schema.validate(JsonUtils.valueToTree(invalid))).isNotEmpty();
    }
  }

  @Test
  void advertisedProposalSchemaAcceptsAnExistingTargetOperation() {
    final var tool =
        new McpServer()
            .getTools().stream()
                .filter(candidate -> candidate.name().equals("create_ontology_change_set"))
                .findFirst()
                .orElseThrow();
    final var schema =
        SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
            .getSchema(JsonUtils.valueToTree(tool).path("inputSchema"));
    final var proposal =
        JsonUtils.valueToTree(
            Map.of(
                "name",
                "proposal",
                "displayName",
                "Proposal",
                "description",
                "For review",
                "glossaries",
                List.of("Customer"),
                "operations",
                List.of(
                    Map.of(
                        "id",
                        "30028612-7a62-4f0b-94ef-84073f65bedd",
                        "operationType",
                        "DELETE_TERM",
                        "state",
                        "ACTIVE",
                        "targetId",
                        "27e356c5-f7ab-4c13-aede-8fa8d1327255",
                        "baseVersion",
                        1.0))));
    assertThat(schema.validate(proposal)).isEmpty();
  }

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
