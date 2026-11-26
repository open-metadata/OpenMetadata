package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import com.fasterxml.jackson.databind.JsonNode;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil;

class OntologyToolContractTest {
  private static final String ID = "b0df08ad-5eca-4eb3-aa7d-cbd136f4195a";
  private static final String TARGET = "27e356c5-f7ab-4c13-aede-8fa8d1327255";

  @Test
  void documentedPayloadDiscoveryWorksWithoutEnablingGenericCreation() {
    final var outcome =
        new DefaultToolContext()
            .callTool(
                mock(Authorizer.class),
                null,
                "describe_entity_type",
                context(),
                new McpSchema.CallToolRequest(
                    "describe_entity_type",
                    Map.of("entityType", "ontologyChangeSet", "schema", "relationship")));
    assertThat(outcome.isError()).as(String.valueOf(outcome)).isFalse();
    final JsonNode description = JsonUtils.valueToTree(outcome.structuredContent());
    assertThat(description.path("rootSchema").asText()).isEqualTo("type/ontologyRelationship.json");
    assertThat(description.path("schemas").path("type/ontologyRelationship.json").path("required"))
        .contains(JsonUtils.valueToTree("fromTerm"), JsonUtils.valueToTree("toTerm"));
    assertThat(
            invoke(
                    "create_entity",
                    Map.of("entityType", "ontologyChangeSet", "name", "proposal"),
                    mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "create_term_relation",
        "create_ontology_change_set",
        "get_ontology_change_set",
        "ontology_change_set_lease",
        "submit_ontology_change_set"
      })
  void missingArgumentsAre400RatherThanUnknownTool(final String tool) {
    final JsonNode error = invoke(tool, Map.of(), mock(Authorizer.class));
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).doesNotContain("Unknown function");
  }

