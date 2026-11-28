package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import com.fasterxml.jackson.databind.JsonNode;
import io.modelcontextprotocol.spec.McpSchema;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

class RelationshipTypeReadContractTest {
  private static final String TYPE_NAME = "customerOf";

  @ParameterizedTest
  @ValueSource(strings = {"from", "size", "cursor"})
  void negativePagingReturns400(final String parameter) {
    final Object value = parameter.equals("cursor") ? PageCursor.encodeOffset(-1) : -1;
    final McpSchema.CallToolResult result =
        new DefaultToolContext()
            .callTool(
                mock(Authorizer.class),
                null,
                "search_metadata",
                contextFor("alice"),
                new McpSchema.CallToolRequest("search_metadata", Map.of(parameter, value)));

    assertThat(result.isError()).isTrue();
    final JsonNode error = JsonUtils.valueToTree(result.structuredContent());
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).contains("non-negative");
  }

  @ParameterizedTest
  @ValueSource(strings = {"from", "size"})
  void negativeNumericStringPagingReturns400(final String parameter) {
    final McpSchema.CallToolResult result =
        new DefaultToolContext()
            .callTool(
                mock(Authorizer.class),
                null,
                "search_metadata",
                contextFor("alice"),
                new McpSchema.CallToolRequest("search_metadata", Map.of(parameter, "-1")));

    assertThat(result.isError()).isTrue();
    final JsonNode error = JsonUtils.valueToTree(result.structuredContent());
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).contains("non-negative");
  }

  @ParameterizedTest
  @ValueSource(strings = {"alice", "bob"})
  void deniedCallerReceives403WithoutTheDefinition(final String caller) {
    final CatalogSecurityContext context = contextFor(caller);
    final Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              assertThat(invocation.getArgument(0, CatalogSecurityContext.class)).isSameAs(context);
              final OperationContext operation = invocation.getArgument(1);
              final ResourceContext<?> resource = invocation.getArgument(2);
              assertThat(operation.getResource()).isEqualTo(Entity.RELATIONSHIP_TYPE);
              assertThat(operation.getOperations(resource))
                  .containsExactly(MetadataOperation.VIEW_ALL);
              assertThat(resource.getResource()).isEqualTo(Entity.RELATIONSHIP_TYPE);
              assertThat(resource.isEntityTypeLevel()).isFalse();
              throw new AuthorizationException("Relationship definition denied");
            })
        .when(authorizer)
        .authorize(any(), any(), any());

    try (MockedStatic<Entity> registry = mockStatic(Entity.class)) {
      final McpSchema.CallToolResult result =
          new DefaultToolContext()
              .callTool(
                  authorizer,
                  null,
                  "get_entity_details",
                  context,
                  new McpSchema.CallToolRequest(
                      "get_entity_details",
                      Map.of("entityType", Entity.RELATIONSHIP_TYPE, "fqn", TYPE_NAME)));
      assertThat(result.isError()).isTrue();
      final JsonNode error = JsonUtils.valueToTree(result.structuredContent());
      assertThat(error.path("statusCode").asInt()).isEqualTo(403);
      assertThat(error.path("error").asText()).contains("Relationship definition denied");
      assertThat(error.has("rdfPredicate")).isFalse();
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void permittedNamedReadKeepsGovernedDefinitionFields(final boolean includeVersion)
      throws Exception {
    final RelationshipType definition =
        new RelationshipType()
            .withId(UUID.randomUUID())
            .withName(TYPE_NAME)
            .withVersion(1.2)
            .withFullyQualifiedName(TYPE_NAME)
            .withRdfPredicate(URI.create("https://example.org/customerOf"))
            .withEntityStatus(EntityStatus.APPROVED)
            .withCardinality(new RelationshipCardinality().withSourceMax(1))
            .withCrossGlossaryAllowed(false);
    final Authorizer authorizer = mock(Authorizer.class);
    try (MockedStatic<Entity> registry = mockStatic(Entity.class)) {
      registry
          .when(() -> Entity.getEntityByName(Entity.RELATIONSHIP_TYPE, TYPE_NAME, "*", null))
          .thenReturn(definition);
      final JsonNode result =
          JsonUtils.valueToTree(
              new GetEntityTool()
                  .execute(
                      authorizer,
                      contextFor("alice"),
                      Map.of(
                          "entityType",
                          Entity.RELATIONSHIP_TYPE,
                          "fqn",
                          TYPE_NAME,
                          "includeVersion",
                          includeVersion)));
      assertThat(result.path("rdfPredicate").asText())
          .isEqualTo(definition.getRdfPredicate().toString());
      assertThat(result.at("/cardinality/sourceMax").asInt()).isEqualTo(1);
      assertThat(result.path("crossGlossaryAllowed").asBoolean()).isFalse();
      assertThat(result.path("entityStatus").asText()).isEqualTo("Approved");
      assertThat(result.has("version")).isEqualTo(includeVersion);
      if (includeVersion) {
        assertThat(result.path("version").asDouble()).isEqualTo(1.2);
      }
      assertThat(definition.getVersion()).isEqualTo(1.2);
    }
  }

  private static CatalogSecurityContext contextFor(final String caller) {
    return new CatalogSecurityContext(() -> caller, "https", "Bearer", Set.of(), false);
  }
}