  @ParameterizedTest
  @ValueSource(strings = {"provenance", "status", "createdBy", "createdAt", "id"})
  void relationCannotManufactureLifecycleOrAuthorProvenance(final String field) {
    final Map<String, Object> values = new HashMap<>(relation());
    values.put(field, "Approved");
    assertThat(
            invoke("create_term_relation", values, mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 2})
  void deniedSourceOrTargetIs403BeforeMutation(final int deniedRead) {
    final Authorizer authorizer = mock(Authorizer.class);
    final AtomicInteger reads = new AtomicInteger();
    doAnswer(
            invocation -> {
              final CatalogSecurityContext context = invocation.getArgument(0);
              final OperationContext operation = invocation.getArgument(1);
              final ResourceContext<?> resource = invocation.getArgument(2);
              assertThat(context.getUserPrincipal().getName()).isEqualTo("alice");
              assertThat(operation.getResource()).isEqualTo("glossaryTerm");
              if (reads.incrementAndGet() == deniedRead) {
                throw new AuthorizationException("Term read denied");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (final MockedStatic<Entity> registry = mockStatic(Entity.class)) {
      assertThat(invoke("create_term_relation", relation(), authorizer).path("statusCode").asInt())
          .isEqualTo(403);
    }
    assertThat(reads).hasValue(deniedRead);
  }

  @ParameterizedTest
  @ValueSource(strings = {"state", "undoCursor", "provider", "owners", "sourcePack"})
  void proposalCannotSetServerOwnedFields(final String field) {
    final Map<String, Object> proposal = new HashMap<>(proposal());
    proposal.put(field, "APPLIED");
    assertThat(
            invoke("create_ontology_change_set", proposal, mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @Test
  void generatedProposalRetainsTypedOperationsAndEvidence() {
    final Map<String, Object> values = new HashMap<>(proposal());
    values.put(
        "operations",
        List.of(
            Map.of(
                "id",
                ID,
                "operationType",
                "DELETE_TERM",
                "state",
                "ACTIVE",
                "targetId",
                TARGET,
                "baseVersion",
                1.2,
                "sourceMemoryIds",
                List.of(ID),
                "rationale",
                "Review this suggestion",
                "confidence",
                0.7)));
    final var request = OntologyTool.proposal(values);
    assertThat(request.getOperations()).hasSize(1);
    final var operation = request.getOperations().getFirst();
    assertThat(operation.getOperationType()).isEqualTo(OntologyChangeOperationType.DELETE_TERM);
    assertThat(operation.getSourceMemoryIds()).containsExactly(UUID.fromString(ID));
    assertThat(operation.getBaseVersion()).isEqualTo(1.2);
    assertThat(operation.getRationale()).isEqualTo("Review this suggestion");
    assertThat(request.getState()).isNull();
  }

  @Test
  void nestedBeanValidationIsAClientError() {
    final Map<String, Object> values = new HashMap<>(proposal());
    values.put("operations", List.of(Map.of("operationType", "DELETE_TERM", "state", "ACTIVE")));
    assertThat(
            invoke("create_ontology_change_set", values, mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "a very long session identifier that exceeds the maximum sixty four characters allowed"
      })
  void submitRequiresAValidOwnedLeaseShape(final String session) {
    assertThat(
            invoke(
                    "submit_ontology_change_set",
                    Map.of("id", ID, "lease", Map.of("sessionId", session, "version", 1)),
                    mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @ValueSource(doubles = {-1, 0, 1.5})
  void submitRejectsInvalidAndFractionalLeaseVersions(final double version) {
    assertThat(
            invoke(
                    "submit_ontology_change_set",
                    Map.of("id", ID, "lease", Map.of("sessionId", "session", "version", version)),
                    mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @CsvSource({"leaseSeconds,9", "leaseSeconds,301", "expectedVersion,0"})
  void leaseRejectsOutOfRangeNumbers(final String key, final int value) {
    final Map<String, Object> input =
        new HashMap<>(Map.of("id", ID, "action", "ACQUIRE", "sessionId", "session"));
    input.put(key, value);
    assertThat(
            invoke("ontology_change_set_lease", input, mock(Authorizer.class))
                .path("statusCode")
                .asInt())
        .isEqualTo(400);
  }

  @ParameterizedTest
  @CsvSource({
    "https://catalog.example,https://catalog.example/api/",
    "https://catalog.example/,https://catalog.example/api/",
    "https://catalog.example/metadata,https://catalog.example/metadata/api/",
    "https://catalog.example/metadata/,https://catalog.example/metadata/api/"
  })
  void canonicalResourcesReceiveConfiguredOriginAndPath(final String base, final String expected) {
    assertThat(OntologyToolSupport.uriInfo(base, "/api", context()).getBaseUri().toString())
        .isEqualTo(expected);
  }

  @ParameterizedTest
  @EnumSource(names = {"ENTITY_UPDATED", "ENTITY_NO_CHANGE"})
  void heldRelationRemainsPendingWithoutPublishingAnUpdateEvent(final EventType event) {
    final UUID pending = UUID.randomUUID();
    try (final MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class);
        final Response response =
            Response.accepted(
                    term()
                        .withDescription("Previous edit")
                        .withChangeDescription(
                            new ChangeDescription()
                                .withFieldsUpdated(
                                    List.of(new FieldChange().withName("description")))))
                .header(RestUtil.CHANGE_CUSTOM_HEADER, event)
                .header(RestUtil.PENDING_CHANGE_HEADER, pending)
                .build()) {
      final Map<String, Object> result =
          OntologyToolSupport.writeResult(response, Entity.GLOSSARY_TERM, context());
      assertThat(result)
          .containsEntry("_operation", "pendingApproval")
          .containsEntry("changeRequestId", pending.toString());
      assertThat(result)
          .containsEntry("entityType", Entity.GLOSSARY_TERM)
          .doesNotContainKeys("relatedTerms", "changed", "description");
      events.verifyNoInteractions();
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"get_entity_details", "patch_entity"})
  void genericToolsCannotSkipDraftScopeOrLeaseGuards(final String tool) {
    final JsonNode error =
        invoke(
            tool,
            Map.of(
                "entityType",
                "ontologyChangeSet",
                "fqn",
                "draft",
                "patch",
                "[{\"op\":\"replace\",\"path\":\"/state\",\"value\":\"APPLIED\"}]"),
            mock(Authorizer.class));
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).contains("dedicated");
    if (tool.equals("patch_entity")) {
      assertThat(error.path("error").asText())
          .contains("ontology change-set tools")
          .doesNotContain("REST PATCH API");
    }
  }

  @Test
  void aCreatedProposalRecordsTheCallerEvent() {
    final GlossaryTerm entity = term();
    try (final MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class);
        final Response response = Response.status(201).entity(entity).build()) {
      assertThat(OntologyToolSupport.writeResult(response, Entity.GLOSSARY_TERM, context()))
          .containsEntry("_operation", "created");
      events.verify(
          () -> McpChangeEventUtil.publishChangeEvent(entity, EventType.ENTITY_CREATED, "alice"));
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {400, 403, 409, 500})
  void resourceFailuresAreNotReportedAsSuccessfulWrites(final int status) {
    try (final Response response = Response.status(status).build()) {
      assertThatThrownBy(
              () -> OntologyToolSupport.writeResult(response, Entity.GLOSSARY_TERM, context()))
          .isInstanceOf(WebApplicationException.class)
          .satisfies(
              error ->
                  assertThat(((WebApplicationException) error).getResponse().getStatus())
                      .isEqualTo(status));
    }
  }

  @Test
  void aNonCreateResponseCannotInventACreationEvent() {
    try (final Response response = Response.ok(term()).build()) {
      assertThatThrownBy(
              () -> OntologyToolSupport.writeResult(response, Entity.GLOSSARY_TERM, context()))
          .isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("missing its change type");
    }
  }

  private static Map<String, Object> relation() {
    return Map.of("sourceTermId", ID, "targetTermId", TARGET, "relationType", "relatedTo");
  }

  private static Map<String, Object> proposal() {
    return Map.of(
        "name",
        "customer-proposal",
        "displayName",
        "Customer proposal",
        "description",
        "Propose for review",
        "glossaries",
        List.of("Customer"),
        "operations",
        List.of());
  }

  private static GlossaryTerm term() {
    return new GlossaryTerm().withId(UUID.fromString(ID)).withName("Customer").withVersion(1.0);
  }

  private static JsonNode invoke(
      final String tool, final Map<String, Object> arguments, final Authorizer authorizer) {
    final var outcome =
        new DefaultToolContext()
            .callTool(
                authorizer, null, tool, context(), new McpSchema.CallToolRequest(tool, arguments));
    assertThat(outcome.isError()).as(String.valueOf(outcome)).isTrue();
    return JsonUtils.valueToTree(outcome.structuredContent());
  }

  private static CatalogSecurityContext context() {
    return new CatalogSecurityContext(() -> "alice", "https", "Bearer", Set.of(), false);
  }
}
